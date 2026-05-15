import ActivityIcon from 'lucide/dist/esm/icons/activity.js';
import BarChartIcon from 'lucide/dist/esm/icons/chart-column.js';
import CalendarDaysIcon from 'lucide/dist/esm/icons/calendar-days.js';
import ClockIcon from 'lucide/dist/esm/icons/clock.js';
import GaugeIcon from 'lucide/dist/esm/icons/gauge.js';
import GlobeIcon from 'lucide/dist/esm/icons/globe.js';
import LightbulbIcon from 'lucide/dist/esm/icons/lightbulb.js';
import ListOrderedIcon from 'lucide/dist/esm/icons/list-ordered.js';
import TargetIcon from 'lucide/dist/esm/icons/target.js';
import TrendingDownIcon from 'lucide/dist/esm/icons/trending-down.js';
import TrendingUpIcon from 'lucide/dist/esm/icons/trending-up.js';
import LucideIcon from '../components/LucideIcon.jsx';
import { useCurrentTime } from '../hooks/useCurrentTime.js';
import { getLiveElapsedSeconds } from '../utils/liveSessionTime.js';
import { formatTrackedTime } from './dashboardAnalytics.js';
import {
  DailyUsageBarChart,
  ProductiveUsagePieChart,
  ResponsiveChartContainer,
  WeeklyProductivityTrendChart,
} from './dashboardChartComponents.jsx';
import { CATEGORY_STYLES } from './dashboardConstants.js';
import {
  ChartCard,
  EmptyPanel,
  MetricCard,
  SectionCard,
} from './dashboardUi.jsx';

const CATEGORY_BADGE_STYLES = Object.freeze({
  productive: 'border-emerald-400/30 bg-emerald-400/10 text-emerald-200',
  unproductive: 'border-rose-400/30 bg-rose-400/10 text-rose-200',
  neutral: 'border-zinc-500/50 bg-zinc-800 text-zinc-200',
});

const INSIGHT_TONE_STYLES = Object.freeze({
  productive: 'border-emerald-400/20 bg-emerald-400/5',
  unproductive: 'border-rose-400/20 bg-rose-400/5',
  neutral: 'border-zinc-800 bg-zinc-900/60',
});

const REPORT_TONE_STYLES = Object.freeze({
  productive: {
    badge: 'border-emerald-400/30 bg-emerald-400/10 text-emerald-200',
    text: 'text-emerald-300',
  },
  unproductive: {
    badge: 'border-rose-400/30 bg-rose-400/10 text-rose-200',
    text: 'text-rose-300',
  },
  neutral: {
    badge: 'border-zinc-700 bg-zinc-900 text-zinc-200',
    text: 'text-zinc-200',
  },
});

function CategoryBadge({ category }) {
  const style = CATEGORY_STYLES[category] ?? CATEGORY_STYLES.neutral;
  const badgeStyle =
    CATEGORY_BADGE_STYLES[category] ?? CATEGORY_BADGE_STYLES.neutral;

  return (
    <span
      className={`inline-flex w-fit items-center rounded-full border px-2 py-0.5 text-xs font-medium ${badgeStyle}`}
    >
      {style.label}
    </span>
  );
}

function CategoryLegend({ percentages }) {
  return (
    <div className="mt-5 grid grid-cols-1 gap-2 sm:grid-cols-3">
      {Object.entries(CATEGORY_STYLES).map(([category, style]) => (
        <div
          className="rounded-md border border-zinc-800 bg-zinc-900/60 p-3"
          key={category}
        >
          <div className="flex items-center gap-2">
            <span
              className="h-2.5 w-2.5 rounded-full"
              style={{ backgroundColor: style.color }}
            />
            <p className="text-xs text-zinc-400">{style.label}</p>
          </div>
          <p className={`mt-2 text-lg font-semibold ${style.text}`}>
            {percentages[category] ?? 0}%
          </p>
        </div>
      ))}
    </div>
  );
}

