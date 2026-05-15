import { extractHostnameFromUrl } from '../utils/categorize.js';
import {
  createEventTrace,
  getDebugConfig,
  loadDebugConfig,
  logError,
  logInfo,
  setDebugConfig,
  traceSession,
  traceStorage,
} from '../utils/debugLogger.js';
import {
  getTodayTrackingSummary,
  getTrackingSnapshot,
  initializeAndValidateStorage,
  validateTrackingStorage,
} from '../utils/diagnostics.js';
import {
  MESSAGE_TYPES,
  createErrorResponse,
  createSuccessResponse,
  isExtensionMessage,
} from '../utils/messages.js';
import {
  getActiveSession,
  getSettings,
  initializeStorage,
  saveSettings,
} from '../utils/storage.js';
import {
  COMMIT_REASONS,
  RECOVERY_ACTIONS,
  SESSION_IDLE_STATES,
  SESSION_PAUSE_REASONS,
  clearSession,
  commitActiveSession,
  pauseActiveSession,
  recoverSession,
  startSession,
} from '../utils/tracker.js';

const chromeApi = globalThis.chrome;
const NORMAL_WINDOW_ID_NONE = chromeApi.windows.WINDOW_ID_NONE;

const LIFECYCLE_SOURCES = Object.freeze({
  INSTALLED: 'runtime.onInstalled',
  STARTUP: 'runtime.onStartup',
});

let eventQueue = Promise.resolve();
let initializePromise = null;

function runTrackedEvent(label, handler) {
  eventQueue = eventQueue
    .then(async () => {
      const eventTrace = createEventTrace(label);

      await ensureInitialized();

      try {
        const result = await handler();

        eventTrace.finish();

        return result;
      } catch (error) {
        eventTrace.fail(error);
        throw error;
      }
    })
    .catch((error) => {
      logError(`${label} failed`, error);
    });

  return eventQueue;
}

function runMessageEvent(label, handler, sendResponse) {
  eventQueue = eventQueue
    .then(async () => {
      const eventTrace = createEventTrace(label);

      await ensureInitialized();

      try {
        const data = await handler();

        eventTrace.finish();
        sendResponse(createSuccessResponse(data));
      } catch (error) {
        eventTrace.fail(error);
        sendResponse(createErrorResponse(error));
      }
    })
    .catch((error) => {
      logError(`${label} failed`, error);
      sendResponse(createErrorResponse(error));
    });
}

function runReadOnlyMessageEvent(label, handler, sendResponse) {
  Promise.resolve()
    .then(async () => {
      const eventTrace = createEventTrace(label);

      await ensureInitialized();

      try {
        const data = await handler();

        eventTrace.finish();
        sendResponse(createSuccessResponse(data));
      } catch (error) {
        eventTrace.fail(error);
        sendResponse(createErrorResponse(error));
      }
    })
    .catch((error) => {
      logError(`${label} failed`, error);
      sendResponse(createErrorResponse(error));
    });
}

async function ensureInitialized() {
  if (!initializePromise) {
    initializePromise = loadDebugConfig()
      .then(() => initializeStorage())
      .then((snapshot) => {
        logInfo('storage initialized', undefined, { scope: 'lifecycle' });
        traceStorage('storage snapshot after initialization', snapshot);
        return snapshot;
      })
      .catch((error) => {
        initializePromise = null;
        throw error;
      });
  }

  return initializePromise;
}

async function configureIdleDetection() {
  if (!chromeApi.idle?.setDetectionInterval) {
    return;
  }

  const settings = await getSettings();

  chromeApi.idle.setDetectionInterval(settings.idleThresholdSeconds);
}

async function queryIdleState() {
  if (!chromeApi.idle?.queryState) {
    return SESSION_IDLE_STATES.ACTIVE;
  }

  const settings = await getSettings();
  const state = await chromeApi.idle.queryState(settings.idleThresholdSeconds);

  if (Object.values(SESSION_IDLE_STATES).includes(state)) {
    return state;
  }

  return SESSION_IDLE_STATES.ACTIVE;
}

