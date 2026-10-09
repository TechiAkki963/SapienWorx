import { RecruiterProductHeader } from "@/components/recruiter/recruiter-product-header";
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
        <RecruiterProductHeader eyebrow={"Vacancy builder"} title="Post a job" description={"Build the role, set transparent candidate expectations, configure recruitment controls, then save as a draft or publish when it is ready."} actions={<><Link href="/recruiter/jobs" className="rounded-xl border border-line bg-white px-4 py-2.5 text-sm font-bold text-ink shadow-sm transition hover:bg-slate-50">← Back to jobs</Link></>} />

        <JobBuilder companyName={dashboard.company_name} team={team.items} />
      </div>
    </RecruiterShell>
  );
}