export function InsightsSection({ hasData, insights }) {
  return (
    <SectionCard
      icon={LightbulbIcon}
      subtitle="Simple conclusions from local weekly usage data"
      title="Productivity insights"
    >
      {!hasData ? (
        <EmptyPanel message="Insights appear after tracked website activity is committed." />
      ) : (
        <div className="mt-5 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
          {insights.cards.map((insight) => (
            <div
              className={`min-h-[132px] rounded-md border p-3 ${INSIGHT_TONE_STYLES[insight.tone] ?? INSIGHT_TONE_STYLES.neutral}`}
              key={insight.id}
            >
              <p className="text-xs uppercase text-zinc-500">
                {insight.label}
              </p>
              <p className="mt-2 break-words text-sm font-semibold text-zinc-100">
                {insight.value}
              </p>
              <p className="mt-2 text-xs leading-5 text-zinc-500">
                {insight.description}
              </p>
            </div>
          ))}
        </div>
      )}
    </SectionCard>
  );
}

export function AnalyticsSummary({ hasData, insights, weeklyScore }) {
  const trendTone =
    insights.trend.direction === 'positive'
      ? 'text-emerald-300'
      : insights.trend.direction === 'negative'
        ? 'text-rose-300'
        : 'text-zinc-300';

  return (
    <SectionCard
      subtitle="A concise readout of the current weekly report"
      title="Analytics summary"
    >
      {!hasData ? (
        <EmptyPanel message="Summary appears after the first tracked sessions are committed." />
      ) : (
        <div className="mt-5 grid gap-3 md:grid-cols-3">
          <div className="min-h-[104px] rounded-md border border-zinc-800 bg-zinc-900/50 p-3">
            <p className="text-xs uppercase text-zinc-500">Weekly score</p>
            <p className="mt-2 text-xl font-semibold text-zinc-100">
              {weeklyScore?.label ?? '--'}
            </p>
          </div>
          <div className="min-h-[104px] rounded-md border border-zinc-800 bg-zinc-900/50 p-3">
            <p className="text-xs uppercase text-zinc-500">Trend</p>
            <p className={`mt-2 text-sm font-semibold ${trendTone}`}>
              {insights.trend.label}
            </p>
            <p className="mt-1 text-xs leading-5 text-zinc-500">
              {insights.trend.summary}
            </p>
          </div>
          <div className="min-h-[104px] rounded-md border border-zinc-800 bg-zinc-900/50 p-3">
            <p className="text-xs uppercase text-zinc-500">Tracked days</p>
            <p className="mt-2 text-xl font-semibold text-zinc-100">
              {insights.trackedDayCount}
            </p>
          </div>
        </div>
      )}
    </SectionCard>
  );
}

export function SummaryCards({ weeklyScore, weeklyTotals }) {
  return (
    <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
      <MetricCard
        icon={ClockIcon}
        label="This week"
        value={formatTrackedTime(weeklyTotals.totalSeconds)}
      />
      <MetricCard
        icon={TrendingUpIcon}
        label="Productive"
        tone="text-emerald-300"
        value={formatTrackedTime(weeklyTotals.productiveSeconds)}
      />
      <MetricCard
        icon={TrendingDownIcon}
        label="Unproductive"
        tone="text-rose-300"
        value={formatTrackedTime(weeklyTotals.unproductiveSeconds)}
      />
      <MetricCard
        icon={GaugeIcon}
        label="Weekly score"
        value={weeklyScore?.label ?? '--'}
      />
    </section>
  );
}

function ReportMetric({ label, value, helper }) {
  return (
    <div className="min-h-[108px] rounded-md border border-zinc-800 bg-zinc-900/50 p-3">
      <p className="text-xs uppercase text-zinc-500">{label}</p>
      <p className="mt-2 text-lg font-semibold text-zinc-100">{value}</p>
      {helper ? (
        <p className="mt-1 text-xs leading-5 text-zinc-500">{helper}</p>
      ) : null}
    </div>
  );
}

function ReportHighlight({ label, seconds, site, fallback }) {
  if (!site) {
    return (
      <ReportMetric
        helper="This appears after enough categorized site time is committed."
        label={label}
        value={fallback}
      />
    );
  }

  return (
    <div className="min-h-[108px] rounded-md border border-zinc-800 bg-zinc-900/50 p-3">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-xs uppercase text-zinc-500">{label}</p>
          <p className="mt-2 truncate text-sm font-semibold text-zinc-100">
            {site.domain}
          </p>
        </div>
        <CategoryBadge category={site.category} />
      </div>
      <p className="mt-2 text-xs text-zinc-500">
        {formatTrackedTime(seconds ?? site.seconds)} tracked · {site.visits} visit
        {site.visits === 1 ? '' : 's'}
      </p>
    </div>
  );
}

