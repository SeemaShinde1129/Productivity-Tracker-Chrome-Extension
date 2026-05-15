import { getDateKey } from '../utils/storage.js';

const DAY_IN_MS = 24 * 60 * 60 * 1000;
const CATEGORY_KEYS = Object.freeze([
  'productive',
  'unproductive',
  'neutral',
]);

const EMPTY_TOTALS = Object.freeze({
  totalSeconds: 0,
  productiveSeconds: 0,
  unproductiveSeconds: 0,
  neutralSeconds: 0,
});

function normalizeSeconds(value = 0) {
  const seconds = Number(value);

  if (!Number.isFinite(seconds)) {
    return 0;
  }

  return Math.max(0, Math.floor(seconds));
}

function normalizeCategory(category) {
  return CATEGORY_KEYS.includes(category) ? category : 'neutral';
}

function normalizeTotals(stats = {}) {
  return {
    totalSeconds: normalizeSeconds(stats.totalSeconds),
    productiveSeconds: normalizeSeconds(stats.productiveSeconds),
    unproductiveSeconds: normalizeSeconds(stats.unproductiveSeconds),
    neutralSeconds: normalizeSeconds(stats.neutralSeconds),
  };
}

function addTotals(currentTotals, nextTotals) {
  return {
    totalSeconds: currentTotals.totalSeconds + nextTotals.totalSeconds,
    productiveSeconds:
      currentTotals.productiveSeconds + nextTotals.productiveSeconds,
    unproductiveSeconds:
      currentTotals.unproductiveSeconds + nextTotals.unproductiveSeconds,
    neutralSeconds: currentTotals.neutralSeconds + nextTotals.neutralSeconds,
  };
}

function getStartOfDay(date) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

function getPastDateKeys(dayCount, now = new Date()) {
  const today = getStartOfDay(now);

  return Array.from({ length: dayCount }, (_, index) => {
    const dayOffset = dayCount - index - 1;
    const date = new Date(today.getTime() - dayOffset * DAY_IN_MS);

    return {
      date,
      dateKey: getDateKey(date),
      label: date.toLocaleDateString(undefined, {
        month: 'short',
        day: 'numeric',
      }),
      shortLabel: date.toLocaleDateString(undefined, {
        weekday: 'short',
      }),
    };
  });
}

function calculateScore(totals) {
  if (totals.totalSeconds <= 0) {
    return {
      hasData: false,
      label: '--',
      value: null,
    };
  }

  const value = Math.round(
    (totals.productiveSeconds / totals.totalSeconds) * 100,
  );

  return {
    hasData: true,
    label: `${value}%`,
    value,
  };
}

function normalizeDayStats(dayStats, dateKey) {
  const totals = normalizeTotals(dayStats);

  return {
    date: dayStats?.date ?? dateKey,
    sites: dayStats?.sites && typeof dayStats.sites === 'object'
      ? dayStats.sites
      : {},
    ...totals,
  };
}

function getCategoryPercentages(totals) {
  if (totals.totalSeconds <= 0) {
    return {
      productive: 0,
      unproductive: 0,
      neutral: 0,
    };
  }

  return {
    productive: Math.round(
      (totals.productiveSeconds / totals.totalSeconds) * 100,
    ),
    unproductive: Math.round(
      (totals.unproductiveSeconds / totals.totalSeconds) * 100,
    ),
    neutral: Math.max(
      0,
      Math.round((totals.neutralSeconds / totals.totalSeconds) * 100),
    ),
  };
}

function getDominantCategory(categorySeconds) {
  return CATEGORY_KEYS.reduce((bestCategory, category) => {
    if (categorySeconds[category] > categorySeconds[bestCategory]) {
      return category;
    }

    return bestCategory;
  }, 'neutral');
}

