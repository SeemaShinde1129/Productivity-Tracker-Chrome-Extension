import { getLiveElapsedSeconds } from '../utils/liveSessionTime.js';

export const EMPTY_TOTALS = Object.freeze({
  totalSeconds: 0,
  productiveSeconds: 0,
  unproductiveSeconds: 0,
  neutralSeconds: 0,
});

function normalizeSeconds(seconds = 0) {
  if (!Number.isFinite(seconds)) {
    return 0;
  }

  return Math.max(0, Math.floor(seconds));
}

function normalizeTotals(totals = {}) {
  return {
    totalSeconds: normalizeSeconds(totals.totalSeconds),
    productiveSeconds: normalizeSeconds(totals.productiveSeconds),
    unproductiveSeconds: normalizeSeconds(totals.unproductiveSeconds),
    neutralSeconds: normalizeSeconds(totals.neutralSeconds),
  };
}

export function formatTrackedTime(seconds = 0) {
  const safeSeconds = normalizeSeconds(seconds);
  const hours = Math.floor(safeSeconds / 3600);
  const minutes = Math.floor((safeSeconds % 3600) / 60);
  const remainingSeconds = safeSeconds % 60;

  if (hours > 0) {
    return minutes > 0 ? `${hours}h ${minutes}m` : `${hours}h`;
  }

  if (minutes > 0) {
    return remainingSeconds > 0
      ? `${minutes}m ${remainingSeconds}s`
      : `${minutes}m`;
  }

  return `${remainingSeconds}s`;
}

export function getDisplayTotals(totals, activeSession, liveSeconds) {
  const displayTotals = normalizeTotals({
    ...EMPTY_TOTALS,
    ...totals,
  });

  if (!activeSession?.isTracking || liveSeconds <= 0) {
    return displayTotals;
  }

  displayTotals.totalSeconds += liveSeconds;

  if (activeSession.category === 'productive') {
    displayTotals.productiveSeconds += liveSeconds;
  } else if (activeSession.category === 'unproductive') {
    displayTotals.unproductiveSeconds += liveSeconds;
  } else {
    displayTotals.neutralSeconds += liveSeconds;
  }

  return displayTotals;
}

export { getLiveElapsedSeconds };

export function calculateProductivityScore(totals) {
  const normalizedTotals = normalizeTotals(totals);

  if (normalizedTotals.totalSeconds <= 0) {
    return {
      hasData: false,
      value: null,
      label: '--',
    };
  }

  const value = Math.round(
    (normalizedTotals.productiveSeconds / normalizedTotals.totalSeconds) * 100,
  );

  return {
    hasData: true,
    value,
    label: `${value}%`,
  };
}

export function calculateCategoryPercentages(totals) {
  const normalizedTotals = normalizeTotals(totals);

  if (normalizedTotals.totalSeconds <= 0) {
    return {
      hasData: false,
      productive: 0,
      unproductive: 0,
      neutral: 0,
    };
  }

  const productive =
    (normalizedTotals.productiveSeconds / normalizedTotals.totalSeconds) * 100;
  const unproductive =
    (normalizedTotals.unproductiveSeconds / normalizedTotals.totalSeconds) * 100;
  const neutral = Math.max(0, 100 - productive - unproductive);

  return {
    hasData: true,
    productive,
    unproductive,
    neutral,
  };
}

export function getProductivitySummary(totals) {
  const normalizedTotals = normalizeTotals(totals);
  const score = calculateProductivityScore(normalizedTotals);

  if (!score.hasData) {
    return 'No tracked time yet';
  }

  if (normalizedTotals.totalSeconds < 60) {
    return 'Collecting first minute';
  }

  if (score.value >= 70) {
    return 'Mostly productive today';
  }

  if (score.value >= 40) {
    return 'Mixed browsing pattern';
  }

  return 'Mostly unproductive today';
}
