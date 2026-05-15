import {
  summarizeSitesForDay,
  validateTrackingStorage,
} from '../utils/diagnostics.js';
import {
  MESSAGE_TYPES,
} from '../utils/messages.js';
import {
  requestLiveTrackingState,
  sendRuntimeMessage,
} from '../utils/runtimeMessaging.js';
import {
  getActiveSession,
  getDailyStats,
  getDateKey,
  getSettings,
} from '../utils/storage.js';
import {
  EMPTY_TOTALS,
  formatTrackedTime,
} from './popupMetrics.js';

const DEFAULT_POPUP_SETTINGS = Object.freeze({
  trackingEnabled: true,
  maxSessionGapSeconds: 300,
});

const DEFAULT_CONTEXT = Object.freeze({
  browserFocused: null,
  idleState: 'active',
  activeTab: null,
});

const TRANSIENT_LIVE_STATE_ERRORS = [
  'message port closed',
  'receiving end does not exist',
  'extension context invalidated',
  'timed out',
];

function getErrorMessage(error) {
  return error instanceof Error ? error.message : String(error);
}

function isTransientLiveStateError(error) {
  const message = getErrorMessage(error).toLowerCase();

  return TRANSIENT_LIVE_STATE_ERRORS.some((expectedMessage) =>
    message.includes(expectedMessage),
  );
}

function createTotalsFromDay(dayStats) {
  if (!dayStats) {
    return { ...EMPTY_TOTALS };
  }

  return {
    totalSeconds: Number(dayStats.totalSeconds) || 0,
    productiveSeconds: Number(dayStats.productiveSeconds) || 0,
    unproductiveSeconds: Number(dayStats.unproductiveSeconds) || 0,
    neutralSeconds: Number(dayStats.neutralSeconds) || 0,
  };
}

function formatSitesForPopup(dayStats) {
  return summarizeSitesForDay(dayStats).map((site) => ({
    ...site,
    time: formatTrackedTime(dayStats?.sites?.[site.domain]?.seconds),
  }));
}

function createEmptyPopupState(error = null) {
  return {
    generatedAt: Date.now(),
    today: {
      todayKey: getDateKey(),
      activeSession: null,
      settings: { ...DEFAULT_POPUP_SETTINGS },
      totals: { ...EMPTY_TOTALS },
      sites: [],
    },
    validation: {
      isValid: true,
      errors: [],
      warnings: [],
      summary: {},
    },
    context: { ...DEFAULT_CONTEXT },
    error,
  };
}

async function readCommittedAnalyticsFromStorage() {
  const [dailyStats, settings, validation] = await Promise.all([
    getDailyStats(),
    getSettings(),
    validateTrackingStorage(),
  ]);
  const activeSession = await getActiveSession();
  const todayKey = getDateKey();
  const todayStats = dailyStats[todayKey] ?? null;

  return {
    activeSession,
    todayKey,
    settings,
    totals: createTotalsFromDay(todayStats),
    sites: formatSitesForPopup(todayStats),
    validation,
  };
}

async function requestLiveSessionState() {
  return requestLiveTrackingState();
}

function mergePopupState(committedAnalytics, liveSessionState, error = null) {
  return {
    generatedAt: Date.now(),
    today: {
      todayKey: committedAnalytics.todayKey,
      activeSession:
        liveSessionState?.activeSession ?? committedAnalytics.activeSession ?? null,
      settings: committedAnalytics.settings,
      totals: committedAnalytics.totals,
      sites: committedAnalytics.sites,
    },
    validation: committedAnalytics.validation,
    context: liveSessionState?.context ?? { ...DEFAULT_CONTEXT },
    error,
  };
}

export async function requestPopupState() {
  let committedAnalytics;

  try {
    committedAnalytics = await readCommittedAnalyticsFromStorage();
  } catch (storageError) {
    return createEmptyPopupState(
      `Unable to load stored analytics: ${getErrorMessage(storageError)}`,
    );
  }

  try {
    const liveSessionState = await requestLiveSessionState();

    return mergePopupState(committedAnalytics, liveSessionState);
  } catch (messageError) {
    return mergePopupState(
      committedAnalytics,
      null,
      isTransientLiveStateError(messageError)
        ? null
        : `Live session unavailable: ${getErrorMessage(messageError)}`,
    );
  }
}

export async function updateTrackingEnabled(enabled) {
  let liveSessionState;

  try {
    liveSessionState = await sendRuntimeMessage(
      MESSAGE_TYPES.SET_TRACKING_ENABLED,
      { enabled },
    );
  } catch (messageError) {
    throw new Error(`Unable to update tracking setting: ${getErrorMessage(messageError)}`, {
      cause: messageError,
    });
  }

  try {
    const committedAnalytics = await readCommittedAnalyticsFromStorage();

    return mergePopupState(committedAnalytics, liveSessionState);
  } catch (storageError) {
    return createEmptyPopupState(
      `Tracking setting changed, but analytics could not reload: ${getErrorMessage(storageError)}`,
    );
  }
}
