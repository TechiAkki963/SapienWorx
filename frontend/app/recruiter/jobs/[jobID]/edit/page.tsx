import Link from "next/link";

import { JobBuilder } from "@/components/recruiter/job-builder";
import { RecruiterShell } from "@/components/recruiter/recruiter-shell";
import { requireRole } from "@/lib/auth-server";
import { EditableRecruiterJob, RecruiterDashboard } from "@/lib/recruiter";
import { recruiterAPI } from "@/lib/recruiter-server";

export const dynamic = "force-dynamic";

export default async function RecruiterEditJobPage({ params }: { params: Promise<{ jobID: string }> }) {
  await requireRole("recruiter");
  const { jobID } = await params;
  const [job, dashboard] = await Promise.all([
    recruiterAPI<EditableRecruiterJob>(`/api/v1/recruiter/jobs/${jobID}`),
    recruiterAPI<RecruiterDashboard>("/api/v1/recruiter/dashboard"),
  ]);

  return (
    <RecruiterShell>
      <div className="grid gap-5">
        <section className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="text-[10px] font-extrabold uppercase tracking-[0.14em] text-indigo">Vacancy builder</p>
            <h1 className="mt-1.5 text-3xl font-bold tracking-[-0.045em] text-navy sm:text-4xl">Edit job</h1>
            <p className="mt-1 text-xs font-bold text-indigo">Job ID: {job.job_reference}</p>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-ink-muted">Update {job.title} and review its candidate-facing story before saving.</p>
          </div>
          <div className="flex flex-wrap gap-2"><Link href={`/recruiter/jobs/${job.id}/applicants`} className="rounded-xl bg-indigo px-4 py-2.5 text-sm font-bold text-white shadow-sm transition hover:bg-navy">View applicants</Link><Link href="/recruiter/jobs" className="rounded-xl border border-line bg-white px-4 py-2.5 text-sm font-bold text-ink shadow-sm transition hover:bg-slate-50">← Back to jobs</Link></div>
        </section>
        <JobBuilder companyName={dashboard.company_name} job={job} />
      </div>
    </RecruiterShell>
  );
}