async function getFocusedWindow() {
  try {
    const focusedWindow = await chromeApi.windows.getLastFocused({
      populate: false,
    });

    if (!focusedWindow?.focused) {
      return null;
    }

    return focusedWindow;
  } catch {
    return null;
  }
}

async function getWindow(windowId) {
  if (!Number.isInteger(windowId) || windowId === NORMAL_WINDOW_ID_NONE) {
    return null;
  }

  try {
    return await chromeApi.windows.get(windowId, {
      populate: false,
    });
  } catch {
    return null;
  }
}

async function getActiveTabForWindow(windowId) {
  if (!Number.isInteger(windowId) || windowId === NORMAL_WINDOW_ID_NONE) {
    return null;
  }

  try {
    const tabs = await chromeApi.tabs.query({
      active: true,
      windowId,
    });

    return tabs[0] ?? null;
  } catch {
    return null;
  }
}

async function getTab(tabId) {
  try {
    return await chromeApi.tabs.get(tabId);
  } catch {
    return null;
  }
}

async function getTrackingContext(options = {}) {
  const settings = await getSettings();
  const idleState = options.idleState ?? (await queryIdleState());
  const windowCandidate = options.windowId
    ? await getWindow(options.windowId)
    : await getFocusedWindow();
  const focusedWindow = windowCandidate?.focused ? windowCandidate : null;
  const browserFocused = Boolean(focusedWindow?.focused);
  const activeTab = options.activeTab ??
    (browserFocused
      ? await getActiveTabForWindow(focusedWindow.id)
      : null);

  return {
    activeTab,
    browserFocused,
    idleState,
    now: Date.now(),
    settings,
    windowId: focusedWindow?.id ?? NORMAL_WINDOW_ID_NONE,
  };
}

function isContextTrackable(context) {
  return (
    context.browserFocused &&
    context.idleState === SESSION_IDLE_STATES.ACTIVE &&
    Boolean(context.activeTab)
  );
}

function isWindowFocused(windowId) {
  return windowId !== NORMAL_WINDOW_ID_NONE;
}

function activeSessionMatchesTab(session, tab) {
  const nextDomain = extractHostnameFromUrl(tab?.url);

  if (!session || !nextDomain) {
    return false;
  }

  return session.domain === nextDomain && session.tabId === tab.id;
}

function activeTrackingSessionMatchesTab(session, tab) {
  return Boolean(session?.isTracking) && activeSessionMatchesTab(session, tab);
}

function activeSessionMatchesHostname(session, tabId, hostname) {
  if (!session || !hostname) {
    return false;
  }

  return session.tabId === tabId && session.domain === hostname;
}

function activeTrackingSessionMatchesHostname(session, tabId, hostname) {
  return (
    Boolean(session?.isTracking) &&
    activeSessionMatchesHostname(session, tabId, hostname)
  );
}

function isTrackableTab(tab) {
  return Boolean(extractHostnameFromUrl(tab?.url));
}

async function startSessionForContext(context, reason) {
  if (!isContextTrackable(context)) {
    return null;
  }

  const session = await startSession(context.activeTab, {
    browserFocused: context.browserFocused,
    idleState: context.idleState,
    now: context.now,
    settings: context.settings,
  });

  logInfo(
    `session start checked from ${reason}`,
    {
      domain: session?.domain ?? null,
      tabId: context.activeTab?.id ?? null,
    },
    { scope: 'session' },
  );
  traceSession(`session start checked from ${reason}`, session);

  return session;
}

async function recoverAndMaybeStart(source) {
  const context = await getTrackingContext();
  const recovery = await recoverSession({
    browserFocused: context.browserFocused,
    currentTab: context.activeTab,
    idleState: context.idleState,
    now: context.now,
    settings: context.settings,
    staleAction: RECOVERY_ACTIONS.PAUSE,
  });

  logInfo(
    `recovery from ${source}`,
    {
      action: recovery.action,
      reason: recovery.reason,
    },
    { scope: 'lifecycle' },
  );

  if (
    isContextTrackable(context) &&
    (
      [RECOVERY_ACTIONS.NONE, RECOVERY_ACTIONS.CLEAR, RECOVERY_ACTIONS.PAUSE].includes(
        recovery.action,
      ) ||
      recovery.reason === 'session-already-paused'
    )
  ) {
    await startSessionForContext(context, source);
  }
}

