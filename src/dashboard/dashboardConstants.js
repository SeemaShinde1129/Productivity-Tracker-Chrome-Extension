export const CATEGORY_STYLES = Object.freeze({
  productive: {
    bar: 'bg-emerald-400',
    color: '#34d399',
    label: 'Productive',
    text: 'text-emerald-300',
  },
  unproductive: {
    bar: 'bg-rose-400',
    color: '#fb7185',
    label: 'Unproductive',
    text: 'text-rose-300',
  },
  neutral: {
    bar: 'bg-zinc-500',
    color: '#a1a1aa',
    label: 'Neutral',
    text: 'text-zinc-300',
  },
});

export const EMPTY_DAILY_SERIES = Object.freeze([]);

export const EMPTY_TOTALS = Object.freeze({
  neutralSeconds: 0,
  productiveSeconds: 0,
  totalSeconds: 0,
  unproductiveSeconds: 0,
});

export const EMPTY_INSIGHTS = Object.freeze({
  averageProductiveSeconds: 0,
  cards: [],
  topDistractingSite: null,
  topProductiveSite: null,
  trackedDayCount: 0,
  trend: {
    delta: 0,
    direction: 'neutral',
    label: 'Collecting trend data',
    summary: 'Track website activity to build dashboard insights.',
  },
});

export const EMPTY_RANKED_SITES = Object.freeze({
  mostVisited: [],
  productive: [],
  topByTime: [],
  unproductive: [],
});
