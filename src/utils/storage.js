export const STORAGE_SCHEMA_VERSION = 1;

export const STORAGE_KEYS = Object.freeze({
  APP_META: 'appMeta',
  SETTINGS: 'settings',
  DAILY_STATS: 'dailyStats',
  ACTIVE_SESSION: 'activeSession',
});

export const DEFAULT_SETTINGS = Object.freeze({
  trackingEnabled: true,
  idleThresholdSeconds: 60,
  maxSessionGapSeconds: 300,
  weekStartsOn: 'monday',
  ignoredDomains: [],
  categoryOverrides: {},
});

const STORAGE_UNAVAILABLE_MESSAGE =
  'chrome.storage.local is not available. Load the extension in Chrome or provide a test mock.';

let storageWriteQueue = Promise.resolve();

function getStorageArea() {
  const storageArea = globalThis.chrome?.storage?.local;

  if (!storageArea) {
    throw new Error(STORAGE_UNAVAILABLE_MESSAGE);
  }

  return storageArea;
}

function getErrorMessage(error) {
  if (error instanceof Error) {
    return error.message;
  }

  return String(error);
}

function cloneJson(value) {
  return JSON.parse(JSON.stringify(value));
}

function hasStorageKey(object, key) {
  return Object.prototype.hasOwnProperty.call(object, key);
}

function isPlainObject(value) {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function enqueueStorageWrite(operation) {
  const queuedOperation = storageWriteQueue.then(operation, operation);

  storageWriteQueue = queuedOperation.catch(() => {});

  return queuedOperation;
}

export function getDateKey(date = new Date()) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');

  return `${year}-${month}-${day}`;
}

export function createDefaultAppMeta(now = Date.now()) {
  return {
    schemaVersion: STORAGE_SCHEMA_VERSION,
    installedAt: now,
    updatedAt: now,
  };
}

export function createDefaultDayStats(dateKey = getDateKey()) {
  return {
    date: dateKey,
    totalSeconds: 0,
    productiveSeconds: 0,
    unproductiveSeconds: 0,
    neutralSeconds: 0,
    sites: {},
  };
}

export function createDefaultSiteStats(domain, category = 'neutral') {
  return {
    domain,
    category,
    seconds: 0,
    visits: 0,
    lastVisitedAt: null,
  };
}

export function normalizeSettings(settings = {}) {
  const safeSettings = settings && typeof settings === 'object' ? settings : {};

  return {
    ...cloneJson(DEFAULT_SETTINGS),
    ...safeSettings,
    ignoredDomains: Array.isArray(safeSettings.ignoredDomains)
      ? safeSettings.ignoredDomains
      : [],
    categoryOverrides: isPlainObject(safeSettings.categoryOverrides)
      ? safeSettings.categoryOverrides
      : {},
  };
}

export function normalizeDailyStats(dailyStats = {}) {
  return isPlainObject(dailyStats) ? dailyStats : {};
}

export async function readStorage(keys = null) {
  try {
    return await getStorageArea().get(keys);
  } catch (error) {
    throw new Error(`Failed to read extension storage: ${getErrorMessage(error)}`, {
      cause: error,
    });
  }
}

export async function writeStorage(items) {
  try {
    await getStorageArea().set(items);
    return items;
  } catch (error) {
    throw new Error(`Failed to write extension storage: ${getErrorMessage(error)}`, {
      cause: error,
    });
  }
}

export async function removeStorage(keys) {
  try {
    await getStorageArea().remove(keys);
  } catch (error) {
    throw new Error(`Failed to remove extension storage: ${getErrorMessage(error)}`, {
      cause: error,
    });
  }
}

export async function clearStorage() {
  try {
    await getStorageArea().clear();
  } catch (error) {
    throw new Error(`Failed to clear extension storage: ${getErrorMessage(error)}`, {
      cause: error,
    });
  }
}

export async function getStorageSnapshot() {
  const data = await readStorage(Object.values(STORAGE_KEYS));

  return {
    [STORAGE_KEYS.APP_META]:
      data[STORAGE_KEYS.APP_META] ?? createDefaultAppMeta(),
    [STORAGE_KEYS.SETTINGS]: normalizeSettings(data[STORAGE_KEYS.SETTINGS]),
    [STORAGE_KEYS.DAILY_STATS]: normalizeDailyStats(
      data[STORAGE_KEYS.DAILY_STATS],
    ),
    [STORAGE_KEYS.ACTIVE_SESSION]: data[STORAGE_KEYS.ACTIVE_SESSION] ?? null,
  };
}

