import RefreshIcon from 'lucide/dist/esm/icons/refresh-cw.js';
import { useDashboardData } from '../hooks/useDashboardData.js';
import {
  EMPTY_DAILY_SERIES,
  EMPTY_INSIGHTS,
  EMPTY_RANKED_SITES,
  EMPTY_TOTALS,
} from './dashboardConstants.js';
import {
  AnalyticsSummary,
  DailyActivityChart,
  InsightsSection,
  LiveTrackingSummary,
  MostVisitedSites,
  ProductiveUsagePieSection,
  ReportSummary,
  SummaryCards,
  TopSites,
  WeeklyTrendChart,
  WeeklyProductivity,
  WeeklyReportSection,
} from './dashboardSections.jsx';
import {
  DashboardHeader,
  DashboardShell,
  LoadingDashboard,
} from './dashboardUi.jsx';

function Dashboard() {
  const { dashboardState, error, isLoading, isRefreshing, refresh } =
    useDashboardData();
  const analytics = dashboardState?.analytics;
  const activeSession = dashboardState?.activeSession ?? null;
  const dailySeries = analytics?.dailySeries ?? EMPTY_DAILY_SERIES;
  const insights = analytics?.insights ?? EMPTY_INSIGHTS;
  const rankedSites = analytics?.rankedSites ?? EMPTY_RANKED_SITES;
  const weeklyTotals = analytics?.weekly.totals ?? EMPTY_TOTALS;
  const weeklyScore = analytics?.weekly.score;
  const todayTotals = analytics?.today.totals ?? EMPTY_TOTALS;

  return (
    <DashboardShell>
      <DashboardHeader
        isRefreshing={isRefreshing}
        onRefresh={() => refresh()}
        refreshIcon={RefreshIcon}
        subtitle="Local website usage insights from the last seven days."
        title="Analytics dashboard"
      />

      {error ? (
        <p className="mt-4 rounded-lg border border-rose-400/30 bg-rose-400/10 p-4 text-sm text-rose-200">
          {error}
        </p>
      ) : null}

      <div className="mt-6">
        {isLoading ? (
          <LoadingDashboard />
        ) : (
          <div className="space-y-6">
            <SummaryCards
              weeklyScore={weeklyScore}
              weeklyTotals={weeklyTotals}
            />

            <WeeklyReportSection report={analytics?.weeklyReport} />

            <section className="grid gap-5 xl:grid-cols-[1.15fr_1fr]">
              <ReportSummary
                summary={analytics?.weekly.summary}
                todayTotals={todayTotals}
              />
              <LiveTrackingSummary
                activeSession={activeSession}
                context={dashboardState?.context}
                liveError={dashboardState?.liveError}
                settings={dashboardState?.settings}
              />
            </section>

            <section>
              <AnalyticsSummary
                hasData={analytics?.hasData}
                insights={insights}
                weeklyScore={weeklyScore}
              />
            </section>

            <InsightsSection
              hasData={analytics?.hasData}
              insights={insights}
            />

            <section className="grid gap-5 lg:grid-cols-[1.5fr_1fr]">
              <DailyActivityChart
                dailySeries={dailySeries}
                hasData={analytics?.hasData}
              />
              <ProductiveUsagePieSection
                hasData={analytics?.hasData}
                percentages={analytics?.categoryPercentages ?? {}}
                weeklyTotals={weeklyTotals}
              />
            </section>

            <WeeklyTrendChart
              dailySeries={dailySeries}
              hasData={analytics?.hasData}
            />

            <section className="grid gap-5 xl:grid-cols-[1.25fr_1fr]">
              <TopSites sites={analytics?.topSites ?? []} />
              <WeeklyProductivity dailySeries={dailySeries} />
            </section>

            <MostVisitedSites sites={rankedSites.mostVisited} />
          </div>
        )}
      </div>
    </DashboardShell>
  );
}

export default Dashboard;
