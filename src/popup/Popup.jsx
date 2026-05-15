import { useMemo } from 'react';
import ActivityIcon from 'lucide/dist/esm/icons/activity.js';
import BarChartIcon from 'lucide/dist/esm/icons/chart-column.js';
import CheckCircleIcon from 'lucide/dist/esm/icons/circle-check.js';
import ClockIcon from 'lucide/dist/esm/icons/clock.js';
import GaugeIcon from 'lucide/dist/esm/icons/gauge.js';
import GlobeIcon from 'lucide/dist/esm/icons/globe.js';
import LayoutDashboardIcon from 'lucide/dist/esm/icons/layout-dashboard.js';
import PauseCircleIcon from 'lucide/dist/esm/icons/circle-pause.js';
import PowerIcon from 'lucide/dist/esm/icons/power.js';
import RefreshIcon from 'lucide/dist/esm/icons/refresh-cw.js';
import TimerIcon from 'lucide/dist/esm/icons/timer.js';
import TrendingDownIcon from 'lucide/dist/esm/icons/trending-down.js';
import TrendingUpIcon from 'lucide/dist/esm/icons/trending-up.js';
import ZapIcon from 'lucide/dist/esm/icons/zap.js';
import LucideIcon from '../components/LucideIcon.jsx';
import { useCurrentTime } from '../hooks/useCurrentTime.js';
import { usePopupData } from '../hooks/usePopupData.js';
import {
  calculateCategoryPercentages,
  calculateProductivityScore,
  formatTrackedTime,
  getDisplayTotals,
  getLiveElapsedSeconds,
  getProductivitySummary,
} from './popupMetrics.js';

const CATEGORY_STYLES = Object.freeze({
  productive: {
    label: 'Productive',
    icon: TrendingUpIcon,
    text: 'text-emerald-300',
    badge: 'border-emerald-400/30 bg-emerald-400/10 text-emerald-200',
    bar: 'bg-emerald-400',
  },
  unproductive: {
    label: 'Unproductive',
    icon: TrendingDownIcon,
    text: 'text-rose-300',
    badge: 'border-rose-400/30 bg-rose-400/10 text-rose-200',
    bar: 'bg-rose-400',
  },
  neutral: {
    label: 'Neutral',
    icon: ActivityIcon,
    text: 'text-zinc-300',
    badge: 'border-zinc-500/50 bg-zinc-800 text-zinc-200',
    bar: 'bg-zinc-500',
  },
});

function getTrackingStatus(settings, activeSession) {
  if (!settings?.trackingEnabled) {
    return {
      label: 'Tracking off',
      icon: PauseCircleIcon,
      tone: 'bg-zinc-700 text-zinc-200',
    };
  }

  if (activeSession?.isTracking) {
    return {
      label: 'Tracking',
      icon: CheckCircleIcon,
      tone: 'bg-emerald-400/15 text-emerald-200',
    };
  }

  if (activeSession) {
    return {
      label: 'Paused',
      icon: PauseCircleIcon,
      tone: 'bg-amber-400/15 text-amber-200',
    };
  }

  return {
    label: 'Waiting',
    icon: ClockIcon,
    tone: 'bg-zinc-800 text-zinc-300',
  };
}