function aggregateSiteUsage(dailyStats, dateKeys) {
  const siteMap = new Map();

  dateKeys.forEach((dateKey) => {
    const dayStats = normalizeDayStats(dailyStats[dateKey], dateKey);

    Object.entries(dayStats.sites).forEach(([domain, siteStats]) => {
      if (!domain) {
        return;
      }

      const category = normalizeCategory(siteStats?.category);
      const seconds = normalizeSeconds(siteStats?.seconds);
      const visits = normalizeSeconds(siteStats?.visits);
      const currentSite = siteMap.get(domain) ?? {
        category,
        categorySeconds: {
          productive: 0,
          unproductive: 0,
          neutral: 0,
        },
        domain,
        seconds: 0,
        visits: 0,
      };

      currentSite.seconds += seconds;
      currentSite.visits += visits;
      currentSite.categorySeconds[category] += seconds;
      currentSite.category = getDominantCategory(currentSite.categorySeconds);

      siteMap.set(domain, currentSite);
    });
  });

  return Array.from(siteMap.values())
    .sort((firstSite, secondSite) => secondSite.seconds - firstSite.seconds)
    .map((site) => ({
      category: site.category,
      domain: site.domain,
      neutralSeconds: site.categorySeconds.neutral,
      productiveSeconds: site.categorySeconds.productive,
      seconds: site.seconds,
      unproductiveSeconds: site.categorySeconds.unproductive,
      visits: site.visits,
    }));
}

function getRankedSites(siteUsage, limit = 8) {
  const byVisits = [...siteUsage].sort((firstSite, secondSite) => {
    if (secondSite.visits !== firstSite.visits) {
      return secondSite.visits - firstSite.visits;
    }

    return secondSite.seconds - firstSite.seconds;
  });

  const productive = siteUsage
    .filter((site) => site.productiveSeconds > 0)
    .sort(
      (firstSite, secondSite) =>
        secondSite.productiveSeconds - firstSite.productiveSeconds,
    );

  const unproductive = siteUsage
    .filter((site) => site.unproductiveSeconds > 0)
    .sort(
      (firstSite, secondSite) =>
        secondSite.unproductiveSeconds - firstSite.unproductiveSeconds,
    );

  return {
    mostVisited: byVisits.slice(0, limit),
    productive: productive.slice(0, limit),
    topByTime: siteUsage.slice(0, limit),
    unproductive: unproductive.slice(0, limit),
  };
}

function buildDailySeries(dailyStats, dateEntries) {
  return dateEntries.map((dateEntry) => {
    const dayStats = normalizeDayStats(
      dailyStats[dateEntry.dateKey],
      dateEntry.dateKey,
    );
    const totals = normalizeTotals(dayStats);
    const score = calculateScore(totals);

    return {
      ...dateEntry,
      ...totals,
      score,
    };
  });
}

function getBestProductiveDay(dailySeries) {
  const bestDay = dailySeries.reduce((currentBest, day) => {
    if (!currentBest || day.productiveSeconds > currentBest.productiveSeconds) {
      return day;
    }

    return currentBest;
  }, null);

  if (!bestDay || bestDay.productiveSeconds <= 0) {
    return null;
  }

  return bestDay;
}

function getWeeklySummary(weeklyTotals, bestProductiveDay, topSites) {
  const score = calculateScore(weeklyTotals);

  if (!score.hasData) {
    return 'No weekly tracking data yet. Browse a few normal websites and return here.';
  }

  const topSite = topSites[0]?.domain ?? 'no dominant site';
  const bestDayText = bestProductiveDay
    ? `${bestProductiveDay.shortLabel} was your strongest productive day`
    : 'No strong productive day yet';

  return `${bestDayText}. Top site this week: ${topSite}. Weekly productivity score: ${score.label}.`;
}

function getTrackedDayCount(dailySeries) {
  return dailySeries.filter((day) => day.totalSeconds > 0).length;
}

function getMostActiveDay(dailySeries) {
  const mostActiveDay = dailySeries.reduce((currentBest, day) => {
    if (!currentBest || day.totalSeconds > currentBest.totalSeconds) {
      return day;
    }

    return currentBest;
  }, null);

  if (!mostActiveDay || mostActiveDay.totalSeconds <= 0) {
    return null;
  }

  return mostActiveDay;
}

