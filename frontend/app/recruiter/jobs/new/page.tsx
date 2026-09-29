import Link from "next/link";

import { JobBuilder } from "@/components/recruiter/job-builder";
import { RecruiterShell } from "@/components/recruiter/recruiter-shell";
import { requireRole } from "@/lib/auth-server";
import { RecruiterDashboard, RecruiterTeamMember } from "@/lib/recruiter";
import { recruiterAPI } from "@/lib/recruiter-server";

export const dynamic = "force-dynamic";

export default async function RecruiterNewJobPage() {
  await requireRole("recruiter");
  const [dashboard, team] = await Promise.all([
    recruiterAPI<RecruiterDashboard>("/api/v1/recruiter/dashboard"),
    recruiterAPI<{ items: RecruiterTeamMember[] }>("/api/v1/recruiter/team"),
  ]);

  return (
    <RecruiterShell>
      <div className="grid min-w-0 gap-5">
        <section className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="text-[10px] font-extrabold uppercase tracking-[0.14em] text-indigo">Vacancy builder</p>
            <h1 className="mt-1.5 text-3xl font-bold tracking-[-0.045em] text-navy sm:text-4xl">Post a job</h1>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-ink-muted">Build the role, set transparent candidate expectations, configure recruitment controls, then save as a draft or publish when it is ready.</p>
          </div>
          <Link href="/recruiter/jobs" className="rounded-xl border border-line bg-white px-4 py-2.5 text-sm font-bold text-ink shadow-sm transition hover:bg-slate-50">← Back to jobs</Link>
        </section>

        <JobBuilder companyName={dashboard.company_name} team={team.items} />
      </div>
    </RecruiterShell>
  );
}