function serializeTabForPopup(tab) {
  if (!tab) {
    return null;
  }

  return {
    id: tab.id,
    windowId: tab.windowId,
    title: tab.title ?? '',
    url: tab.url ?? '',
  };
}

async function getLiveSessionState(source) {
  await recoverAndMaybeStart(source);

  return getLiveSessionSnapshot();
}

async function getLiveSessionSnapshot() {
  const [activeSession, context] = await Promise.all([
    getActiveSession(),
    getTrackingContext(),
  ]);

  return {
    generatedAt: Date.now(),
    activeSession,
    context: {
      browserFocused: context.browserFocused,
      idleState: context.idleState,
      activeTab: serializeTabForPopup(context.activeTab),
    },
  };
}

function scheduleLiveStateRecovery(source) {
  runTrackedEvent(`${source}:recovery`, () => recoverAndMaybeStart(source));
}

async function setTrackingEnabledFromPopup(enabled) {
  const settings = await saveSettings({
    trackingEnabled: Boolean(enabled),
  });
  const context = await getTrackingContext();

  if (!settings.trackingEnabled) {
    await pauseActiveSession(SESSION_PAUSE_REASONS.DISABLED, {
      browserFocused: context.browserFocused,
      idleState: context.idleState,
      now: context.now,
      reason: COMMIT_REASONS.PAUSE,
      settings,
    });
  } else {
    await recoverAndMaybeStart('runtime.onMessage.tracking-enabled');
  }

  return getLiveSessionState('runtime.onMessage.tracking-toggle-result');
}

async function recoverFocusSession(context, source) {
  const recovery = await recoverSession({
    browserFocused: context.browserFocused,
    currentTab: context.activeTab,
    idleState: context.idleState,
    now: context.now,
    settings: context.settings,
    staleAction: RECOVERY_ACTIONS.PAUSE,
  });

  logInfo(
    `focus recovery from ${source}`,
    {
      action: recovery.action,
      reason: recovery.reason,
    },
    { scope: 'lifecycle' },
  );

  return recovery;
}

async function recoverIdleSession(context, source) {
  const recovery = await recoverSession({
    browserFocused: context.browserFocused,
    currentTab: context.activeTab,
    idleState: context.idleState,
    now: context.now,
    settings: context.settings,
    staleAction: RECOVERY_ACTIONS.PAUSE,
  });

  logInfo(
    `idle recovery from ${source}`,
    {
      action: recovery.action,
      reason: recovery.reason,
    },
    { scope: 'lifecycle' },
  );

  return recovery;
}

async function initializeExtensionLifecycle(source) {
  await ensureInitialized();
  await configureIdleDetection();
  await recoverAndMaybeStart(source);
}

async function handleRuntimeInstalled(details) {
  const source = `${LIFECYCLE_SOURCES.INSTALLED}:${details.reason}`;

  await initializeExtensionLifecycle(source);
}

async function handleRuntimeStartup() {
  await initializeExtensionLifecycle(LIFECYCLE_SOURCES.STARTUP);
}

async function handleActiveTabChange(tabId, windowId) {
  const tab = await getTab(tabId);
  const context = await getTrackingContext({
    activeTab: tab,
    windowId,
  });
  const currentSession = await getActiveSession();

  if (activeTrackingSessionMatchesTab(currentSession, tab)) {
    return;
  }

  if (!isContextTrackable(context)) {
    const pauseReason = context.browserFocused
      ? SESSION_PAUSE_REASONS.IDLE
      : SESSION_PAUSE_REASONS.UNFOCUSED;

    await pauseActiveSession(pauseReason, {
      browserFocused: context.browserFocused,
      idleState: context.idleState,
      now: context.now,
      reason: COMMIT_REASONS.PAUSE,
      settings: context.settings,
    });
    return;
  }

  if (!isTrackableTab(tab)) {
    await clearSession({
      browserFocused: context.browserFocused,
      commitBeforeClear: true,
      idleState: context.idleState,
      now: context.now,
      reason: COMMIT_REASONS.TAB_CHANGE,
      settings: context.settings,
    });
    return;
  }

  await commitActiveSession({
    browserFocused: context.browserFocused,
    idleState: context.idleState,
    now: context.now,
    reason: COMMIT_REASONS.TAB_CHANGE,
    settings: context.settings,
  });
  traceStorage('committed session before active tab change', {
    tabId,
    windowId,
  });

  await startSessionForContext(context, 'tabs.onActivated');
}