function CategoryBadge({ category }) {
  const style = CATEGORY_STYLES[category] ?? CATEGORY_STYLES.neutral;

  return (
    <span className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] font-medium ${style.badge}`}>
      <LucideIcon className="h-3 w-3" icon={style.icon} strokeWidth={2.25} />
      {style.label}
    </span>
  );
}

function StatTile({ icon, label, value, tone = 'text-zinc-100' }) {
  return (
    <div className="min-h-[74px] rounded-md border border-zinc-800 bg-zinc-950 px-3 py-2.5">
      <div className="flex items-center gap-2 text-zinc-500">
        <LucideIcon className="h-3.5 w-3.5" icon={icon} />
        <p className="text-[11px] uppercase">{label}</p>
      </div>
      <p className={`mt-1.5 text-base font-semibold ${tone}`}>{value}</p>
    </div>
  );
}

function UsageBar({ totals }) {
  const percentages = calculateCategoryPercentages(totals);

  return (
    <div className="h-2 overflow-hidden rounded-full bg-zinc-800">
      <div className="flex h-full">
        <div
          className={CATEGORY_STYLES.productive.bar}
          style={{ width: `${percentages.productive}%` }}
        />
        <div
          className={CATEGORY_STYLES.unproductive.bar}
          style={{ width: `${percentages.unproductive}%` }}
        />
        <div
          className={CATEGORY_STYLES.neutral.bar}
          style={{ width: `${percentages.neutral}%` }}
        />
      </div>
    </div>
  );
}

function Toggle({ checked, disabled, onChange }) {
  return (
    <button
      aria-checked={checked}
      className={`relative h-6 w-11 rounded-full border transition ${
        checked
          ? 'border-emerald-400/40 bg-emerald-400/20'
          : 'border-zinc-700 bg-zinc-800'
      }`}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      role="switch"
      type="button"
    >
      <span className="sr-only">{checked ? 'Disable tracking' : 'Enable tracking'}</span>
      <span
        className={`absolute top-1 h-4 w-4 rounded-full bg-zinc-100 transition ${
          checked ? 'left-6' : 'left-1'
        }`}
      />
    </button>
  );
}

function ActiveSession({ session, liveSeconds }) {
  if (!session) {
    return (
      <section className="rounded-md border border-dashed border-zinc-800 bg-zinc-950 p-3.5">
        <div className="flex items-center gap-2">
          <LucideIcon className="h-4 w-4 text-zinc-500" icon={GlobeIcon} />
          <p className="text-sm font-medium text-zinc-200">No active website</p>
        </div>
        <p className="mt-1 text-xs text-zinc-500">
          Open a normal website tab to start tracking.
        </p>
      </section>
    );
  }

  const categoryStyle =
    CATEGORY_STYLES[session.category] ?? CATEGORY_STYLES.neutral;

  return (
    <section className="rounded-md border border-zinc-800 bg-zinc-950 p-3.5">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <LucideIcon className={`h-4 w-4 ${categoryStyle.text}`} icon={GlobeIcon} />
            <p className="truncate text-sm font-semibold text-zinc-100">
              {session.domain}
            </p>
          </div>
          <p className="mt-1 truncate text-xs text-zinc-500">
            {session.title || 'Current tab'}
          </p>
        </div>
        <CategoryBadge category={session.category} />
      </div>

      <div className="mt-4 flex items-end justify-between">
        <div>
          <div className="flex items-center gap-1.5 text-zinc-500">
            <LucideIcon className="h-3.5 w-3.5" icon={TimerIcon} />
            <p className="text-[11px] uppercase">Live session</p>
          </div>
          <p className="mt-1 text-2xl font-semibold text-zinc-50">
            {session.isTracking ? formatTrackedTime(liveSeconds) : 'Paused'}
          </p>
        </div>
        <p className="text-xs text-zinc-500">
          {session.isTracking ? 'Counting now' : session.pauseReason ?? 'Paused'}
        </p>
      </div>
    </section>
  );
}

function TopSites({ sites }) {
  const topSites = sites.slice(0, 4);

  return (
    <section className="space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <LucideIcon className="h-4 w-4 text-zinc-500" icon={BarChartIcon} />
          <h2 className="text-sm font-semibold text-zinc-100">Top sites today</h2>
        </div>
        <span className="text-xs text-zinc-500">{sites.length} tracked</span>
      </div>

      {topSites.length === 0 ? (
        <div className="rounded-md border border-dashed border-zinc-800 bg-zinc-950 p-3.5">
          <div className="flex items-center gap-2 text-zinc-500">
            <LucideIcon className="h-4 w-4" icon={BarChartIcon} />
            <p className="text-sm font-medium text-zinc-300">No site totals yet</p>
          </div>
          <p className="mt-1 text-xs text-zinc-500">
            Sites appear here after tracked time is committed.
          </p>
        </div>
      ) : (
        <div className="space-y-2">
          {topSites.map((site) => {
            const style = CATEGORY_STYLES[site.category] ?? CATEGORY_STYLES.neutral;

            return (
              <div
                className="flex items-center justify-between gap-3 rounded-md border border-zinc-800 bg-zinc-950 px-3 py-2"
                key={site.domain}
              >
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <LucideIcon className={`h-3.5 w-3.5 ${style.text}`} icon={style.icon} />
                    <p className="truncate text-sm text-zinc-200">{site.domain}</p>
                  </div>
                  <p className={`mt-0.5 text-xs ${style.text}`}>{style.label}</p>
                </div>
                <p className="shrink-0 text-sm font-medium text-zinc-100">
                  {site.time}
                </p>
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
}

function LoadingBlock({ className = '' }) {
  return <div className={`rounded bg-zinc-800/80 ${className}`} />;
}

function LoadingState() {
  return (
    <div className="mt-4 space-y-4">
      <section className="rounded-md border border-zinc-800 bg-zinc-950 p-3.5">
        <div className="flex items-center justify-between gap-3">
          <div className="flex min-w-0 items-center gap-2">
            <LucideIcon className="h-4 w-4 text-zinc-600" icon={GlobeIcon} />
            <div className="min-w-0 flex-1 space-y-2">
              <LoadingBlock className="h-3 w-32" />
              <LoadingBlock className="h-2.5 w-44" />
            </div>
          </div>
          <LoadingBlock className="h-5 w-20 rounded-full" />
        </div>
        <div className="mt-4 space-y-2">
          <LoadingBlock className="h-2.5 w-24" />
          <LoadingBlock className="h-7 w-28" />
        </div>
      </section>

      <section className="space-y-3">
        <div className="flex items-end justify-between">
          <div className="space-y-2">
            <LoadingBlock className="h-3 w-36" />
            <LoadingBlock className="h-2.5 w-44" />
          </div>
          <LoadingBlock className="h-8 w-14" />
        </div>
        <LoadingBlock className="h-2 w-full rounded-full" />
      </section>

      <section className="grid grid-cols-2 gap-2">
        <LoadingBlock className="h-[74px]" />
        <LoadingBlock className="h-[74px]" />
        <LoadingBlock className="h-[74px]" />
        <LoadingBlock className="h-[74px]" />
      </section>
    </div>
  );
}

function openDashboard() {
  const runtime = globalThis.chrome?.runtime;
  const tabs = globalThis.chrome?.tabs;

  if (!runtime?.getURL) {
    return;
  }

  const manifest = runtime.getManifest?.();
  const defaultPopup = manifest?.action?.default_popup ?? '';
  const dashboardPath = defaultPopup.startsWith('dist/')
    ? 'dist/dashboard.html'
    : 'dashboard.html';
  const dashboardUrl = runtime.getURL(dashboardPath);

  if (tabs?.create) {
    tabs.create({ url: dashboardUrl }, () => {
      const error = runtime.lastError;

      if (error) {
        console.error(
          '[Productivity Tracker][popup] failed to open dashboard tab',
          error,
        );
        window.open(dashboardUrl, '_blank');
      }
    });
    return;
  }

  window.open(dashboardUrl, '_blank');
}

function Popup() {
  const {
    error,
    isLoading,
    isRefreshing,
    isSaving,
    popupState,
    refresh,
    setTrackingEnabled,
  } = usePopupData();
  const now = useCurrentTime();
  const today = popupState?.today;
  const settings = today?.settings ?? {};
  const activeSession = today?.activeSession ?? null;
  const liveSeconds = getLiveElapsedSeconds(activeSession, now, settings);
  const totals = useMemo(
    () => getDisplayTotals(today?.totals, activeSession, liveSeconds),
    [activeSession, liveSeconds, today?.totals],
  );
  const productivityScore = useMemo(
    () => calculateProductivityScore(totals),
    [totals],
  );
  const productivitySummary = useMemo(
    () => getProductivitySummary(totals),
    [totals],
  );
  const trackingStatus = getTrackingStatus(settings, activeSession);
  const sites = today?.sites ?? [];

  return (
    <main className="min-h-[540px] w-[360px] bg-zinc-950 p-4 text-zinc-100">
      <header className="flex items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 text-zinc-500">
            <LucideIcon className="h-3.5 w-3.5" icon={ZapIcon} />
            <p className="text-[11px] uppercase">Productivity Tracker</p>
          </div>
          <h1 className="mt-1 text-xl font-semibold text-zinc-50">
            Today overview
          </h1>
        </div>
        <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs ${trackingStatus.tone}`}>
          <LucideIcon className="h-3.5 w-3.5" icon={trackingStatus.icon} />
          {trackingStatus.label}
        </span>
      </header>

      <div className="mt-4 flex items-center justify-between rounded-md border border-zinc-800 bg-zinc-900/70 p-3">
        <div className="flex items-center gap-2.5">
          <span className="flex h-8 w-8 items-center justify-center rounded-md bg-zinc-950 text-zinc-400">
            <LucideIcon className="h-4 w-4" icon={PowerIcon} />
          </span>
          <div>
            <p className="text-sm font-medium text-zinc-200">Tracking</p>
            <p className="text-xs text-zinc-500">
              {settings.trackingEnabled
                ? 'Local analytics enabled'
                : 'Paused by user'}
            </p>
          </div>
        </div>
        <Toggle
          checked={settings.trackingEnabled !== false}
          disabled={isSaving}
          onChange={setTrackingEnabled}
        />
      </div>

      {error ? (
        <p className="mt-3 rounded-md border border-rose-400/30 bg-rose-400/10 p-3 text-xs text-rose-200">
          {error}
        </p>
      ) : null}

      {isLoading ? (
        <LoadingState />
      ) : (
        <div className="mt-4 space-y-4">
          <ActiveSession session={activeSession} liveSeconds={liveSeconds} />

          <section className="space-y-3">
            <div className="flex items-end justify-between">
              <div>
                <div className="flex items-center gap-2">
                  <LucideIcon className="h-4 w-4 text-zinc-500" icon={GaugeIcon} />
                  <h2 className="text-sm font-semibold text-zinc-100">
                    Productivity score
                  </h2>
                </div>
                <p className="text-xs text-zinc-500">Based on tracked time today</p>
              </div>
              <p className="text-3xl font-semibold text-zinc-50">
                {productivityScore.label}
              </p>
            </div>
            <UsageBar totals={totals} />
            <p className="rounded-md border border-zinc-800 bg-zinc-950 px-3 py-2 text-xs text-zinc-400">
              {productivitySummary}
            </p>
          </section>

          <section className="grid grid-cols-2 gap-2">
            <StatTile
              icon={ClockIcon}
              label="Total"
              value={formatTrackedTime(totals.totalSeconds)}
            />
            <StatTile
              icon={TrendingUpIcon}
              label="Productive"
              tone="text-emerald-300"
              value={formatTrackedTime(totals.productiveSeconds)}
            />
            <StatTile
              icon={TrendingDownIcon}
              label="Unproductive"
              tone="text-rose-300"
              value={formatTrackedTime(totals.unproductiveSeconds)}
            />
            <StatTile
              icon={ActivityIcon}
              label="Neutral"
              tone="text-zinc-300"
              value={formatTrackedTime(totals.neutralSeconds)}
            />
          </section>

          <TopSites sites={sites} />
        </div>
      )}

      <footer className="mt-4 flex items-center justify-between gap-2 border-t border-zinc-800 pt-3">
        <p className="text-xs text-zinc-500">
          {popupState?.validation?.isValid === false
            ? 'Storage needs review'
            : 'Stored locally'}
        </p>
        <div className="flex items-center gap-2">
          <button
            className="inline-flex items-center gap-1.5 rounded-md border border-zinc-700 px-2.5 py-1.5 text-xs font-medium text-zinc-200 transition hover:border-zinc-500 hover:bg-zinc-900"
            onClick={openDashboard}
            type="button"
          >
            <LucideIcon className="h-3.5 w-3.5" icon={LayoutDashboardIcon} />
            Dashboard
          </button>
          <button
            className="inline-flex items-center gap-1.5 rounded-md border border-zinc-700 px-2.5 py-1.5 text-xs font-medium text-zinc-200 transition hover:border-zinc-500 hover:bg-zinc-900 disabled:cursor-not-allowed disabled:opacity-60"
            disabled={isRefreshing}
            onClick={() => refresh()}
            type="button"
          >
            <LucideIcon
              className={`h-3.5 w-3.5 ${isRefreshing ? 'animate-spin' : ''}`}
              icon={RefreshIcon}
            />
            {isRefreshing ? 'Refreshing' : 'Refresh'}
          </button>
        </div>
      </footer>
    </main>
  );
}

export default Popup;
