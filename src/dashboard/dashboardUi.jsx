import ActivityIcon from 'lucide/dist/esm/icons/activity.js';
import LucideIcon from '../components/LucideIcon.jsx';

export function DashboardShell({ children }) {
  return (
    <main className="min-h-screen bg-zinc-950 text-zinc-100">
      <div className="mx-auto max-w-7xl px-4 py-5 sm:px-6 sm:py-7 lg:px-8">
        {children}
      </div>
    </main>
  );
}

export function DashboardHeader({
  eyebrow = 'Productivity Tracker',
  isRefreshing,
  onRefresh,
  refreshIcon,
  subtitle,
  title,
}) {
  return (
    <header className="flex flex-col gap-4 border-b border-zinc-800 pb-6 md:flex-row md:items-end md:justify-between">
      <div className="min-w-0">
        <div className="flex items-center gap-2 text-zinc-500">
          <LucideIcon className="h-4 w-4" icon={ActivityIcon} />
          <p className="text-xs uppercase">{eyebrow}</p>
        </div>
        <h1 className="mt-2 text-2xl font-semibold text-zinc-50 sm:text-3xl">
          {title}
        </h1>
        <p className="mt-2 max-w-3xl text-sm leading-6 text-zinc-400">
          {subtitle}
        </p>
      </div>

      <button
        className="inline-flex w-full items-center justify-center gap-2 rounded-md border border-zinc-700 px-3 py-2 text-sm font-medium text-zinc-200 transition hover:border-zinc-500 hover:bg-zinc-900 disabled:cursor-not-allowed disabled:opacity-60 sm:w-fit"
        disabled={isRefreshing}
        onClick={onRefresh}
        type="button"
      >
        <LucideIcon
          className={`h-4 w-4 ${isRefreshing ? 'animate-spin' : ''}`}
          icon={refreshIcon}
        />
        {isRefreshing ? 'Refreshing' : 'Refresh'}
      </button>
    </header>
  );
}

export function MetricCard({ icon, label, tone = 'text-zinc-100', value }) {
  return (
    <section className="min-h-[112px] rounded-lg border border-zinc-800 bg-zinc-950 p-4">
      <div className="flex items-center gap-2 text-zinc-500">
        <LucideIcon className="h-4 w-4" icon={icon} />
        <p className="text-xs uppercase">{label}</p>
      </div>
      <p className={`mt-4 text-2xl font-semibold ${tone}`}>{value}</p>
    </section>
  );
}

export function SectionCard({ children, icon, subtitle, title }) {
  return (
    <section className="min-w-0 rounded-lg border border-zinc-800 bg-zinc-950 p-4 sm:p-5">
      <SectionHeader icon={icon} subtitle={subtitle} title={title} />
      {children}
    </section>
  );
}

export function SectionHeader({ icon, subtitle, title }) {
  return (
    <div className="flex items-start justify-between gap-4">
      <div className="min-w-0">
        <h2 className="text-base font-semibold text-zinc-100">{title}</h2>
        {subtitle ? (
          <p className="mt-1 max-w-3xl text-sm leading-6 text-zinc-500">
            {subtitle}
          </p>
        ) : null}
      </div>
      {icon ? (
        <span className="hidden h-9 w-9 shrink-0 items-center justify-center rounded-md border border-zinc-800 bg-zinc-900 text-zinc-500 sm:flex">
          <LucideIcon className="h-4 w-4" icon={icon} />
        </span>
      ) : null}
    </div>
  );
}

export function ChartCard({ children, hasData, subtitle, title }) {
  return (
    <SectionCard subtitle={subtitle} title={title}>
      {hasData ? (
        <div className="mt-5 h-[280px] sm:h-[320px]">{children}</div>
      ) : (
        <EmptyPanel message="No chart data yet" minHeightClass="min-h-[280px] sm:min-h-[320px]" />
      )}
    </SectionCard>
  );
}

export function EmptyPanel({
  message,
  minHeightClass = 'min-h-[140px]',
}) {
  return (
    <div
      className={`mt-4 flex ${minHeightClass} items-center justify-center rounded-lg border border-dashed border-zinc-800 bg-zinc-900/30 px-4 py-8 text-center`}
    >
      <div>
        <div className="mx-auto flex h-9 w-9 items-center justify-center rounded-md border border-zinc-800 bg-zinc-950 text-zinc-600">
          <LucideIcon className="h-4 w-4" icon={ActivityIcon} />
        </div>
        <p className="mt-3 text-sm text-zinc-500">{message}</p>
      </div>
    </div>
  );
}

export function LoadingDashboard() {
  return (
    <div className="space-y-6">
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {Array.from({ length: 4 }, (_, index) => (
          <div
            className="h-[112px] animate-pulse rounded-lg border border-zinc-800 bg-zinc-950"
            key={index}
          />
        ))}
      </div>
      <div className="grid gap-5 lg:grid-cols-[1.5fr_1fr]">
        <div className="h-[372px] animate-pulse rounded-lg border border-zinc-800 bg-zinc-950" />
        <div className="h-[372px] animate-pulse rounded-lg border border-zinc-800 bg-zinc-950" />
      </div>
      <div className="h-[220px] animate-pulse rounded-lg border border-zinc-800 bg-zinc-950" />
    </div>
  );
}