async function handleActiveTabUrlChange(tabId, nextUrl) {
  const nextHostname = extractHostnameFromUrl(nextUrl);
  const currentSession = await getActiveSession();

  if (activeTrackingSessionMatchesHostname(currentSession, tabId, nextHostname)) {
    return;
  }

  const tab = await getTab(tabId);

  if (!tab?.active) {
    return;
  }

  const context = await getTrackingContext({
    activeTab: tab,
    windowId: tab.windowId,
  });

  if (!isContextTrackable(context)) {
    const pauseReason = context.browserFocused
      ? SESSION_PAUSE_REASONS.IDLE
      : SESSION_PAUSE_REASONS.UNFOCUSED;

    await pauseActiveSession(pauseReason, {
      browserFocused: context.browserFocused,
      idleState: context.idleState,
      now: context.now,
      reason: COMMIT_REASONS.PAUSE,
      settings: context.settings,
    });
    return;
  }

  if (activeTrackingSessionMatchesHostname(currentSession, tabId, nextHostname)) {
    return;
  }

  if (!nextHostname) {
    await clearSession({
      browserFocused: context.browserFocused,
      commitBeforeClear: true,
      idleState: context.idleState,
      now: context.now,
      reason: COMMIT_REASONS.URL_CHANGE,
      settings: context.settings,
    });
    return;
  }

  await commitActiveSession({
    browserFocused: context.browserFocused,
    idleState: context.idleState,
    now: context.now,
    reason: COMMIT_REASONS.URL_CHANGE,
    settings: context.settings,
  });
  traceStorage('committed session before URL change', {
    nextHostname,
    tabId,
  });

  await startSessionForContext(context, 'tabs.onUpdated');
}

async function handleWindowFocusChanged(windowId) {
  if (!isWindowFocused(windowId)) {
    await pauseActiveSession(SESSION_PAUSE_REASONS.UNFOCUSED, {
      browserFocused: false,
      idleState: await queryIdleState(),
      now: Date.now(),
      reason: COMMIT_REASONS.PAUSE,
    });
    traceSession('paused session because Chrome lost focus', await getActiveSession());
    return;
  }

  const context = await getTrackingContext({ windowId });
  const currentSession = await getActiveSession();

  if (!isContextTrackable(context)) {
    const pauseReason = context.browserFocused
      ? SESSION_PAUSE_REASONS.IDLE
      : SESSION_PAUSE_REASONS.UNFOCUSED;

    await pauseActiveSession(pauseReason, {
      browserFocused: context.browserFocused,
      idleState: context.idleState,
      now: context.now,
      reason: COMMIT_REASONS.PAUSE,
      settings: context.settings,
    });
    return;
  }

  if (activeTrackingSessionMatchesTab(currentSession, context.activeTab)) {
    return;
  }

  await recoverFocusSession(context, 'windows.onFocusChanged');

  await startSessionForContext(context, 'windows.onFocusChanged');
}

async function handleIdleStateChanged(idleState) {
  if (idleState !== SESSION_IDLE_STATES.ACTIVE) {
    await pauseActiveSession(SESSION_PAUSE_REASONS.IDLE, {
      browserFocused: Boolean(await getFocusedWindow()),
      idleState,
      now: Date.now(),
      reason: COMMIT_REASONS.PAUSE,
    });
    traceSession('paused session because user became idle', await getActiveSession());
    return;
  }

  const context = await getTrackingContext({ idleState });
  const currentSession = await getActiveSession();

  if (!isContextTrackable(context)) {
    return;
  }

  if (activeTrackingSessionMatchesTab(currentSession, context.activeTab)) {
    return;
  }

  await recoverIdleSession(context, 'idle.onStateChanged');

  await startSessionForContext(context, 'idle.onStateChanged');
}