export function WeeklyReportSection({ report }) {
  const tone =
    REPORT_TONE_STYLES[report?.status?.tone] ?? REPORT_TONE_STYLES.neutral;
  const trendTone =
    report?.trend?.direction === 'positive'
      ? 'text-emerald-300'
      : report?.trend?.direction === 'negative'
        ? 'text-rose-300'
        : 'text-zinc-300';

  return (
    <SectionCard
      icon={CalendarDaysIcon}
      subtitle="A practical report built from the last seven days of local tracking data"
      title="Weekly productivity report"
    >
      {!report?.hasData ? (
        <EmptyPanel message="The weekly report appears after tracked website sessions are committed." />
      ) : (
        <div className="mt-5 space-y-4">
          <div className="rounded-md border border-zinc-800 bg-zinc-900/50 p-4">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <span className={`rounded-full border px-2.5 py-1 text-xs font-medium ${tone.badge}`}>
                    {report.status.label}
                  </span>
                  <span className="text-xs text-zinc-500">
                    {report.dateRangeLabel}
                  </span>
                </div>
                <p className="mt-3 max-w-3xl text-sm leading-6 text-zinc-400">
                  {report.status.summary}
                </p>
              </div>
              <div className="shrink-0">
                <div className="flex items-center gap-2 text-zinc-500">
                  <LucideIcon className="h-4 w-4" icon={TargetIcon} />
                  <p className="text-xs uppercase">Productivity score</p>
                </div>
                <p className={`mt-1 text-3xl font-semibold ${tone.text}`}>
                  {report.score.label}
                </p>
              </div>
            </div>
          </div>

          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
            <ReportMetric
              helper={`${report.trackedDayCount} tracked day${report.trackedDayCount === 1 ? '' : 's'} this week`}
              label="Average daily time"
              value={formatTrackedTime(report.averageDailySeconds)}
            />
            <ReportMetric
              helper="Average productive time on tracked days"
              label="Avg productive time"
              value={formatTrackedTime(report.averageProductiveSeconds)}
            />
            <ReportMetric
              helper="Average unproductive time on tracked days"
              label="Avg distracting time"
              value={formatTrackedTime(report.averageUnproductiveSeconds)}
            />
            <ReportMetric
              helper={report.trend.summary}
              label="Weekly trend"
              value={
                <span className={trendTone}>{report.trend.label}</span>
              }
            />
          </div>

          <div className="grid gap-3 lg:grid-cols-3">
            <ReportMetric
              helper={
                report.mostProductiveDay
                  ? `${report.mostProductiveDay.label} had the most productive time.`
                  : 'No productive day has been recorded yet.'
              }
              label="Most productive day"
              value={
                report.mostProductiveDay
                  ? `${report.mostProductiveDay.shortLabel} · ${formatTrackedTime(
                      report.mostProductiveDay.productiveSeconds,
                    )}`
                  : '--'
              }
            />
            <ReportHighlight
              fallback="--"
              label="Top productive website"
              seconds={report.topProductiveSite?.productiveSeconds}
              site={report.topProductiveSite}
            />
            <ReportHighlight
              fallback="--"
              label="Most distracting website"
              seconds={report.mostDistractingSite?.unproductiveSeconds}
              site={report.mostDistractingSite}
            />
          </div>
        </div>
      )}
    </SectionCard>
  );
}

export function ReportSummary({ summary, todayTotals }) {
  return (
    <SectionCard subtitle={summary} title="Report summary">
      <div className="mt-5 flex flex-col gap-3 rounded-md border border-zinc-800 bg-zinc-900/50 px-3 py-2.5 md:flex-row md:items-center md:justify-between">
        <p className="text-sm text-zinc-400">
          Today: {formatTrackedTime(todayTotals.totalSeconds)}
        </p>
        <p className="text-sm text-zinc-500">
          Data is stored locally in this browser.
        </p>
      </div>
    </SectionCard>
  );
}

