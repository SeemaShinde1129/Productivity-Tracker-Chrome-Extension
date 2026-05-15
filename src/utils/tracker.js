import {
  DEFAULT_CATEGORY,
  WEBSITE_CATEGORIES,
  categorizeWebsite,
  extractHostnameFromUrl,
  isDomainMatch,
  isValidCategory,
} from './categorize.js';
import {
  DEFAULT_SETTINGS,
  clearActiveSession,
  createDefaultDayStats,
  createDefaultSiteStats,
  getActiveSession,
  getDateKey,
  getSettings,
  normalizeSettings,
  setActiveSession,
  updateDailyStats,
} from './storage.js';

export const SESSION_STATUS = Object.freeze({
  ACTIVE: 'active',
  PAUSED: 'paused',
});

export const SESSION_PAUSE_REASONS = Object.freeze({
  DISABLED: 'disabled',
  IGNORED_DOMAIN: 'ignored-domain',
  IDLE: 'idle',
  STALE_SESSION: 'stale-session',
  UNFOCUSED: 'unfocused',
  UNTRACKABLE_URL: 'untrackable-url',
  MANUAL: 'manual',
});

export const SESSION_IDLE_STATES = Object.freeze({
  ACTIVE: 'active',
  IDLE: 'idle',
  LOCKED: 'locked',
});

export const COMMIT_REASONS = Object.freeze({
  PERIODIC: 'periodic',
  TAB_CHANGE: 'tab-change',
  URL_CHANGE: 'url-change',
  PAUSE: 'pause',
  END: 'end',
  RECOVERY: 'recovery',
});

export const RECOVERY_ACTIONS = Object.freeze({
  NONE: 'none',
  KEEP: 'keep',
  COMMIT: 'commit',
  PAUSE: 'pause',
  CLEAR: 'clear',
});

const SECOND_IN_MS = 1000;
const CLOCK_SKEW_TOLERANCE_MS = 5000;
const DEFAULT_MAX_SESSION_GAP_SECONDS = DEFAULT_SETTINGS.maxSessionGapSeconds;

const CATEGORY_TOTAL_FIELDS = Object.freeze({
  [WEBSITE_CATEGORIES.PRODUCTIVE]: 'productiveSeconds',
  [WEBSITE_CATEGORIES.UNPRODUCTIVE]: 'unproductiveSeconds',
  [WEBSITE_CATEGORIES.NEUTRAL]: 'neutralSeconds',
});