async function handleTabRemoved(tabId) {
  const currentSession = await getActiveSession();

  if (currentSession?.tabId !== tabId) {
    return;
  }

  await clearSession({
    commitBeforeClear: true,
    now: Date.now(),
    reason: COMMIT_REASONS.END,
  });
}

async function handleWindowRemoved(windowId) {
  const currentSession = await getActiveSession();

  if (currentSession?.windowId !== windowId) {
    return;
  }

  await clearSession({
    commitBeforeClear: true,
    now: Date.now(),
    reason: COMMIT_REASONS.END,
  });
}

function exposeDiagnosticsHelpers() {
  globalThis.productivityTrackerDiagnostics = Object.freeze({
    context: getTrackingContext,
    initialize: initializeAndValidateStorage,
    recover: () => recoverAndMaybeStart('diagnostics.recover'),
    setDebugConfig,
    setEventTracing: (enabled) =>
      setDebugConfig({
        enabled: Boolean(enabled),
        traceEvents: Boolean(enabled),
      }),
    getDebugConfig,
    snapshot: getTrackingSnapshot,
    today: getTodayTrackingSummary,
    validate: validateTrackingStorage,
  });
}

exposeDiagnosticsHelpers();

chromeApi.runtime.onInstalled.addListener((details) => {
  runTrackedEvent(`runtime.onInstalled:${details.reason}`, () =>
    handleRuntimeInstalled(details),
  );
});

chromeApi.runtime.onStartup.addListener(() => {
  runTrackedEvent('runtime.onStartup', handleRuntimeStartup);
});

chromeApi.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (!isExtensionMessage(message)) {
    return false;
  }

  if (message.type === MESSAGE_TYPES.GET_LIVE_TRACKING_STATE) {
    runReadOnlyMessageEvent(
      'runtime.onMessage:get-live-tracking-state',
      async () => {
        const snapshot = await getLiveSessionSnapshot();

        scheduleLiveStateRecovery('runtime.onMessage.live-tracking-state');

        return snapshot;
      },
      sendResponse,
    );
    return true;
  }

  if (message.type === MESSAGE_TYPES.SET_TRACKING_ENABLED) {
    runMessageEvent(
      'runtime.onMessage:set-tracking-enabled',
      () => setTrackingEnabledFromPopup(message.payload?.enabled),
      sendResponse,
    );
    return true;
  }

  return false;
});

chromeApi.tabs.onActivated.addListener((activeInfo) => {
  runTrackedEvent('tabs.onActivated', () =>
    handleActiveTabChange(activeInfo.tabId, activeInfo.windowId),
  );
});

chromeApi.tabs.onUpdated.addListener((tabId, changeInfo) => {
  if (!changeInfo.url) {
    return;
  }

  runTrackedEvent('tabs.onUpdated', () =>
    handleActiveTabUrlChange(tabId, changeInfo.url),
  );
});

chromeApi.tabs.onRemoved.addListener((tabId) => {
  runTrackedEvent('tabs.onRemoved', () => handleTabRemoved(tabId));
});

chromeApi.windows.onFocusChanged.addListener((windowId) => {
  runTrackedEvent('windows.onFocusChanged', () =>
    handleWindowFocusChanged(windowId),
  );
});

chromeApi.windows.onRemoved.addListener((windowId) => {
  runTrackedEvent('windows.onRemoved', () => handleWindowRemoved(windowId));
});

if (chromeApi.idle?.onStateChanged) {
  chromeApi.idle.onStateChanged.addListener((idleState) => {
    runTrackedEvent('idle.onStateChanged', () =>
      handleIdleStateChanged(idleState),
    );
  });
}
