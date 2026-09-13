import Link from "next/link";

import { JobStatusControl } from "@/components/recruiter/job-status-control";
import { RecruiterShell } from "@/components/recruiter/recruiter-shell";
import { requireRole } from "@/lib/auth-server";
import { RecruiterJob, compactDate, label } from "@/lib/recruiter";
import { recruiterAPI } from "@/lib/recruiter-server";

export const dynamic = "force-dynamic";

export default async function RecruiterJobsPage() {
  await requireRole("recruiter");
  const { items } = await recruiterAPI<{ items: RecruiterJob[] }>("/api/v1/recruiter/jobs");

  return (
    <RecruiterShell>
      <div className="grid gap-5">
        <section className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="text-[10px] font-extrabold uppercase tracking-[0.14em] text-indigo">Vacancy control</p>
            <h1 className="mt-1.5 text-2xl font-bold tracking-[-0.04em] text-navy sm:text-[2rem]">Jobs</h1>
            <p className="mt-1 text-sm text-ink-muted">Openings, applicant volume, deadlines and publishing state in one operational list.</p>
          </div>
          <Link href="/recruiter/jobs/new" className="rounded-xl bg-indigo px-4 py-2.5 text-sm font-bold text-white shadow-sm transition hover:bg-violet-ink">+ Post a job</Link>
        </section>

        {items.length ? (
          <div className="overflow-x-auto rounded-2xl border border-line/70 bg-white shadow-[0_1px_2px_rgba(16,33,63,0.03)]">
            <table className="min-w-[980px] w-full text-left text-sm">
              <thead className="border-b border-line/70 bg-slate-50/80 text-[10px] font-extrabold uppercase tracking-[0.1em] text-ink-muted">
                <tr><th className="px-4 py-3">Job</th><th className="px-3 py-3">Mode</th><th className="px-3 py-3">Openings</th><th className="px-3 py-3">Applications</th><th className="px-3 py-3">Deadline</th><th className="px-3 py-3">Updated</th><th className="px-3 py-3">Status</th></tr>
              </thead>
              <tbody>
                {items.map((job) => (
                  <tr key={job.id} className="border-t border-line/50 transition hover:bg-slate-50/65">
                    <td className="px-4 py-3.5"><p className="font-bold text-ink">{job.title}</p><p className="mt-0.5 text-xs text-ink-muted">{job.department ?? "No department"} · {[job.city, job.state].filter(Boolean).join(", ") || job.country_code}</p></td>
                    <td className="px-3 py-3.5 text-ink-muted">{label(job.work_mode)} · {label(job.employment_type)}</td>
                    <td className="px-3 py-3.5 font-semibold text-ink">{job.openings}</td>
                    <td className="px-3 py-3.5"><span className="inline-flex min-w-8 justify-center rounded-lg bg-blue-50 px-2 py-1 text-xs font-extrabold text-blue-700">{job.applications}</span></td>
                    <td className="px-3 py-3.5 text-ink-muted">{compactDate(job.application_deadline)}</td>
                    <td className="px-3 py-3.5 text-ink-muted">{compactDate(job.updated_at)}</td>
                    <td className="px-3 py-3.5"><JobStatusControl jobId={job.id} status={job.status} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="rounded-2xl border border-dashed border-line bg-white p-12 text-center">
            <div className="mx-auto flex h-11 w-11 items-center justify-center rounded-full bg-slate-100 text-slate-500"><svg aria-hidden="true" viewBox="0 0 24 24" className="h-5 w-5 fill-none stroke-current stroke-[1.8]"><rect x="3.5" y="7" width="17" height="12" rx="2" /><path d="M9 7V5.5A1.5 1.5 0 0 1 10.5 4h3A1.5 1.5 0 0 1 15 5.5V7" /></svg></div>
            <h2 className="mt-3 font-bold text-ink">No jobs yet</h2><p className="mt-1 text-sm text-ink-muted">Create your first vacancy and publish it when the details are ready.</p><Link href="/recruiter/jobs/new" className="mt-4 inline-flex rounded-xl bg-indigo px-4 py-2.5 text-sm font-bold text-white shadow-sm transition hover:bg-violet-ink">Post your first job</Link>
          </div>
        )}
      </div>
    </RecruiterShell>
  );
}
