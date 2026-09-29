import Link from "next/link";

import { RecruiterShell } from "@/components/recruiter/recruiter-shell";
import { requireRole } from "@/lib/auth-server";
import { JobAnalytics, compactDate, label } from "@/lib/recruiter";
import { recruiterAPI } from "@/lib/recruiter-server";

export const dynamic = "force-dynamic";

function hoursLabel(value?: number) {
  if (value == null) return "—";
  if (value < 24) return `${value.toFixed(value < 10 ? 1 : 0)}h`;
  const days = value / 24;
  return `${days.toFixed(days < 10 ? 1 : 0)}d`;
}

function percent(value: number) {
  return `${value.toLocaleString("en-IN", { maximumFractionDigits: 1 })}%`;
}

function metric(labelText: string, value: string, detail: string) {
  return <div className="rounded-2xl border border-line/70 bg-white p-4 shadow-[0_4px_20px_rgba(16,33,63,0.03)]">
    <p className="text-[10px] font-extrabold uppercase tracking-[0.1em] text-ink-muted">{labelText}</p>
    <p className="mt-2 text-2xl font-black tracking-[-0.04em] text-navy">{value}</p>
    <p className="mt-1 text-xs leading-5 text-ink-muted">{detail}</p>
  </div>;
}

export default async function RecruiterJobAnalyticsPage({ params }: { params: Promise<{ jobID: string }> }) {
  await requireRole("recruiter");
  const { jobID } = await params;
  const analytics = await recruiterAPI<JobAnalytics>(`/api/v1/recruiter/jobs/${jobID}/analytics`);
  const maxTrend = Math.max(1, ...analytics.trend.map((point) => point.applications));

  return <RecruiterShell>
    <div className="grid min-w-0 gap-5">
      <section className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <Link href="/recruiter/jobs" className="text-xs font-bold text-indigo hover:underline">← Job management</Link>
          <p className="mt-3 text-[10px] font-extrabold uppercase tracking-[0.14em] text-indigo">Vacancy performance</p>
          <h1 className="mt-1 text-3xl font-bold tracking-[-0.045em] text-navy sm:text-4xl">Job analytics</h1>
          <p className="mt-1 text-sm font-bold text-indigo">{analytics.job_reference}</p>
          <p className="mt-1 max-w-3xl text-sm leading-6 text-ink-muted">{analytics.title} · {label(analytics.status)} · published {compactDate(analytics.published_at)}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link href={`/recruiter/jobs/${jobID}/applicants`} className="rounded-xl bg-indigo px-4 py-2.5 text-sm font-bold text-white shadow-sm hover:bg-navy">View applicants</Link>
          <Link href={`/recruiter/jobs/${jobID}/edit`} className="rounded-xl border border-line bg-white px-4 py-2.5 text-sm font-bold text-ink shadow-sm hover:text-indigo">Edit job</Link>
        </div>
      </section>

      {(analytics.closing_soon || analytics.overdue) && <section className={`rounded-xl border px-4 py-3 text-sm font-semibold ${analytics.overdue ? "border-rose-200 bg-rose-50 text-rose-900" : "border-amber-200 bg-amber-50 text-amber-950"}`}>
        {analytics.overdue ? "This active job is past its application deadline." : `This job closes in ${analytics.days_to_deadline} day${analytics.days_to_deadline === 1 ? "" : "s"}.`}
      </section>}

      <section aria-label="Job performance summary" className="grid grid-cols-2 gap-3 xl:grid-cols-6">
        {metric("Applications", analytics.total_applications.toLocaleString("en-IN"), "Recorded applications")}
        {metric("Hires", analytics.hires.toLocaleString("en-IN"), `${analytics.remaining_openings} openings remaining`)}
        {metric("Fill rate", percent(analytics.fill_rate_percent), `${analytics.hires} of ${analytics.openings} openings filled`)}
        {metric("Days open", String(analytics.days_open), "Since first publication")}
        {metric("First application", hoursLabel(analytics.time_to_first_application_hours), "From first publication")}
        {metric("First hire", hoursLabel(analytics.time_to_first_hire_hours), "From first publication")}
      </section>

      <div className="grid min-w-0 gap-5 xl:grid-cols-[minmax(0,1.25fr)_minmax(20rem,.75fr)]">
        <section aria-label="Hiring funnel" className="min-w-0 rounded-2xl border border-line/70 bg-white p-5 shadow-[0_4px_20px_rgba(16,33,63,0.035)] sm:p-6">
          <div>
            <p className="text-[10px] font-extrabold uppercase tracking-[0.13em] text-indigo">Conversion</p>
            <h2 className="mt-1 text-xl font-bold text-navy">Hiring funnel</h2>
            <p className="mt-1 text-xs leading-5 text-ink-muted">Cumulative counts use the highest stage each application has reached.</p>
          </div>
          <div className="mt-5 grid gap-3">
            {analytics.funnel.map((point) => <div key={point.stage} className="grid gap-1.5">
              <div className="flex items-center justify-between gap-3 text-xs">
                <span className="font-bold text-ink">{point.stage}</span>
                <span className="font-semibold text-ink-muted">{point.count.toLocaleString("en-IN")} · {percent(point.conversion_percent)}</span>
              </div>
              <div className="h-2.5 overflow-hidden rounded-full bg-slate-100">
                <div className="h-full rounded-full bg-indigo" style={{ width: `${Math.max(point.count ? 2 : 0, Math.min(100, point.conversion_percent))}%` }} />
              </div>
            </div>)}
          </div>
        </section>

        <section aria-label="Hiring speed" className="rounded-2xl border border-line/70 bg-white p-5 shadow-[0_4px_20px_rgba(16,33,63,0.035)] sm:p-6">
          <p className="text-[10px] font-extrabold uppercase tracking-[0.13em] text-indigo">Velocity</p>
          <h2 className="mt-1 text-xl font-bold text-navy">First milestone timing</h2>
          <div className="mt-5 grid gap-4">
            {[
              ["Application", analytics.time_to_first_application_hours],
              ["Shortlist", analytics.time_to_first_shortlist_hours],
              ["Offer", analytics.time_to_first_offer_hours],
              ["Hire", analytics.time_to_first_hire_hours],
            ].map(([name, value]) => <div key={name as string} className="flex items-center justify-between gap-3 border-b border-line/60 pb-3 last:border-0 last:pb-0">
              <span className="text-sm font-semibold text-ink">{name}</span>
              <span className="text-lg font-black text-navy">{hoursLabel(value as number | undefined)}</span>
            </div>)}
          </div>
          <p className="mt-5 text-xs leading-5 text-ink-muted">These are elapsed times from the job's first publication to the first recorded milestone.</p>
        </section>
      </div>

      <section aria-label="Application trend" className="min-w-0 rounded-2xl border border-line/70 bg-white p-5 shadow-[0_4px_20px_rgba(16,33,63,0.035)] sm:p-6">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div><p className="text-[10px] font-extrabold uppercase tracking-[0.13em] text-indigo">Demand</p><h2 className="mt-1 text-xl font-bold text-navy">Applications · last 30 days</h2></div>
          <p className="text-xs font-semibold text-ink-muted">Daily submitted applications</p>
        </div>
        <div className="mt-5 flex h-36 min-w-0 items-end gap-1" aria-label="30 day application volume">
          {analytics.trend.map((point) => <div key={point.date} className="group flex h-full min-w-0 flex-1 flex-col items-center justify-end gap-1" title={`${point.date}: ${point.applications} applications`}>
            <div data-testid="trend-bar" className="w-full min-w-[2px] rounded-t-sm bg-indigo/70 transition group-hover:bg-indigo" style={{ height: `${Math.max(2, point.applications / maxTrend * 100)}%` }} />
          </div>)}
        </div>
        <div className="mt-2 flex justify-between text-[10px] font-semibold text-ink-muted"><span>{compactDate(analytics.trend[0]?.date)}</span><span>{compactDate(analytics.trend.at(-1)?.date)}</span></div>
      </section>

      <section aria-label="Source performance" className="min-w-0 rounded-2xl border border-line/70 bg-white p-5 shadow-[0_4px_20px_rgba(16,33,63,0.035)] sm:p-6">
        <div><p className="text-[10px] font-extrabold uppercase tracking-[0.13em] text-indigo">Acquisition</p><h2 className="mt-1 text-xl font-bold text-navy">Source performance</h2><p className="mt-1 text-xs leading-5 text-ink-muted">Conversion uses the source stored on each application and recorded stage progress.</p></div>
        {analytics.sources.length ? <>
          <div className="mt-5 hidden overflow-x-auto md:block">
            <table className="w-full min-w-[680px] border-collapse text-sm">
              <thead className="border-b border-line/70 bg-slate-50/70 text-left text-[10px] font-extrabold uppercase tracking-[0.08em] text-ink-muted"><tr><th className="px-3 py-2.5">Source</th><th className="px-3 py-2.5 text-right">Applications</th><th className="px-3 py-2.5 text-right">Shortlisted</th><th className="px-3 py-2.5 text-right">Interviews</th><th className="px-3 py-2.5 text-right">Offers</th><th className="px-3 py-2.5 text-right">Hires</th><th className="px-3 py-2.5 text-right">Hire conversion</th></tr></thead>
              <tbody className="divide-y divide-line/60">{analytics.sources.map((source) => <tr key={source.source}><td className="px-3 py-3 font-bold text-ink">{label(source.source)}</td><td className="px-3 py-3 text-right">{source.applications}</td><td className="px-3 py-3 text-right">{source.shortlisted}</td><td className="px-3 py-3 text-right">{source.interviews}</td><td className="px-3 py-3 text-right">{source.offers}</td><td className="px-3 py-3 text-right font-bold">{source.hires}</td><td className="px-3 py-3 text-right font-bold text-indigo">{percent(source.hire_conversion_percent)}</td></tr>)}</tbody>
            </table>
          </div>
          <div className="mt-5 grid gap-3 md:hidden">{analytics.sources.map((source) => <article key={source.source} className="rounded-xl border border-line bg-slate-50/45 p-3.5"><div className="flex items-center justify-between gap-3"><h3 className="font-bold text-ink">{label(source.source)}</h3><span className="text-sm font-black text-indigo">{percent(source.hire_conversion_percent)}</span></div><div className="mt-3 grid grid-cols-3 gap-2 text-xs"><div><p className="text-ink-muted">Apps</p><p className="mt-1 font-bold text-navy">{source.applications}</p></div><div><p className="text-ink-muted">Offers</p><p className="mt-1 font-bold text-navy">{source.offers}</p></div><div><p className="text-ink-muted">Hires</p><p className="mt-1 font-bold text-navy">{source.hires}</p></div></div></article>)}</div>
        </> : <p className="mt-4 text-sm text-ink-muted">No application source data is available yet.</p>}
      </section>
    </div>
  </RecruiterShell>;
}
