import {
  extractHostnameFromUrl,
  isValidCategory,
} from './categorize.js';
import {
  STORAGE_KEYS,
  STORAGE_SCHEMA_VERSION,
  getDateKey,
  normalizeDailyStats,
  normalizeSettings,
} from './storage.js';

const CATEGORY_TOTAL_FIELDS = Object.freeze([
  'productiveSeconds',
  'unproductiveSeconds',
  'neutralSeconds',
]);

const DAY_TOTAL_FIELDS = Object.freeze([
  'totalSeconds',
  ...CATEGORY_TOTAL_FIELDS,
]);

const CLOCK_SKEW_TOLERANCE_MS = 5000;

function isPlainObject(value) {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function isNonNegativeNumber(value) {
  return Number.isFinite(value) && value >= 0;
}

function createReport(summary = {}) {
  return {
    isValid: true,
    errors: [],
    warnings: [],
    summary,
  };
}

function addError(report, path, message) {
  report.errors.push({ path, message });
  report.isValid = false;
}

function addWarning(report, path, message) {
  report.warnings.push({ path, message });
}

function mergeReport(target, source) {
  target.errors.push(...source.errors);
  target.warnings.push(...source.warnings);

  if (!source.isValid) {
    target.isValid = false;
  }
}

function getSafeNumber(value) {
  return Number.isFinite(value) ? value : 0;
}

function validateSecondField(report, object, field, path) {
  if (!isNonNegativeNumber(object?.[field])) {
    addError(report, `${path}.${field}`, 'Expected a non-negative number.');
    return;
  }

  if (!Number.isInteger(object[field])) {
    addWarning(report, `${path}.${field}`, 'Expected whole seconds.');
  }
}

function validateTimestamp(report, value, path, now) {
  if (!Number.isFinite(value) || value <= 0) {
    addError(report, path, 'Expected a positive timestamp.');
    return;
  }

  if (value > now + CLOCK_SKEW_TOLERANCE_MS) {
    addWarning(report, path, 'Timestamp is in the future.');
  }
}

export function validateActiveSession(session, options = {}) {
  const now = options.now ?? Date.now();
  const report = createReport({
    hasSession: Boolean(session),
    domain: session?.domain ?? null,
    isTracking: Boolean(session?.isTracking),
  });

  if (session === null || session === undefined) {
    return report;
  }

  if (!isPlainObject(session)) {
    addError(report, 'activeSession', 'Expected null or a session object.');
    return report;
  }

  if (typeof session.domain !== 'string' || !session.domain) {
    addError(report, 'activeSession.domain', 'Expected a domain string.');
  }

  if (!isValidCategory(session.category)) {
    addError(
      report,
      'activeSession.category',
      'Expected productive, unproductive, or neutral.',
    );
  }

  validateTimestamp(report, session.startedAt, 'activeSession.startedAt', now);
  validateTimestamp(
    report,
    session.lastCommittedAt,
    'activeSession.lastCommittedAt',
    now,
  );

  if (
    Number.isFinite(session.startedAt) &&
    Number.isFinite(session.lastCommittedAt) &&
    session.lastCommittedAt + CLOCK_SKEW_TOLERANCE_MS < session.startedAt
  ) {
    addError(
      report,
      'activeSession.lastCommittedAt',
      'lastCommittedAt cannot be before startedAt.',
    );
  }

  if (typeof session.isTracking !== 'boolean') {
    addError(
      report,
      'activeSession.isTracking',
      'Expected a boolean tracking flag.',
    );
  }

  if (session.isTracking && session.status !== 'active') {
    addWarning(
      report,
      'activeSession.status',
      'Tracking sessions should have status "active".',
    );
  }

  if (!session.isTracking && session.status !== 'paused') {
    addWarning(
      report,
      'activeSession.status',
      'Paused sessions should have status "paused".',
    );
  }

  const urlHostname = extractHostnameFromUrl(session.url);

  if (urlHostname && session.domain && urlHostname !== session.domain) {
    addWarning(
      report,
      'activeSession.url',
      'Session URL hostname does not match stored domain.',
    );
  }

  return report;
}

export function validateDayStats(dateKey, dayStats) {
  const report = createReport({
    dateKey,
    totalSeconds: getSafeNumber(dayStats?.totalSeconds),
    siteCount: isPlainObject(dayStats?.sites)
      ? Object.keys(dayStats.sites).length
      : 0,
  });

  if (!isPlainObject(dayStats)) {
    addError(report, `dailyStats.${dateKey}`, 'Expected a day stats object.');
    return report;
  }

  if (dayStats.date !== dateKey) {
    addWarning(
      report,
      `dailyStats.${dateKey}.date`,
      'Date field does not match storage key.',
    );
  }

  for (const field of DAY_TOTAL_FIELDS) {
    validateSecondField(report, dayStats, field, `dailyStats.${dateKey}`);
  }

  const categoryTotal = CATEGORY_TOTAL_FIELDS.reduce(
    (sum, field) => sum + getSafeNumber(dayStats[field]),
    0,
  );

  if (categoryTotal !== getSafeNumber(dayStats.totalSeconds)) {
    addError(
      report,
      `dailyStats.${dateKey}.totalSeconds`,
      'Category totals do not add up to totalSeconds.',
    );
  }

  if (!isPlainObject(dayStats.sites)) {
    addError(report, `dailyStats.${dateKey}.sites`, 'Expected a sites object.');
    return report;
  }

  let siteSecondsTotal = 0;

  for (const [domain, siteStats] of Object.entries(dayStats.sites)) {
    const sitePath = `dailyStats.${dateKey}.sites.${domain}`;

    if (!isPlainObject(siteStats)) {
      addError(report, sitePath, 'Expected a site stats object.');
      continue;
    }

    if (siteStats.domain !== domain) {
      addWarning(report, `${sitePath}.domain`, 'Domain does not match key.');
    }

    if (!isValidCategory(siteStats.category)) {
      addError(
        report,
        `${sitePath}.category`,
        'Expected productive, unproductive, or neutral.',
      );
    }

    validateSecondField(report, siteStats, 'seconds', sitePath);

    if (!isNonNegativeNumber(siteStats.visits)) {
      addError(report, `${sitePath}.visits`, 'Expected non-negative visits.');
    }

    siteSecondsTotal += getSafeNumber(siteStats.seconds);
  }

  if (siteSecondsTotal !== getSafeNumber(dayStats.totalSeconds)) {
    addWarning(
      report,
      `dailyStats.${dateKey}.sites`,
      'Site seconds do not add up to totalSeconds.',
    );
  }

  return report;
}

export function validateDailyStats(dailyStats) {
  const normalizedDailyStats = normalizeDailyStats(dailyStats);
  const report = createReport({
    dayCount: Object.keys(normalizedDailyStats).length,
    totalSeconds: 0,
  });

  if (dailyStats !== normalizedDailyStats) {
    addError(report, 'dailyStats', 'Expected a plain object.');
    return report;
  }

  for (const [dateKey, dayStats] of Object.entries(normalizedDailyStats)) {
    const dayReport = validateDayStats(dateKey, dayStats);

    report.summary.totalSeconds += getSafeNumber(dayStats?.totalSeconds);
    mergeReport(report, dayReport);
  }

  return report;
}

export function validateStorageSnapshot(snapshot, options = {}) {
  const now = options.now ?? Date.now();
  const report = createReport({
    capturedAt: now,
    todayKey: getDateKey(new Date(now)),
    dayCount: 0,
    totalTrackedSeconds: 0,
    hasActiveSession: Boolean(snapshot?.[STORAGE_KEYS.ACTIVE_SESSION]),
  });

  if (!isPlainObject(snapshot)) {
    addError(report, 'storage', 'Expected a storage snapshot object.');
    return report;
  }

  const appMeta = snapshot[STORAGE_KEYS.APP_META];

  if (!isPlainObject(appMeta)) {
    addError(report, STORAGE_KEYS.APP_META, 'Missing app metadata.');
  } else if (appMeta.schemaVersion !== STORAGE_SCHEMA_VERSION) {
    addWarning(
      report,
      `${STORAGE_KEYS.APP_META}.schemaVersion`,
      'Unexpected storage schema version.',
    );
  }

  normalizeSettings(snapshot[STORAGE_KEYS.SETTINGS]);

  const dailyStatsReport = validateDailyStats(
    snapshot[STORAGE_KEYS.DAILY_STATS],
  );
  const activeSessionReport = validateActiveSession(
    snapshot[STORAGE_KEYS.ACTIVE_SESSION],
    { now },
  );

  report.summary.dayCount = dailyStatsReport.summary.dayCount;
  report.summary.totalTrackedSeconds =
    dailyStatsReport.summary.totalSeconds;

  mergeReport(report, dailyStatsReport);
  mergeReport(report, activeSessionReport);

  return report;
}