function getProductivityTrend(dailySeries) {
  const scoredDays = dailySeries.filter((day) => day.score.hasData);

  if (scoredDays.length < 2) {
    return {
      delta: 0,
      direction: 'neutral',
      label: 'Collecting trend data',
      summary: 'Track at least two days to compare productivity direction.',
    };
  }

  const firstScore = scoredDays[0].score.value;
  const lastScore = scoredDays[scoredDays.length - 1].score.value;
  const delta = lastScore - firstScore;
  const absoluteDelta = Math.abs(delta);

  if (absoluteDelta < 5) {
    return {
      delta,
      direction: 'neutral',
      label: 'Mostly stable',
      summary: 'Your productivity score is staying about the same this week.',
    };
  }

  if (delta > 0) {
    return {
      delta,
      direction: 'positive',
      label: `Improved by ${absoluteDelta} points`,
      summary: 'Your latest tracked day is more productive than your first tracked day this week.',
    };
  }

  return {
    delta,
    direction: 'negative',
    label: `Down by ${absoluteDelta} points`,
    summary: 'Your latest tracked day is less productive than your first tracked day this week.',
  };
}

function getDashboardInsights({
  bestProductiveDay,
  dailySeries,
  rankedSites,
  weeklyTotals,
}) {
  const trackedDayCount = getTrackedDayCount(dailySeries);
  const averageProductiveSeconds =
    trackedDayCount > 0
      ? Math.round(weeklyTotals.productiveSeconds / trackedDayCount)
      : 0;
  const trend = getProductivityTrend(dailySeries);
  const topProductiveSite = rankedSites.productive[0] ?? null;
  const topDistractingSite = rankedSites.unproductive[0] ?? null;

  return {
    averageProductiveSeconds,
    cards: [
      {
        description: bestProductiveDay
          ? `${bestProductiveDay.label} had the highest productive time.`
          : 'No productive day has been recorded yet.',
        id: 'most-productive-day',
        label: 'Most productive day',
        tone: 'productive',
        value: bestProductiveDay
          ? `${bestProductiveDay.shortLabel} · ${formatTrackedTime(
              bestProductiveDay.productiveSeconds,
            )}`
          : '--',
      },
      {
        description:
          trackedDayCount > 0
            ? `Based on ${trackedDayCount} tracked day${trackedDayCount === 1 ? '' : 's'}.`
            : 'Browse normal websites to start building averages.',
        id: 'average-productive-time',
        label: 'Avg productive time',
        tone: 'neutral',
        value: formatTrackedTime(averageProductiveSeconds),
      },
      {
        description: topDistractingSite
          ? `${topDistractingSite.domain} accounts for the most unproductive time.`
          : 'No distracting website has been recorded yet.',
        id: 'top-distracting-site',
        label: 'Top distracting website',
        tone: 'unproductive',
        value: topDistractingSite
          ? `${topDistractingSite.domain} · ${formatTrackedTime(
              topDistractingSite.unproductiveSeconds,
            )}`
          : '--',
      },
      {
        description: topProductiveSite
          ? `${topProductiveSite.domain} accounts for the most productive time.`
          : 'No productive website has been recorded yet.',
        id: 'top-productive-site',
        label: 'Top productive website',
        tone: 'productive',
        value: topProductiveSite
          ? `${topProductiveSite.domain} · ${formatTrackedTime(
              topProductiveSite.productiveSeconds,
            )}`
          : '--',
      },
    ],
    topDistractingSite,
    topProductiveSite,
    trackedDayCount,
    trend,
  };
}

function getDateRangeLabel(dailySeries) {
  const firstDay = dailySeries[0];
  const lastDay = dailySeries[dailySeries.length - 1];

  if (!firstDay || !lastDay) {
    return 'Current week';
  }

  return `${firstDay.label} - ${lastDay.label}`;
}

function getWeeklyReportStatus(score) {
  if (!score.hasData) {
    return {
      label: 'No report yet',
      summary: 'Track website activity to generate a weekly productivity report.',
      tone: 'neutral',
    };
  }

  if (score.value >= 70) {
    return {
      label: 'Strong productive week',
      summary: 'Most tracked browsing time was spent on productive websites.',
      tone: 'productive',
    };
  }

  if (score.value >= 40) {
    return {
      label: 'Mixed productivity week',
      summary: 'Productive and distracting browsing were both present this week.',
      tone: 'neutral',
    };
  }

  return {
    label: 'Distracting week',
    summary: 'Unproductive or neutral browsing took most of the tracked time.',
    tone: 'unproductive',
  };
}

