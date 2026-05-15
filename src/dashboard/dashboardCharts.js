import {
  ArcElement,
  BarElement,
  CategoryScale,
  Chart as ChartJS,
  LineElement,
  Legend,
  LinearScale,
  PointElement,
  Tooltip,
} from 'chart.js';
import {
  formatTrackedTime,
  secondsToMinutes,
} from './dashboardAnalytics.js';
import { CATEGORY_STYLES } from './dashboardConstants.js';

const CHART_TEXT_COLOR = '#a1a1aa';
const CHART_GRID_COLOR = 'rgba(113, 113, 122, 0.18)';

ChartJS.register(
  ArcElement,
  BarElement,
  CategoryScale,
  LineElement,
  Legend,
  LinearScale,
  PointElement,
  Tooltip,
);

export function getBarChartOptions() {
  return {
    maintainAspectRatio: false,
    plugins: {
      legend: {
        labels: {
          boxHeight: 10,
          boxWidth: 10,
          color: CHART_TEXT_COLOR,
          usePointStyle: true,
        },
      },
      tooltip: {
        callbacks: {
          label(context) {
            const seconds = Number(context.raw || 0) * 60;

            return `${context.dataset.label}: ${formatTrackedTime(seconds)}`;
          },
        },
      },
    },
    responsive: true,
    scales: {
      x: {
        grid: {
          display: false,
        },
        stacked: true,
        ticks: {
          color: CHART_TEXT_COLOR,
        },
      },
      y: {
        beginAtZero: true,
        grid: {
          color: CHART_GRID_COLOR,
        },
        stacked: true,
        ticks: {
          color: CHART_TEXT_COLOR,
          precision: 0,
          callback(value) {
            return `${value}m`;
          },
        },
      },
    },
  };
}

export function getPieChartOptions() {
  return {
    maintainAspectRatio: false,
    plugins: {
      legend: {
        display: false,
      },
      tooltip: {
        callbacks: {
          label(context) {
            return `${context.label}: ${formatTrackedTime(context.raw)}`;
          },
        },
      },
    },
    responsive: true,
  };
}

export function getLineChartOptions() {
  return {
    maintainAspectRatio: false,
    plugins: {
      legend: {
        display: false,
      },
      tooltip: {
        callbacks: {
          label(context) {
            if (context.raw === null) {
              return 'No tracked time';
            }

            return `Productivity score: ${context.raw}%`;
          },
        },
      },
    },
    responsive: true,
    scales: {
      x: {
        grid: {
          display: false,
        },
        ticks: {
          color: CHART_TEXT_COLOR,
        },
      },
      y: {
        beginAtZero: true,
        grid: {
          color: CHART_GRID_COLOR,
        },
        max: 100,
        ticks: {
          color: CHART_TEXT_COLOR,
          callback(value) {
            return `${value}%`;
          },
        },
      },
    },
  };
}

export function buildDailyUsageBarChartData(dailySeries) {
  return {
    datasets: [
      {
        backgroundColor: CATEGORY_STYLES.productive.color,
        borderRadius: 4,
        data: dailySeries.map((day) => secondsToMinutes(day.productiveSeconds)),
        label: CATEGORY_STYLES.productive.label,
      },
      {
        backgroundColor: CATEGORY_STYLES.unproductive.color,
        borderRadius: 4,
        data: dailySeries.map((day) =>
          secondsToMinutes(day.unproductiveSeconds),
        ),
        label: CATEGORY_STYLES.unproductive.label,
      },
      {
        backgroundColor: CATEGORY_STYLES.neutral.color,
        borderRadius: 4,
        data: dailySeries.map((day) => secondsToMinutes(day.neutralSeconds)),
        label: CATEGORY_STYLES.neutral.label,
      },
    ],
    labels: dailySeries.map((day) => day.shortLabel),
  };
}

export function buildProductivityPieChartData(totals) {
  return {
    datasets: [
      {
        backgroundColor: [
          CATEGORY_STYLES.productive.color,
          CATEGORY_STYLES.unproductive.color,
          CATEGORY_STYLES.neutral.color,
        ],
        borderColor: '#09090b',
        borderWidth: 4,
        data: [
          totals.productiveSeconds,
          totals.unproductiveSeconds,
          totals.neutralSeconds,
        ],
        hoverOffset: 4,
      },
    ],
    labels: [
      CATEGORY_STYLES.productive.label,
      CATEGORY_STYLES.unproductive.label,
      CATEGORY_STYLES.neutral.label,
    ],
  };
}

export function buildWeeklyProductivityTrendData(dailySeries) {
  return {
    datasets: [
      {
        backgroundColor: 'rgba(52, 211, 153, 0.12)',
        borderColor: CATEGORY_STYLES.productive.color,
        borderWidth: 2,
        data: dailySeries.map((day) => day.score.value),
        label: 'Productivity score',
        pointBackgroundColor: '#09090b',
        pointBorderColor: CATEGORY_STYLES.productive.color,
        pointBorderWidth: 2,
        pointHoverRadius: 5,
        pointRadius: 4,
        spanGaps: false,
        tension: 0.35,
      },
    ],
    labels: dailySeries.map((day) => day.shortLabel),
  };
}
