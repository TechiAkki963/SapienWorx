import { RecruiterShell } from "@/components/recruiter/recruiter-shell";
import { RecruiterHomeWorkspace } from "@/components/recruiter/home-workspace";
import { requireRole } from "@/lib/auth-server";
import type { RecruiterDashboard, RecruiterJobWorkspace } from "@/lib/recruiter";
import { recruiterAPI } from "@/lib/recruiter-server";
export const dynamic = "force-dynamic";
export default async function RecruiterDashboardPage() {
  const session = await requireRole("recruiter");
  const [data, jobs] = await Promise.all([
    recruiterAPI<RecruiterDashboard>("/api/v1/recruiter/dashboard"),
    recruiterAPI<RecruiterJobWorkspace>("/api/v1/recruiter/jobs?status=active&page=1&limit=8&sort=updated").catch(() => null),
  ]);
  return <RecruiterShell><RecruiterHomeWorkspace data={data} jobs={jobs?.items || []} jobsError={!jobs} firstName={session.first_name || data.recruiter_name.split(" ")[0]} /></RecruiterShell>;
}
