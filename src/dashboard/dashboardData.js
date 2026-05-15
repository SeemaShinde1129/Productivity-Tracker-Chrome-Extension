import {
  initializeStorage,
  STORAGE_KEYS,
} from '../utils/storage.js';
import { requestLiveTrackingState } from '../utils/runtimeMessaging.js';
import { createDashboardAnalytics } from './dashboardAnalytics.js';

const DASHBOARD_DATA_TIMEOUT_MS = 5000;

export const DASHBOARD_REFRESH_KEYS = new Set([
  STORAGE_KEYS.ACTIVE_SESSION,
  STORAGE_KEYS.DAILY_STATS,
  STORAGE_KEYS.SETTINGS,
]);

function withTimeout(operation, label, timeoutMs = DASHBOARD_DATA_TIMEOUT_MS) {
  return Promise.race([
    operation,
    new Promise((_, reject) => {
      setTimeout(() => {
        reject(new Error(`${label} timed out after ${timeoutMs}ms.`));
      }, timeoutMs);
    }),
  ]);
}

async function loadLiveTrackingState() {
  try {
    return {
      error: null,
      state: await requestLiveTrackingState(),
    };
  } catch (error) {
    return {
      error: error instanceof Error ? error.message : String(error),
      state: null,
    };
  }
}

export async function loadDashboardState() {
  const [snapshot, liveTracking] = await Promise.all([
    withTimeout(
      initializeStorage(),
      'Dashboard storage initialization',
    ),
    loadLiveTrackingState(),
  ]);

  const analytics = createDashboardAnalytics({
    dailyStats: snapshot[STORAGE_KEYS.DAILY_STATS],
    now: new Date(),
  });

  return {
    activeSession:
      liveTracking.state?.activeSession ?? snapshot[STORAGE_KEYS.ACTIVE_SESSION],
    analytics,
    context: liveTracking.state?.context ?? null,
    generatedAt: Date.now(),
    liveError: liveTracking.error,
    settings: snapshot[STORAGE_KEYS.SETTINGS],
  };
}

export function shouldRefreshDashboardData(changes, areaName) {
  if (areaName !== 'local') {
    return false;
  }

  return Object.keys(changes).some((key) => DASHBOARD_REFRESH_KEYS.has(key));
}
