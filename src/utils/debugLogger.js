const DEBUG_STORAGE_KEY = 'debugSettings';
const DEFAULT_NAMESPACE = 'Productivity Tracker';

let debugState = {
  enabled: false,
  traceEvents: false,
  traceStorage: false,
  traceSessions: false,
};

function normalizeDebugConfig(config = {}) {
  return {
    enabled: Boolean(config.enabled),
    traceEvents: Boolean(config.traceEvents),
    traceStorage: Boolean(config.traceStorage),
    traceSessions: Boolean(config.traceSessions),
  };
}

function getChromeStorage() {
  return globalThis.chrome?.storage?.local ?? null;
}

function timestamp() {
  return new Date().toLocaleTimeString();
}

function prefix(scope) {
  return `[${DEFAULT_NAMESPACE}]${scope ? ` ${scope}` : ''}`;
}

function getSessionSummary(session) {
  if (!session) {
    return null;
  }

  return {
    domain: session.domain,
    category: session.category,
    tabId: session.tabId,
    status: session.status,
    isTracking: session.isTracking,
    pauseReason: session.pauseReason,
    startedAt: session.startedAt
      ? new Date(session.startedAt).toLocaleString()
      : null,
    lastCommittedAt: session.lastCommittedAt
      ? new Date(session.lastCommittedAt).toLocaleString()
      : null,
  };
}

export function getDebugConfig() {
  return { ...debugState };
}

export async function loadDebugConfig() {
  const storage = getChromeStorage();

  if (!storage) {
    return getDebugConfig();
  }

  const data = await storage.get(DEBUG_STORAGE_KEY);
  const savedSettings = data[DEBUG_STORAGE_KEY];

  if (savedSettings && typeof savedSettings === 'object') {
    debugState = normalizeDebugConfig({
      ...debugState,
      ...savedSettings,
    });
  }

  return getDebugConfig();
}

export async function setDebugConfig(nextConfig = {}) {
  debugState = normalizeDebugConfig({
    ...debugState,
    ...nextConfig,
  });

  const storage = getChromeStorage();

  if (storage) {
    await storage.set({
      [DEBUG_STORAGE_KEY]: debugState,
    });
  }

  return getDebugConfig();
}

export function logInfo(message, data, options = {}) {
  const shouldLog = options.force || debugState.enabled;

  if (!shouldLog) {
    return;
  }

  if (data === undefined) {
    console.info(`${prefix(options.scope)} ${timestamp()} ${message}`);
    return;
  }

  console.info(`${prefix(options.scope)} ${timestamp()} ${message}`, data);
}

export function logError(message, error, options = {}) {
  console.error(`${prefix(options.scope)} ${timestamp()} ${message}`, error);
}

export function traceEvent(message, data) {
  if (!debugState.enabled || !debugState.traceEvents) {
    return;
  }

  logInfo(message, data, { scope: 'event', force: true });
}

export function traceStorage(message, data) {
  if (!debugState.enabled || !debugState.traceStorage) {
    return;
  }

  logInfo(message, data, { scope: 'storage', force: true });
}

export function traceSession(message, session, extra = {}) {
  if (!debugState.enabled || !debugState.traceSessions) {
    return;
  }

  logInfo(
    message,
    {
      session: getSessionSummary(session),
      ...extra,
    },
    { scope: 'session', force: true },
  );
}

export function createEventTrace(label) {
  const startedAt = Date.now();

  traceEvent(`started: ${label}`);

  return {
    finish(data) {
      traceEvent(`finished: ${label}`, {
        durationMs: Date.now() - startedAt,
        ...data,
      });
    },
    fail(error) {
      logError(
        `failed: ${label}`,
        {
          durationMs: Date.now() - startedAt,
          error,
        },
        { scope: 'event' },
      );
    },
  };
}