export function LiveTrackingSummary({
  activeSession,
  context,
  liveError,
  settings,
}) {
  const now = useCurrentTime();
  const liveSeconds = getLiveElapsedSeconds(activeSession, now, settings);
  const statusLabel = activeSession?.isTracking
    ? 'Counting now'
    : activeSession
      ? 'Paused'
      : 'Waiting';
  const browserState = context
    ? context.browserFocused
      ? 'Chrome focused'
      : 'Chrome not focused'
    : 'Focus unknown';
  const idleState = context?.idleState ?? 'unknown';

  return (
    <SectionCard
      icon={ActivityIcon}
      subtitle="Current state from the background service worker"
      title="Live tracking"
    >
      {liveError ? (
        <p className="mt-4 rounded-md border border-amber-400/30 bg-amber-400/10 p-3 text-sm text-amber-100">
          Live state unavailable. Stored analytics are still shown.
        </p>
      ) : null}

      {!activeSession ? (
        <EmptyPanel
          message="No active website is being tracked right now."
          minHeightClass="min-h-[120px]"
        />
      ) : (
        <div className="mt-5 rounded-md border border-zinc-800 bg-zinc-900/50 p-3">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <LucideIcon className="h-4 w-4 text-zinc-500" icon={GlobeIcon} />
                <p className="truncate text-sm font-semibold text-zinc-100">
                  {activeSession.domain}
                </p>
              </div>
              <p className="mt-1 truncate text-xs text-zinc-500">
                {activeSession.title || 'Current tab'}
              </p>
            </div>
            <CategoryBadge category={activeSession.category} />
          </div>

          <div className="mt-5 grid gap-3 sm:grid-cols-3">
            <div>
              <p className="text-xs uppercase text-zinc-500">Session</p>
              <p className="mt-1 text-lg font-semibold text-zinc-100">
                {activeSession.isTracking
                  ? formatTrackedTime(liveSeconds)
                  : 'Paused'}
              </p>
            </div>
            <div>
              <p className="text-xs uppercase text-zinc-500">Status</p>
              <p className="mt-1 text-sm font-medium text-zinc-200">
                {statusLabel}
              </p>
            </div>
            <div>
              <p className="text-xs uppercase text-zinc-500">Context</p>
              <p className="mt-1 text-sm font-medium text-zinc-200">
                {browserState}
              </p>
              <p className="text-xs capitalize text-zinc-500">{idleState}</p>
            </div>
          </div>
        </div>
      )}
    </SectionCard>
  );
}

export function DailyActivityChart({ dailySeries, hasData }) {
  return (
    <ChartCard
      hasData={hasData}
      subtitle="Stacked minutes by category"
      title="Daily activity"
    >
      <DailyUsageBarChart dailySeries={dailySeries} />
    </ChartCard>
  );
}

export function ProductiveUsagePieSection({
  hasData,
  percentages,
  weeklyTotals,
}) {
  return (
    <ChartCard
      hasData={hasData}
      subtitle="Share of productive, unproductive, and neutral time"
      title="Productive vs unproductive"
    >
      <ResponsiveChartContainer heightClass="h-[210px]">
        <ProductiveUsagePieChart totals={weeklyTotals} />
      </ResponsiveChartContainer>
      <CategoryLegend percentages={percentages} />
    </ChartCard>
  );
}

export function WeeklyTrendChart({ dailySeries, hasData }) {
  return (
    <ChartCard
      hasData={hasData}
      subtitle="Daily productivity score across the current week"
      title="Weekly productivity trend"
    >
      <WeeklyProductivityTrendChart dailySeries={dailySeries} />
    </ChartCard>
  );
}