function isPlainObject(value) {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function isValidTimestamp(timestamp) {
  return Number.isFinite(timestamp) && timestamp > 0;
}

function resolveNow(now = Date.now()) {
  return Number.isFinite(now) ? now : Date.now();
}

function resolveSessionStartPoint(session) {
  if (isValidTimestamp(session?.lastCommittedAt)) {
    return session.lastCommittedAt;
  }

  if (isValidTimestamp(session?.startedAt)) {
    return session.startedAt;
  }

  return null;
}

function getCategoryTotalField(category) {
  return CATEGORY_TOTAL_FIELDS[category] ?? CATEGORY_TOTAL_FIELDS.neutral;
}

function getSafeNumber(value) {
  return Number.isFinite(value) ? value : 0;
}

function getSessionCategory(category) {
  return isValidCategory(category) ? category : DEFAULT_CATEGORY;
}

function getDomainFromTab(tab) {
  return extractHostnameFromUrl(tab?.url);
}

function getTabId(tab) {
  return tab?.tabId ?? tab?.id ?? null;
}

function getWindowId(tab) {
  return tab?.windowId ?? null;
}

function getElapsedSeconds(fromTimestamp, toTimestamp) {
  if (!isValidTimestamp(fromTimestamp) || !isValidTimestamp(toTimestamp)) {
    return 0;
  }

  return Math.max(0, Math.floor((toTimestamp - fromTimestamp) / SECOND_IN_MS));
}

function getMaxSessionGapSeconds(settings = {}) {
  const normalizedSettings = normalizeSettings(settings);
  const configuredGap = normalizedSettings.maxSessionGapSeconds;

  if (!Number.isFinite(configuredGap) || configuredGap <= 0) {
    return DEFAULT_MAX_SESSION_GAP_SECONDS;
  }

  return configuredGap;
}

function getBrowserFocused(options = {}) {
  return options.browserFocused !== false;
}

function getIdleState(options = {}) {
  const idleState = options.idleState ?? SESSION_IDLE_STATES.ACTIVE;

  if (Object.values(SESSION_IDLE_STATES).includes(idleState)) {
    return idleState;
  }

  return SESSION_IDLE_STATES.ACTIVE;
}

function isIgnoredDomain(domain, ignoredDomains = []) {
  if (!domain || !Array.isArray(ignoredDomains)) {
    return false;
  }

  return ignoredDomains.some((ignoredDomain) =>
    isDomainMatch(domain, ignoredDomain),
  );
}

function normalizeSession(session) {
  if (!isPlainObject(session)) {
    return null;
  }

  const startedAt = Number(session.startedAt);
  const lastCommittedAt = Number(session.lastCommittedAt);
  const category = getSessionCategory(session.category);

  if (!session.domain || !isValidTimestamp(startedAt)) {
    return null;
  }

  return {
    tabId: session.tabId ?? null,
    windowId: session.windowId ?? null,
    url: session.url ?? '',
    title: session.title ?? '',
    hostname: session.hostname ?? session.domain,
    domain: session.domain,
    category,
    categorySource: session.categorySource ?? 'unknown',
    matchedDomain: session.matchedDomain ?? null,
    startedAt,
    lastCommittedAt: isValidTimestamp(lastCommittedAt)
      ? lastCommittedAt
      : startedAt,
    isTracking: Boolean(session.isTracking),
    status: session.isTracking ? SESSION_STATUS.ACTIVE : SESSION_STATUS.PAUSED,
    pauseReason: session.pauseReason ?? null,
    browserFocused: session.browserFocused !== false,
    idleState: getIdleState(session),
    visitCounted: Boolean(session.visitCounted),
  };
}

function hasFutureTimestamp(session, now) {
  return (
    session.startedAt > now + CLOCK_SKEW_TOLERANCE_MS ||
    session.lastCommittedAt > now + CLOCK_SKEW_TOLERANCE_MS
  );
}

function hasInvalidTimestampOrder(session) {
  return session.lastCommittedAt + CLOCK_SKEW_TOLERANCE_MS < session.startedAt;
}

function currentTabMatchesSession(session, currentTab) {
  if (!currentTab) {
    return true;
  }

  const currentDomain = getDomainFromTab(currentTab);

  if (!currentDomain) {
    return false;
  }

  return currentDomain === session.domain;
}

export function getTrackingBlockReason(
  tab,
  settings = DEFAULT_SETTINGS,
  options = {},
) {
  const normalizedSettings = normalizeSettings(settings);
  const domain = getDomainFromTab(tab);

  if (!normalizedSettings.trackingEnabled) {
    return SESSION_PAUSE_REASONS.DISABLED;
  }

  if (!getBrowserFocused(options)) {
    return SESSION_PAUSE_REASONS.UNFOCUSED;
  }

  if (getIdleState(options) !== SESSION_IDLE_STATES.ACTIVE) {
    return SESSION_PAUSE_REASONS.IDLE;
  }

  if (!domain) {
    return SESSION_PAUSE_REASONS.UNTRACKABLE_URL;
  }

  if (isIgnoredDomain(domain, normalizedSettings.ignoredDomains)) {
    return SESSION_PAUSE_REASONS.IGNORED_DOMAIN;
  }

  return null;
}

export function shouldTrackTab(
  tab,
  settings = DEFAULT_SETTINGS,
  options = {},
) {
  return !getTrackingBlockReason(tab, settings, options);
}

export function createActiveSession(tab, options = {}) {
  const now = resolveNow(options.now);
  const settings = normalizeSettings(options.settings);
  const url = typeof tab?.url === 'string' ? tab.url : '';
  const hostname = extractHostnameFromUrl(url);
  const browserFocused = getBrowserFocused(options);
  const idleState = getIdleState(options);

  if (!shouldTrackTab(tab, settings, { browserFocused, idleState }) || !hostname) {
    return null;
  }

  const categoryDetails = categorizeWebsite(url, {
    overrides: settings.categoryOverrides,
    rules: options.rules,
  });

  return {
    tabId: getTabId(tab),
    windowId: getWindowId(tab),
    url,
    title: tab?.title ?? '',
    hostname,
    domain: hostname,
    category: categoryDetails.category,
    categorySource: categoryDetails.source,
    matchedDomain: categoryDetails.matchedDomain,
    startedAt: now,
    lastCommittedAt: now,
    isTracking: true,
    status: SESSION_STATUS.ACTIVE,
    pauseReason: null,
    browserFocused,
    idleState,
    visitCounted: false,
  };
}

export function validateElapsedTime(session, options = {}) {
  const normalizedSession = normalizeSession(session);
  const now = resolveNow(options.now);
  const maxSessionGapSeconds = getMaxSessionGapSeconds(options.settings);

  if (!normalizedSession) {
    return {
      isValid: false,
      elapsedSeconds: 0,
      rawElapsedSeconds: 0,
      startedAt: null,
      endedAt: now,
      wasCapped: false,
      reason: 'missing-session',
    };
  }

  if (!normalizedSession.isTracking) {
    return {
      isValid: false,
      elapsedSeconds: 0,
      rawElapsedSeconds: 0,
      startedAt: resolveSessionStartPoint(normalizedSession),
      endedAt: now,
      wasCapped: false,
      reason: 'session-paused',
    };
  }

  const startedAt = resolveSessionStartPoint(normalizedSession);

  if (!startedAt) {
    return {
      isValid: false,
      elapsedSeconds: 0,
      rawElapsedSeconds: 0,
      startedAt: null,
      endedAt: now,
      wasCapped: false,
      reason: 'invalid-start-time',
    };
  }

  if (now <= startedAt) {
    return {
      isValid: false,
      elapsedSeconds: 0,
      rawElapsedSeconds: 0,
      startedAt,
      endedAt: now,
      wasCapped: false,
      reason: 'non-positive-elapsed',
    };
  }

  const rawElapsedSeconds = Math.floor((now - startedAt) / SECOND_IN_MS);

  if (rawElapsedSeconds < 1) {
    return {
      isValid: false,
      elapsedSeconds: 0,
      rawElapsedSeconds,
      startedAt,
      endedAt: now,
      wasCapped: false,
      reason: 'less-than-one-second',
    };
  }

  const elapsedSeconds = Math.min(rawElapsedSeconds, maxSessionGapSeconds);
  const endedAt = startedAt + elapsedSeconds * SECOND_IN_MS;

  return {
    isValid: true,
    elapsedSeconds,
    rawElapsedSeconds,
    startedAt,
    endedAt,
    wasCapped: rawElapsedSeconds > maxSessionGapSeconds,
    reason:
      rawElapsedSeconds > maxSessionGapSeconds
        ? 'max-gap-capped'
        : 'valid',
  };
}

export function isSessionStale(session, options = {}) {
  const normalizedSession = normalizeSession(session);

  if (!normalizedSession) {
    return false;
  }

  const now = resolveNow(options.now);
  const maxSessionGapSeconds = getMaxSessionGapSeconds(options.settings);
  const lastActivityAt = resolveSessionStartPoint(normalizedSession);
  const gapSeconds = getElapsedSeconds(lastActivityAt, now);

  return gapSeconds > maxSessionGapSeconds;
}

export function validateSessionForRecovery(session, options = {}) {
  const normalizedSession = normalizeSession(session);
  const now = resolveNow(options.now);
  const settings = normalizeSettings(options.settings);
  const browserFocused = getBrowserFocused(options);
  const idleState = getIdleState(options);
  const maxSessionGapSeconds = getMaxSessionGapSeconds(settings);

  if (!session) {
    return {
      action: RECOVERY_ACTIONS.NONE,
      isRecoverable: false,
      isStale: false,
      shouldCommit: false,
      shouldClear: false,
      shouldPause: false,
      reason: 'no-session',
      session: null,
      gapSeconds: 0,
      maxSessionGapSeconds,
    };
  }

  if (!normalizedSession) {
    return {
      action: RECOVERY_ACTIONS.CLEAR,
      isRecoverable: false,
      isStale: true,
      shouldCommit: false,
      shouldClear: true,
      shouldPause: false,
      reason: 'invalid-session',
      session: null,
      gapSeconds: 0,
      maxSessionGapSeconds,
    };
  }

  if (
    hasFutureTimestamp(normalizedSession, now) ||
    hasInvalidTimestampOrder(normalizedSession)
  ) {
    return {
      action: RECOVERY_ACTIONS.CLEAR,
      isRecoverable: false,
      isStale: true,
      shouldCommit: false,
      shouldClear: true,
      shouldPause: false,
      reason: 'invalid-session-timestamps',
      session: normalizedSession,
      gapSeconds: 0,
      maxSessionGapSeconds,
    };
  }

  const lastActivityAt = resolveSessionStartPoint(normalizedSession);
  const gapSeconds = getElapsedSeconds(lastActivityAt, now);

  if (!normalizedSession.isTracking) {
    return {
      action: RECOVERY_ACTIONS.KEEP,
      isRecoverable: true,
      isStale: false,
      shouldCommit: false,
      shouldClear: false,
      shouldPause: false,
      reason: 'session-already-paused',
      session: normalizedSession,
      gapSeconds,
      maxSessionGapSeconds,
    };
  }

  if (!currentTabMatchesSession(normalizedSession, options.currentTab)) {
    return {
      action: RECOVERY_ACTIONS.CLEAR,
      isRecoverable: false,
      isStale: true,
      shouldCommit: gapSeconds >= 1,
      shouldClear: true,
      shouldPause: false,
      reason: 'current-tab-mismatch',
      session: normalizedSession,
      gapSeconds,
      maxSessionGapSeconds,
    };
  }

  if (!browserFocused) {
    return {
      action: RECOVERY_ACTIONS.PAUSE,
      isRecoverable: true,
      isStale: false,
      shouldCommit: gapSeconds >= 1,
      shouldClear: false,
      shouldPause: true,
      reason: SESSION_PAUSE_REASONS.UNFOCUSED,
      session: normalizedSession,
      gapSeconds,
      maxSessionGapSeconds,
    };
  }

  if (idleState !== SESSION_IDLE_STATES.ACTIVE) {
    return {
      action: RECOVERY_ACTIONS.PAUSE,
      isRecoverable: true,
      isStale: false,
      shouldCommit: gapSeconds >= 1,
      shouldClear: false,
      shouldPause: true,
      reason: SESSION_PAUSE_REASONS.IDLE,
      session: normalizedSession,
      gapSeconds,
      maxSessionGapSeconds,
    };
  }

  if (gapSeconds > maxSessionGapSeconds) {
    return {
      action: RECOVERY_ACTIONS.PAUSE,
      isRecoverable: true,
      isStale: true,
      shouldCommit: true,
      shouldClear: false,
      shouldPause: true,
      reason: 'stale-session',
      session: normalizedSession,
      gapSeconds,
      maxSessionGapSeconds,
    };
  }

  if (gapSeconds < 1) {
    return {
      action: RECOVERY_ACTIONS.KEEP,
      isRecoverable: true,
      isStale: false,
      shouldCommit: false,
      shouldClear: false,
      shouldPause: false,
      reason: 'fresh-session',
      session: normalizedSession,
      gapSeconds,
      maxSessionGapSeconds,
    };
  }

  return {
    action: RECOVERY_ACTIONS.COMMIT,
    isRecoverable: true,
    isStale: false,
    shouldCommit: true,
    shouldClear: false,
    shouldPause: false,
    reason: 'recoverable-active-session',
    session: normalizedSession,
    gapSeconds,
    maxSessionGapSeconds,
  };
}

export function splitElapsedByDate(startedAt, endedAt) {
  if (!isValidTimestamp(startedAt) || !isValidTimestamp(endedAt)) {
    return [];
  }

  if (endedAt <= startedAt) {
    return [];
  }

  const segments = [];
  let cursor = startedAt;

  while (cursor < endedAt) {
    const cursorDate = new Date(cursor);
    const nextMidnight = new Date(cursorDate);

    nextMidnight.setHours(24, 0, 0, 0);

    const segmentEnd = Math.min(endedAt, nextMidnight.getTime());
    const seconds = Math.floor((segmentEnd - cursor) / SECOND_IN_MS);

    if (seconds > 0) {
      segments.push({
        dateKey: getDateKey(cursorDate),
        seconds,
      });
    }

    if (segmentEnd <= cursor) {
      break;
    }

    cursor = segmentEnd;
  }

  return segments;
}

function addUsageSegmentToDay(dayStats, session, seconds, options = {}) {
  const category = getSessionCategory(session.category);
  const totalField = getCategoryTotalField(category);
  const siteKey = session.domain;
  const dateKey = options.dateKey ?? dayStats.date;
  const safeDayStats = {
    ...createDefaultDayStats(dateKey),
    ...dayStats,
    date: dateKey,
    sites: isPlainObject(dayStats.sites) ? dayStats.sites : {},
  };
  const currentSiteStats = {
    ...createDefaultSiteStats(siteKey, category),
    ...(safeDayStats.sites[siteKey] ?? {}),
  };
  const visitIncrement = options.countVisit ? 1 : 0;

  return {
    ...safeDayStats,
    totalSeconds: getSafeNumber(safeDayStats.totalSeconds) + seconds,
    [totalField]: getSafeNumber(safeDayStats[totalField]) + seconds,
    sites: {
      ...safeDayStats.sites,
      [siteKey]: {
        ...currentSiteStats,
        category,
        seconds: getSafeNumber(currentSiteStats.seconds) + seconds,
        visits: getSafeNumber(currentSiteStats.visits) + visitIncrement,
        lastVisitedAt: options.committedAt,
      },
    },
  };
}

async function commitUsage(session, elapsedResult) {
  const normalizedSession = normalizeSession(session);

  if (!normalizedSession || !elapsedResult.isValid) {
    return null;
  }

  const segments = splitElapsedByDate(
    elapsedResult.startedAt,
    elapsedResult.endedAt,
  );

  if (segments.length === 0) {
    return null;
  }

  let shouldCountVisit = !normalizedSession.visitCounted;

  await updateDailyStats((dailyStats) => {
    const nextDailyStats = { ...dailyStats };

    for (const segment of segments) {
      const currentDayStats =
        nextDailyStats[segment.dateKey] ??
        createDefaultDayStats(segment.dateKey);

      nextDailyStats[segment.dateKey] = addUsageSegmentToDay(
        currentDayStats,
        normalizedSession,
        segment.seconds,
        {
          dateKey: segment.dateKey,
          committedAt: elapsedResult.endedAt,
          countVisit: shouldCountVisit,
        },
      );

      shouldCountVisit = false;
    }

    return nextDailyStats;
  });

  return segments;
}

export async function startSession(tab, options = {}) {
  const settings = options.settings ?? (await getSettings());
  const nextSession = createActiveSession(tab, {
    browserFocused: options.browserFocused,
    idleState: options.idleState,
    now: options.now,
    rules: options.rules,
    settings,
  });

  if (!nextSession) {
    await clearActiveSession();
    return null;
  }

  await setActiveSession(nextSession);

  return nextSession;
}

export async function commitSession(session, options = {}) {
  const settings = options.settings ?? (await getSettings());
  const normalizedSession = normalizeSession(session);
  const elapsedResult = validateElapsedTime(normalizedSession, {
    now: options.now,
    settings,
  });

  if (!normalizedSession || !elapsedResult.isValid) {
    return {
      committed: false,
      reason: elapsedResult.reason,
      elapsed: elapsedResult,
      session: normalizedSession,
      segments: [],
    };
  }

  const segments = await commitUsage(normalizedSession, elapsedResult);

  if (!segments) {
    return {
      committed: false,
      reason: 'no-usage-segments',
      elapsed: elapsedResult,
      session: normalizedSession,
      segments: [],
    };
  }

  const nextSession = {
    ...normalizedSession,
    lastCommittedAt: elapsedResult.endedAt,
    browserFocused: options.browserFocused ?? normalizedSession.browserFocused,
    idleState: options.idleState ?? normalizedSession.idleState,
    visitCounted: true,
  };

  if (options.persistSession !== false) {
    await setActiveSession(nextSession);
  }

  return {
    committed: true,
    reason: options.reason ?? COMMIT_REASONS.PERIODIC,
    elapsed: elapsedResult,
    session: nextSession,
    segments,
  };
}

export async function commitActiveSession(options = {}) {
  const session = options.session ?? (await getActiveSession());

  return commitSession(session, {
    ...options,
    persistSession: options.keepSession !== false,
  });
}

export async function pauseSession(
  session,
  pauseReason = SESSION_PAUSE_REASONS.MANUAL,
  options = {},
) {
  const commitResult = await commitSession(session, {
    ...options,
    reason: options.reason ?? COMMIT_REASONS.PAUSE,
    persistSession: false,
  });
  const normalizedSession = commitResult.session ?? normalizeSession(session);

  if (!normalizedSession) {
    if (options.persistSession !== false) {
      await clearActiveSession();
    }

    return {
      ...commitResult,
      paused: false,
      pauseReason,
      session: null,
    };
  }

  const pausedAt = commitResult.elapsed.endedAt ?? resolveNow(options.now);
  const pausedSession = {
    ...normalizedSession,
    lastCommittedAt: pausedAt,
    isTracking: false,
    status: SESSION_STATUS.PAUSED,
    pauseReason,
    browserFocused:
      options.browserFocused ?? normalizedSession.browserFocused,
    idleState: options.idleState ?? normalizedSession.idleState,
  };

  if (options.persistSession !== false) {
    await setActiveSession(pausedSession);
  }

  return {
    ...commitResult,
    paused: true,
    pauseReason,
    session: pausedSession,
  };
}

export async function pauseActiveSession(
  pauseReason = SESSION_PAUSE_REASONS.MANUAL,
  options = {},
) {
  const session = options.session ?? (await getActiveSession());

  return pauseSession(session, pauseReason, {
    ...options,
    reason: options.reason ?? COMMIT_REASONS.PAUSE,
  });
}

export async function clearSession(options = {}) {
  const session = options.session ?? (await getActiveSession());
  const normalizedSession = normalizeSession(session);

  if (options.commitBeforeClear && normalizedSession) {
    const commitResult = await commitSession(normalizedSession, {
      ...options,
      reason: options.reason ?? COMMIT_REASONS.END,
      persistSession: false,
    });

    await clearActiveSession();

    return {
      ...commitResult,
      cleared: true,
    };
  }

  await clearActiveSession();

  return {
    committed: false,
    cleared: true,
    reason: options.reason ?? 'cleared-without-commit',
    elapsed: null,
    session: normalizedSession,
    segments: [],
  };
}

export async function recoverSession(options = {}) {
  const settings = options.settings ?? (await getSettings());
  const now = resolveNow(options.now);
  const session = options.session ?? (await getActiveSession());
  const validation = validateSessionForRecovery(session, {
    browserFocused: options.browserFocused,
    currentTab: options.currentTab,
    idleState: options.idleState,
    now,
    settings,
  });
  const shouldPersist = options.persistSession !== false;
  const shouldCommitRecoveredTime = options.commitRecoveredTime !== false;

  if (validation.action === RECOVERY_ACTIONS.NONE) {
    return {
      recovered: false,
      action: RECOVERY_ACTIONS.NONE,
      reason: validation.reason,
      validation,
      commitResult: null,
      session: null,
    };
  }

  if (validation.shouldClear && !validation.shouldCommit) {
    if (shouldPersist) {
      await clearActiveSession();
    }

    return {
      recovered: false,
      action: RECOVERY_ACTIONS.CLEAR,
      reason: validation.reason,
      validation,
      commitResult: null,
      session: validation.session,
    };
  }

  let commitResult = null;
  let recoveredSession = validation.session;

  if (validation.shouldCommit && shouldCommitRecoveredTime) {
    commitResult = await commitSession(validation.session, {
      browserFocused: options.browserFocused,
      idleState: options.idleState,
      now,
      persistSession: false,
      reason: COMMIT_REASONS.RECOVERY,
      settings,
    });

    recoveredSession = commitResult.session ?? recoveredSession;
  }

  if (validation.shouldCommit && !shouldCommitRecoveredTime) {
    recoveredSession = {
      ...recoveredSession,
      lastCommittedAt: now,
      browserFocused:
        options.browserFocused ?? recoveredSession.browserFocused,
      idleState: options.idleState ?? recoveredSession.idleState,
    };
  }

  const staleAction = options.staleAction ?? RECOVERY_ACTIONS.PAUSE;
  const shouldClearAfterCommit =
    validation.shouldClear ||
    (validation.isStale && staleAction === RECOVERY_ACTIONS.CLEAR);

  if (shouldClearAfterCommit) {
    if (shouldPersist) {
      await clearActiveSession();
    }

    return {
      recovered: false,
      action: RECOVERY_ACTIONS.CLEAR,
      reason: validation.reason,
      validation,
      commitResult,
      session: recoveredSession,
    };
  }

  if (validation.shouldPause || validation.isStale) {
    const pausedSession = {
      ...recoveredSession,
      lastCommittedAt: validation.isStale ? now : recoveredSession.lastCommittedAt,
      isTracking: false,
      status: SESSION_STATUS.PAUSED,
      pauseReason: validation.isStale
        ? SESSION_PAUSE_REASONS.STALE_SESSION
        : validation.reason,
      browserFocused:
        options.browserFocused ?? recoveredSession.browserFocused,
      idleState: options.idleState ?? recoveredSession.idleState,
    };

    if (shouldPersist) {
      await setActiveSession(pausedSession);
    }

    return {
      recovered: true,
      action: RECOVERY_ACTIONS.PAUSE,
      reason: validation.reason,
      validation,
      commitResult,
      session: pausedSession,
    };
  }

  if (validation.action === RECOVERY_ACTIONS.COMMIT) {
    const activeSession = {
      ...recoveredSession,
      isTracking: true,
      status: SESSION_STATUS.ACTIVE,
      pauseReason: null,
      browserFocused:
        options.browserFocused ?? recoveredSession.browserFocused,
      idleState: options.idleState ?? recoveredSession.idleState,
    };

    if (shouldPersist) {
      await setActiveSession(activeSession);
    }

    return {
      recovered: true,
      action: RECOVERY_ACTIONS.COMMIT,
      reason: validation.reason,
      validation,
      commitResult,
      session: activeSession,
    };
  }

  const keptSession = {
    ...recoveredSession,
    browserFocused:
      options.browserFocused ?? recoveredSession.browserFocused,
    idleState: options.idleState ?? recoveredSession.idleState,
  };

  if (shouldPersist) {
    await setActiveSession(keptSession);
  }

  return {
    recovered: true,
    action: RECOVERY_ACTIONS.KEEP,
    reason: validation.reason,
    validation,
    commitResult,
    session: keptSession,
  };
}

export async function endActiveSession(options = {}) {
  const clearResult = await clearSession({
    ...options,
    commitBeforeClear: true,
    reason: options.reason ?? COMMIT_REASONS.END,
  });

  return {
    ...clearResult,
    ended: true,
  };
}
