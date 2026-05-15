import { memo, useMemo } from 'react';
import { Bar, Line, Pie } from 'react-chartjs-2';
import {
  buildDailyUsageBarChartData,
  buildProductivityPieChartData,
  buildWeeklyProductivityTrendData,
  getBarChartOptions,
  getLineChartOptions,
  getPieChartOptions,
} from './dashboardCharts.js';

export function ResponsiveChartContainer({ children, heightClass = 'h-[300px]' }) {
  return <div className={heightClass}>{children}</div>;
}

function DailyUsageBarChartBase({ dailySeries }) {
  const data = useMemo(
    () => buildDailyUsageBarChartData(dailySeries),
    [dailySeries],
  );
  const options = useMemo(() => getBarChartOptions(), []);

  return <Bar data={data} options={options} />;
}

function ProductiveUsagePieChartBase({ totals }) {
  const data = useMemo(() => buildProductivityPieChartData(totals), [totals]);
  const options = useMemo(() => getPieChartOptions(), []);

  return <Pie data={data} options={options} />;
}

function WeeklyProductivityTrendChartBase({ dailySeries }) {
  const data = useMemo(
    () => buildWeeklyProductivityTrendData(dailySeries),
    [dailySeries],
  );
  const options = useMemo(() => getLineChartOptions(), []);

  return <Line data={data} options={options} />;
}

export const DailyUsageBarChart = memo(DailyUsageBarChartBase);
export const ProductiveUsagePieChart = memo(ProductiveUsagePieChartBase);
export const WeeklyProductivityTrendChart = memo(WeeklyProductivityTrendChartBase);
