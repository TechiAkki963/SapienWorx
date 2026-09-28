import Link from "next/link";

import { JobShareMenu } from "@/components/recruiter/job-share-menu";
import { JobStatusControl } from "@/components/recruiter/job-status-control";
import { RecruiterShell } from "@/components/recruiter/recruiter-shell";
import { requireRole } from "@/lib/auth-server";
import { RecruiterJob, compactDate, label } from "@/lib/recruiter";
import { recruiterAPI } from "@/lib/recruiter-server";

export const dynamic = "force-dynamic";

export default async function RecruiterJobsPage({ searchParams }: { searchParams: Promise<{ deadline?: string; status?: string }> }) {
  await requireRole("recruiter");
  const { deadline, status } = await searchParams;
  const { items } = await recruiterAPI<{ items: RecruiterJob[] }>("/api/v1/recruiter/jobs");
  const today = new Intl.DateTimeFormat("sv-SE", { timeZone: "Asia/Kolkata", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date());
  const endDate = new Date(`${today}T00:00:00Z`);
  endDate.setUTCDate(endDate.getUTCDate() + 3);
  const soonThrough = endDate.toISOString().slice(0, 10);
  const visibleItems = deadline === "soon" ? items.filter((job) => job.status === "active" && job.application_deadline && job.application_deadline.slice(0, 10) >= today && job.application_deadline.slice(0, 10) <= soonThrough) : status === "active" ? items.filter((job) => job.status === "active") : items;
  const activeCount = items.filter((job) => job.status === "active").length;
  const draftCount = items.filter((job) => job.status === "draft").length;
  const applicationCount = items.reduce((sum, job) => sum + job.applications, 0);
  const newApplicationCount = items.reduce((sum, job) => sum + job.new_applications, 0);

  return (
    <RecruiterShell>
      <div className="grid gap-5">
        <section className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="text-[10px] font-extrabold uppercase tracking-[0.14em] text-indigo">Vacancy control</p>
            <h1 className="mt-1.5 text-2xl font-bold tracking-[-0.04em] text-navy sm:text-[2rem]">Job management</h1>
            <p className="mt-1 text-sm text-ink-muted">Publish, monitor, share and control every vacancy from one operational view.</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Link href="/recruiter/jobs/new" className="rounded-xl bg-indigo px-4 py-2.5 text-sm font-bold text-white shadow-sm transition hover:bg-violet-ink">+ Post a job</Link>
          </div>
        </section>

        <section className="grid grid-cols-2 gap-3 xl:grid-cols-4" aria-label="Job summary">
          <div className="rounded-2xl border border-line/70 bg-white p-4"><p className="text-[10px] font-extrabold uppercase tracking-[0.1em] text-ink-muted">Active roles</p><p className="mt-2 text-2xl font-black tracking-[-0.04em] text-navy">{activeCount}</p></div>
          <div className="rounded-2xl border border-line/70 bg-white p-4"><p className="text-[10px] font-extrabold uppercase tracking-[0.1em] text-ink-muted">Drafts</p><p className="mt-2 text-2xl font-black tracking-[-0.04em] text-navy">{draftCount}</p></div>
          <div className="rounded-2xl border border-line/70 bg-white p-4"><p className="text-[10px] font-extrabold uppercase tracking-[0.1em] text-ink-muted">Total applications</p><p className="mt-2 text-2xl font-black tracking-[-0.04em] text-navy">{applicationCount}</p></div>
          <div className="rounded-2xl border border-mint/50 bg-mint/20 p-4"><p className="text-[10px] font-extrabold uppercase tracking-[0.1em] text-emerald-800">New applications</p><p className="mt-2 text-2xl font-black tracking-[-0.04em] text-emerald-900">{newApplicationCount}</p></div>
        </section>

        {deadline === "soon" && <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm font-semibold text-amber-950"><span>Showing active jobs closing in the next 3 days.</span><Link href="/recruiter/jobs" className="text-indigo hover:underline">Show all jobs</Link></div>}
        {status === "active" && <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-indigo/20 bg-indigo-soft/40 px-4 py-3 text-sm font-semibold text-navy"><span>Showing active jobs.</span><Link href="/recruiter/jobs" className="text-indigo hover:underline">Show all jobs</Link></div>}
        {visibleItems.length ? (
          <section aria-label="Jobs" className="grid min-w-0 gap-4 xl:grid-cols-2">
            {visibleItems.map((job) => (
              <article key={job.id} className="flex min-w-0 flex-col rounded-2xl border border-line/70 bg-white p-4 shadow-[0_4px_20px_rgba(16,33,63,0.04)] sm:p-5">
                <div className="flex min-w-0 flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <p className="mb-1 text-xs font-extrabold tracking-[0.06em] text-indigo">{job.job_reference}</p>
                    <h2 className="break-words text-lg font-bold tracking-[-0.025em] text-navy">{job.title}</h2>
                    <p className="mt-1 break-words text-xs text-ink-muted">{job.department ?? "No department"} · {[job.city, job.state].filter(Boolean).join(", ") || job.country_code}</p>
                  </div>
                  <JobStatusControl jobId={job.id} status={job.status} />
                </div>

                <div className="mt-3 flex flex-wrap gap-2 text-xs font-semibold text-ink-muted">
                  <span className="rounded-lg bg-slate-50 px-2.5 py-1.5">{label(job.work_mode)} · {label(job.employment_type)}</span>
                  <span className="rounded-lg bg-slate-50 px-2.5 py-1.5">{job.openings} {job.openings === 1 ? "opening" : "openings"}</span>
                </div>

                <div className="mt-3 grid grid-cols-2 gap-3">
                  <Link href={`/recruiter/jobs/${job.id}/applicants`} aria-label={`View all ${job.applications} applications for ${job.title}`} className="min-w-0 rounded-xl border border-indigo-100 bg-indigo-50/60 p-3 transition hover:border-indigo-300 hover:bg-indigo-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo">
                    <p className="text-[10px] font-bold uppercase tracking-[0.08em] text-indigo">Total applications</p>
                    <p className="mt-1 text-2xl font-black leading-none text-navy">{job.applications}</p>
                  </Link>
                  <Link href={`/recruiter/jobs/${job.id}/applicants?stage=new_application`} aria-label={`View ${job.new_applications} new applications for ${job.title}`} className="min-w-0 rounded-xl border border-emerald-100 bg-emerald-50/70 p-3 transition hover:border-emerald-300 hover:bg-emerald-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-600">
                    <p className="text-[10px] font-bold uppercase tracking-[0.08em] text-emerald-800">New applications</p>
                    <p className="mt-1 text-2xl font-black leading-none text-emerald-900">{job.new_applications}</p>
                  </Link>
                </div>

                <div className="mt-3 grid grid-cols-3 gap-2 rounded-xl bg-slate-50/80 p-3 text-xs">
                  <div><p className="text-ink-muted">Shortlisted</p><p className="mt-1 text-lg font-extrabold text-navy">{job.shortlisted}</p></div>
                  <div><p className="text-ink-muted">Upcoming interviews</p><p className="mt-1 text-lg font-extrabold text-navy">{job.interviews}</p></div>
                  <div><p className="text-ink-muted">Openings</p><p className="mt-1 text-lg font-extrabold text-navy">{job.openings}</p></div>
                </div>

                <div className="mt-3 grid grid-cols-2 gap-3 border-t border-line/60 pt-3 text-xs">
                  <p><span className="block text-ink-muted">Deadline</span><span className="mt-0.5 block font-semibold text-ink">{compactDate(job.application_deadline)}</span></p>
                  <p><span className="block text-ink-muted">Updated</span><span className="mt-0.5 block font-semibold text-ink">{compactDate(job.updated_at)}</span></p>
                </div>

                <div className="mt-3 flex flex-wrap items-center gap-2">
                  <Link href={`/recruiter/jobs/${job.id}/applicants`} className="rounded-lg bg-indigo px-3 py-2 text-xs font-bold text-white hover:bg-navy">View applicants →</Link>
                  <Link href={`/recruiter/jobs/${job.id}/edit`} className="rounded-lg border border-line bg-white px-2.5 py-1.5 text-xs font-bold text-ink hover:text-indigo">Edit job</Link>
                  {job.status === "active" ? <Link href={`/jobs/${job.id}`} target="_blank" rel="noopener noreferrer" className="rounded-lg border border-line bg-white px-2.5 py-1.5 text-xs font-bold text-ink hover:text-indigo">Preview public job ↗</Link> : <span className="text-xs font-semibold text-ink-muted/60">Not public</span>}
                  <JobShareMenu jobId={job.id} title={job.title} active={job.status === "active"} />
                </div>
              </article>
            ))}
          </section>
        ) : (
          <div className="rounded-2xl border border-dashed border-line bg-white p-12 text-center">
            <div className="mx-auto flex h-11 w-11 items-center justify-center rounded-full bg-slate-100 text-slate-500"><svg aria-hidden="true" viewBox="0 0 24 24" className="h-5 w-5 fill-none stroke-current stroke-[1.8]"><rect x="3.5" y="7" width="17" height="12" rx="2" /><path d="M9 7V5.5A1.5 1.5 0 0 1 10.5 4h3A1.5 1.5 0 0 1 15 5.5V7" /></svg></div>
            <h2 className="mt-3 font-bold text-ink">{deadline === "soon" ? "No jobs closing soon" : status === "active" ? "No active jobs" : "No jobs yet"}</h2><p className="mt-1 text-sm text-ink-muted">{deadline === "soon" ? "No active vacancies have a deadline in the next 3 days." : status === "active" ? "Publish a draft job or show all jobs." : "Create your first vacancy and publish it when the details are ready."}</p>{deadline !== "soon" && <Link href="/recruiter/jobs/new" className="mt-4 inline-flex rounded-xl bg-indigo px-4 py-2.5 text-sm font-bold text-white shadow-sm transition hover:bg-violet-ink">Post your first job</Link>}
          </div>
        )}
      </div>
    </RecruiterShell>
  );
}
