import Link from "next/link";
import { notFound } from "next/navigation";

import { DuplicateJobButton } from "@/components/recruiter/duplicate-job-button";
import { JobBuilder } from "@/components/recruiter/job-builder";
import { RecruiterShell } from "@/components/recruiter/recruiter-shell";
import { requireRole } from "@/lib/auth-server";
import { EditableRecruiterJob, JobAuditEvent, label, RecruiterDashboard, RecruiterTeamMember } from "@/lib/recruiter";
import { recruiterAPI, RecruiterBackendError } from "@/lib/recruiter-server";

export const dynamic = "force-dynamic";

function auditDate(value: string) {
  return new Intl.DateTimeFormat("en-IN", { dateStyle: "medium", timeStyle: "short" }).format(new Date(value));
}

export default async function RecruiterEditJobPage({ params }: { params: Promise<{ jobID: string }> }) {
  await requireRole("recruiter");
  const { jobID } = await params;
  const [job, dashboard, team, history] = await Promise.all([
    recruiterAPI<EditableRecruiterJob>(`/api/v1/recruiter/jobs/${jobID}`).catch(error => {
      if (error instanceof RecruiterBackendError && (error.status === 403 || error.status === 404)) notFound();
      throw error;
    }),
    recruiterAPI<RecruiterDashboard>("/api/v1/recruiter/dashboard"),
    recruiterAPI<{ items: RecruiterTeamMember[] }>("/api/v1/recruiter/team"),
    recruiterAPI<{ items: JobAuditEvent[] }>(`/api/v1/recruiter/jobs/${jobID}/history?limit=20`).catch(() => ({ items: [] })),
  ]);

  return (
    <RecruiterShell>
      <div className="grid min-w-0 gap-5">
        <section className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="text-[10px] font-extrabold uppercase tracking-[0.14em] text-indigo">Vacancy builder</p>
            <h1 className="mt-1.5 text-3xl font-bold tracking-[-0.045em] text-navy sm:text-4xl">Edit job</h1>
            <div className="mt-2 flex flex-wrap items-center gap-2 text-xs font-bold">
              <span className="text-indigo">Job ID: {job.job_reference}</span>
              <span className="rounded-full border border-line bg-white px-2 py-1 text-ink-muted">{label(job.status)}</span>
              <span className={`rounded-full px-2 py-1 ${job.visibility === "public" ? "bg-blue-50 text-blue-700" : "bg-slate-100 text-slate-700"}`}>{label(job.visibility)}</span>
            </div>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-ink-muted">Update {job.title}, recruitment controls and candidate-facing information. Every save or lifecycle change is recorded in the job audit history.</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Link href={`/recruiter/jobs/${job.id}/applicants`} className="rounded-xl bg-indigo px-4 py-2.5 text-sm font-bold text-white shadow-sm transition hover:bg-navy">View applicants</Link>
            <Link href={`/recruiter/jobs/${job.id}/analytics`} className="rounded-xl border border-indigo/20 bg-indigo-soft/40 px-4 py-2.5 text-sm font-bold text-indigo transition hover:bg-indigo-soft">View analytics</Link>
            <DuplicateJobButton jobId={job.id} />
            <Link href="/recruiter/jobs" className="rounded-xl border border-line bg-white px-4 py-2.5 text-sm font-bold text-ink shadow-sm transition hover:bg-slate-50">← Back to jobs</Link>
          </div>
        </section>

        <JobBuilder companyName={dashboard.company_name} job={job} team={team.items} />

        <section aria-labelledby="job-history-title" className="rounded-2xl border border-line/70 bg-white p-5 shadow-[0_4px_20px_rgba(16,33,63,0.035)] sm:p-6">
          <div className="flex flex-wrap items-end justify-between gap-3">
            <div>
              <p className="text-[10px] font-extrabold uppercase tracking-[0.13em] text-indigo">Audit trail</p>
              <h2 id="job-history-title" className="mt-1 text-xl font-bold text-navy">Job change history</h2>
            </div>
            <p className="text-xs font-semibold text-ink-muted">Latest 20 events</p>
          </div>
          {history.items.length ? (
            <ol className="mt-5 grid gap-3">
              {history.items.map((event) => (
                <li key={event.id} className="flex items-start gap-3 rounded-xl border border-line/70 bg-slate-50/45 p-3.5">
                  <span className="mt-1 h-2 w-2 shrink-0 rounded-full bg-indigo" aria-hidden="true" />
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-bold text-ink">{label(event.action)}</p>
                    <p className="mt-1 text-xs leading-5 text-ink-muted">By {event.actor_name} · {auditDate(event.changed_at)}</p>
                  </div>
                </li>
              ))}
            </ol>
          ) : (
            <p className="mt-4 rounded-xl border border-dashed border-line bg-slate-50/40 px-4 py-5 text-sm text-ink-muted">No job changes have been recorded yet.</p>
          )}
        </section>
      </div>
    </RecruiterShell>
  );
}