export async function initializeStorage() {
  const now = Date.now();
  const data = await readStorage(Object.values(STORAGE_KEYS));
  const updates = {};

  const appMeta = data[STORAGE_KEYS.APP_META];
  const settings = data[STORAGE_KEYS.SETTINGS];
  const dailyStats = data[STORAGE_KEYS.DAILY_STATS];

  if (!appMeta || appMeta.schemaVersion !== STORAGE_SCHEMA_VERSION) {
    updates[STORAGE_KEYS.APP_META] = {
      ...createDefaultAppMeta(now),
      installedAt: appMeta?.installedAt ?? now,
    };
  }

  if (!settings) {
    updates[STORAGE_KEYS.SETTINGS] = cloneJson(DEFAULT_SETTINGS);
  } else {
    const normalizedSettings = normalizeSettings(settings);

    if (JSON.stringify(settings) !== JSON.stringify(normalizedSettings)) {
      updates[STORAGE_KEYS.SETTINGS] = normalizedSettings;
    }
  }

  if (!isPlainObject(dailyStats)) {
    updates[STORAGE_KEYS.DAILY_STATS] = {};
  }

  if (!hasStorageKey(data, STORAGE_KEYS.ACTIVE_SESSION)) {
    updates[STORAGE_KEYS.ACTIVE_SESSION] = null;
  }

  if (Object.keys(updates).length > 0) {
    await writeStorage(updates);
  }

  return getStorageSnapshot();
}

export async function getSettings() {
  const data = await readStorage(STORAGE_KEYS.SETTINGS);

  return normalizeSettings(data[STORAGE_KEYS.SETTINGS]);
}

export async function saveSettings(partialSettings) {
  return enqueueStorageWrite(async () => {
    const currentSettings = await getSettings();
    const nextSettings = normalizeSettings({
      ...currentSettings,
      ...partialSettings,
    });

    await writeStorage({
      [STORAGE_KEYS.SETTINGS]: nextSettings,
    });

    return nextSettings;
  });
}

export async function getDailyStats() {
  const data = await readStorage(STORAGE_KEYS.DAILY_STATS);

  return normalizeDailyStats(data[STORAGE_KEYS.DAILY_STATS]);
}

export async function saveDailyStats(dailyStats) {
  const nextDailyStats = normalizeDailyStats(dailyStats);

  await writeStorage({
    [STORAGE_KEYS.DAILY_STATS]: nextDailyStats,
  });

  return nextDailyStats;
}

export async function updateDailyStats(updater) {
  if (typeof updater !== 'function') {
    throw new TypeError('updateDailyStats requires an updater function.');
  }

  return enqueueStorageWrite(async () => {
    const currentDailyStats = await getDailyStats();
    const nextDailyStats = updater(cloneJson(currentDailyStats));
    const normalizedDailyStats = normalizeDailyStats(nextDailyStats);

    await writeStorage({
      [STORAGE_KEYS.DAILY_STATS]: normalizedDailyStats,
    });

    return normalizedDailyStats;
  });
}

export async function getDayStats(dateKey = getDateKey()) {
  const dailyStats = await getDailyStats();

  return dailyStats[dateKey] ?? createDefaultDayStats(dateKey);
}

export async function saveDayStats(dateKey, dayStats) {
  return enqueueStorageWrite(async () => {
    const dailyStats = await getDailyStats();
    const nextDayStats = {
      ...createDefaultDayStats(dateKey),
      ...dayStats,
      date: dateKey,
      sites: dayStats?.sites ?? {},
    };

    const nextDailyStats = {
      ...dailyStats,
      [dateKey]: nextDayStats,
    };

    await saveDailyStats(nextDailyStats);

    return nextDayStats;
  });
}

export async function updateDayStats(dateKey, updater) {
  return enqueueStorageWrite(async () => {
    const dailyStats = await getDailyStats();
    const currentDayStats =
      dailyStats[dateKey] ?? createDefaultDayStats(dateKey);
    const nextDayStats = updater(cloneJson(currentDayStats));

    const normalizedDayStats = {
      ...createDefaultDayStats(dateKey),
      ...nextDayStats,
      date: dateKey,
      sites: nextDayStats?.sites ?? {},
    };

    await saveDailyStats({
      ...dailyStats,
      [dateKey]: normalizedDayStats,
    });

    return normalizedDayStats;
  });
}

export async function getActiveSession() {
  const data = await readStorage(STORAGE_KEYS.ACTIVE_SESSION);

  return data[STORAGE_KEYS.ACTIVE_SESSION] ?? null;
}

export async function setActiveSession(session) {
  const nextSession = session ? { ...session } : null;

  await writeStorage({
    [STORAGE_KEYS.ACTIVE_SESSION]: nextSession,
  });

  return nextSession;
}

export async function saveActiveSession(session) {
  return setActiveSession(session);
}

export async function clearActiveSession() {
  return setActiveSession(null);
}

export async function resetTrackingData() {
  const updates = {
    [STORAGE_KEYS.DAILY_STATS]: {},
    [STORAGE_KEYS.ACTIVE_SESSION]: null,
  };

  await writeStorage(updates);

  return updates;
}