export function TopSites({ sites }) {
  const maxSeconds = sites[0]?.seconds || 0;

  return (
    <SectionCard
      icon={GlobeIcon}
      subtitle="Ranked by tracked time in the last seven days"
      title="Top websites"
    >
      {sites.length === 0 ? (
        <EmptyPanel message="Sites appear here after sessions are committed." />
      ) : (
        <div className="mt-5 overflow-x-auto rounded-md border border-zinc-800">
          <table className="w-full min-w-[620px] border-collapse text-left text-sm">
            <thead className="bg-zinc-900 text-xs uppercase text-zinc-500">
              <tr>
                <th className="px-4 py-3 font-medium">Website</th>
                <th className="px-4 py-3 font-medium">Category</th>
                <th className="px-4 py-3 font-medium">Visits</th>
                <th className="px-4 py-3 text-right font-medium">Time</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-800">
              {sites.map((site) => {
                const categoryStyle =
                  CATEGORY_STYLES[site.category] ?? CATEGORY_STYLES.neutral;
                const width =
                  maxSeconds > 0
                    ? `${Math.max(4, (site.seconds / maxSeconds) * 100)}%`
                    : '0%';

                return (
                  <tr className="bg-zinc-950 align-top" key={site.domain}>
                    <td className="px-4 py-3">
                      <div className="min-w-0">
                        <p className="truncate font-medium text-zinc-100">
                          {site.domain}
                        </p>
                        <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-zinc-800">
                          <div
                            className={`h-full ${categoryStyle.bar}`}
                            style={{ width }}
                          />
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <CategoryBadge category={site.category} />
                    </td>
                    <td className="px-4 py-3 text-zinc-400">
                      {site.visits}
                    </td>
                    <td className="px-4 py-3 text-right font-medium text-zinc-100">
                      {formatTrackedTime(site.seconds)}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </SectionCard>
  );
}

export function MostVisitedSites({ sites }) {
  return (
    <SectionCard
      icon={ListOrderedIcon}
      subtitle="Ranked by visit count in the last seven days"
      title="Most visited websites"
    >
      {sites.length === 0 ? (
        <EmptyPanel message="Most visited websites appear after tracked sessions are committed." />
      ) : (
        <div className="mt-5 space-y-2">
          {sites.slice(0, 6).map((site, index) => (
            <div
              className="grid gap-3 rounded-md border border-zinc-800 bg-zinc-900/50 px-3 py-3 sm:grid-cols-[40px_1fr] lg:grid-cols-[40px_1fr_auto] lg:items-center"
              key={site.domain}
            >
              <p className="text-sm font-semibold text-zinc-500">
                #{index + 1}
              </p>
              <div className="min-w-0">
                <p className="truncate text-sm font-medium text-zinc-100">
                  {site.domain}
                </p>
                <p className="mt-0.5 text-xs text-zinc-500">
                  {formatTrackedTime(site.seconds)} total
                </p>
              </div>
              <div className="flex items-center gap-2 sm:col-start-2 lg:col-start-auto">
                <CategoryBadge category={site.category} />
                <p className="text-sm font-medium text-zinc-100">
                  {site.visits} visit{site.visits === 1 ? '' : 's'}
                </p>
              </div>
            </div>
          ))}
        </div>
      )}
    </SectionCard>
  );
}

export function WeeklyProductivity({ dailySeries }) {
  return (
    <SectionCard
      icon={BarChartIcon}
      subtitle="Daily category split for the current report window"
      title="Weekly productivity"
    >
      <div className="mt-5 space-y-4">
        {dailySeries.map((day) => {
          const productiveWidth =
            day.totalSeconds > 0
              ? `${(day.productiveSeconds / day.totalSeconds) * 100}%`
              : '0%';
          const unproductiveWidth =
            day.totalSeconds > 0
              ? `${(day.unproductiveSeconds / day.totalSeconds) * 100}%`
              : '0%';
          const neutralWidth =
            day.totalSeconds > 0
              ? `${(day.neutralSeconds / day.totalSeconds) * 100}%`
              : '0%';

          return (
            <div
              className="grid gap-2 md:grid-cols-[96px_1fr_84px] md:gap-3"
              key={day.dateKey}
            >
              <div>
                <p className="text-sm font-medium text-zinc-200">
                  {day.shortLabel}
                </p>
                <p className="text-xs text-zinc-500">{day.label}</p>
              </div>
              <div className="flex items-center">
                <div className="flex h-2.5 w-full overflow-hidden rounded-full bg-zinc-800">
                  <div
                    className={CATEGORY_STYLES.productive.bar}
                    style={{ width: productiveWidth }}
                  />
                  <div
                    className={CATEGORY_STYLES.unproductive.bar}
                    style={{ width: unproductiveWidth }}
                  />
                  <div
                    className={CATEGORY_STYLES.neutral.bar}
                    style={{ width: neutralWidth }}
                  />
                </div>
              </div>
              <p className="text-left text-sm font-medium text-zinc-100 md:text-right">
                {formatTrackedTime(day.totalSeconds)}
              </p>
            </div>
          );
        })}
      </div>
    </SectionCard>
  );
}
