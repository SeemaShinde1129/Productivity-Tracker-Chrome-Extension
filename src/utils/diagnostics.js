import {
  getActiveSession,
  getDailyStats,
  getDateKey,
  getSettings,
  getStorageSnapshot,
  initializeStorage,
} from './storage.js';
import { validateStorageSnapshot } from './validation.js';

export function formatDuration(seconds = 0) {
  const safeSeconds = Number.isFinite(seconds) ? Math.max(0, seconds) : 0;
  const minutes = Math.floor(safeSeconds / 60);
  const remainingSeconds = safeSeconds % 60;

  return `${minutes}m ${remainingSeconds}s`;
}

export function summarizeDailyStats(dailyStats = {}) {
  return Object.entries(dailyStats).map(([dateKey, dayStats]) => ({
    date: dateKey,
    total: formatDuration(dayStats.totalSeconds),
    productive: formatDuration(dayStats.productiveSeconds),
    unproductive: formatDuration(dayStats.unproductiveSeconds),
    neutral: formatDuration(dayStats.neutralSeconds),
    sites: Object.keys(dayStats.sites ?? {}).length,
  }));
}

export function summarizeSitesForDay(dayStats) {
  return Object.entries(dayStats?.sites ?? {})
    .map(([domain, siteStats]) => ({
      domain,
      category: siteStats.category,
      time: formatDuration(siteStats.seconds),
      visits: siteStats.visits,
      lastVisitedAt: siteStats.lastVisitedAt
        ? new Date(siteStats.lastVisitedAt).toLocaleString()
        : null,
    }))
    .sort((a, b) => b.visits - a.visits);
}

export async function getTrackingSnapshot() {
  const snapshot = await getStorageSnapshot();
  const validation = validateStorageSnapshot(snapshot);

  return {
    capturedAt: Date.now(),
    todayKey: getDateKey(),
    snapshot,
    validation,
    dailySummary: summarizeDailyStats(snapshot.dailyStats),
  };
}

export async function validateTrackingStorage() {
  const snapshot = await getStorageSnapshot();

  return validateStorageSnapshot(snapshot);
}

export async function getTodayTrackingSummary() {
  const dailyStats = await getDailyStats();
  const todayKey = getDateKey();
  const todayStats = dailyStats[todayKey] ?? null;

  return {
    todayKey,
    activeSession: await getActiveSession(),
    settings: await getSettings(),
    totals: todayStats
      ? {
          totalSeconds: todayStats.totalSeconds,
          productiveSeconds: todayStats.productiveSeconds,
          unproductiveSeconds: todayStats.unproductiveSeconds,
          neutralSeconds: todayStats.neutralSeconds,
          total: formatDuration(todayStats.totalSeconds),
          productive: formatDuration(todayStats.productiveSeconds),
          unproductive: formatDuration(todayStats.unproductiveSeconds),
          neutral: formatDuration(todayStats.neutralSeconds),
        }
      : null,
    sites: summarizeSitesForDay(todayStats),
  };
}

export async function initializeAndValidateStorage() {
  await initializeStorage();

  return getTrackingSnapshot();
}