function createWeeklyReport({
  bestProductiveDay,
  dailySeries,
  rankedSites,
  weeklyTotals,
}) {
  const score = calculateScore(weeklyTotals);
  const trackedDayCount = getTrackedDayCount(dailySeries);
  const mostActiveDay = getMostActiveDay(dailySeries);
  const trend = getProductivityTrend(dailySeries);
  const status = getWeeklyReportStatus(score);
  const topProductiveSite = rankedSites.productive[0] ?? null;
  const mostDistractingSite = rankedSites.unproductive[0] ?? null;
  const averageDailySeconds =
    trackedDayCount > 0
      ? Math.round(weeklyTotals.totalSeconds / trackedDayCount)
      : 0;
  const averageProductiveSeconds =
    trackedDayCount > 0
      ? Math.round(weeklyTotals.productiveSeconds / trackedDayCount)
      : 0;
  const averageUnproductiveSeconds =
    trackedDayCount > 0
      ? Math.round(weeklyTotals.unproductiveSeconds / trackedDayCount)
      : 0;

  return {
    averageDailySeconds,
    averageProductiveSeconds,
    averageUnproductiveSeconds,
    dateRangeLabel: getDateRangeLabel(dailySeries),
    hasData: score.hasData,
    mostActiveDay,
    mostDistractingSite,
    mostProductiveDay: bestProductiveDay,
    score,
    status,
    topProductiveSite,
    trackedDayCount,
    trend,
  };
}

export function formatTrackedTime(seconds = 0) {
  const safeSeconds = normalizeSeconds(seconds);
  const hours = Math.floor(safeSeconds / 3600);
  const minutes = Math.floor((safeSeconds % 3600) / 60);

  if (hours > 0) {
    return minutes > 0 ? `${hours}h ${minutes}m` : `${hours}h`;
  }

  if (minutes > 0) {
    return `${minutes}m`;
  }

  return `${safeSeconds}s`;
}

export function secondsToMinutes(seconds = 0) {
  return Math.round(normalizeSeconds(seconds) / 60);
}

export function createDashboardAnalytics({
  dailyStats = {},
  dayCount = 7,
  now = new Date(),
} = {}) {
  const dateEntries = getPastDateKeys(dayCount, now);
  const dateKeys = dateEntries.map((dateEntry) => dateEntry.dateKey);
  const dailySeries = buildDailySeries(dailyStats, dateEntries);
  const weeklyTotals = dailySeries.reduce(
    (totals, day) => addTotals(totals, normalizeTotals(day)),
    { ...EMPTY_TOTALS },
  );
  const todayKey = getDateKey(now);
  const todayStats = normalizeDayStats(dailyStats[todayKey], todayKey);
  const todayTotals = normalizeTotals(todayStats);
  const siteUsage = aggregateSiteUsage(dailyStats, dateKeys);
  const rankedSites = getRankedSites(siteUsage);
  const topSites = rankedSites.topByTime;
  const bestProductiveDay = getBestProductiveDay(dailySeries);
  const insights = getDashboardInsights({
    bestProductiveDay,
    dailySeries,
    rankedSites,
    weeklyTotals,
  });
  const weeklyReport = createWeeklyReport({
    bestProductiveDay,
    dailySeries,
    rankedSites,
    weeklyTotals,
  });

  return {
    bestProductiveDay,
    categoryPercentages: getCategoryPercentages(weeklyTotals),
    dailySeries,
    hasData: weeklyTotals.totalSeconds > 0,
    insights,
    rankedSites,
    siteUsage,
    today: {
      dateKey: todayKey,
      score: calculateScore(todayTotals),
      totals: todayTotals,
    },
    topSites,
    weekly: {
      summary: getWeeklySummary(weeklyTotals, bestProductiveDay, topSites),
      score: calculateScore(weeklyTotals),
      totals: weeklyTotals,
    },
    weeklyReport,
  };
}
