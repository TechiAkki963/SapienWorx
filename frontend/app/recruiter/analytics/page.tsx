import { RecruiterProductHeader } from "@/components/recruiter/recruiter-product-header";
import { RecruiterShell } from "@/components/recruiter/recruiter-shell";
import { AnalyticsWorkspace, type RecruiterAnalyticsData } from "@/components/recruiter/analytics-workspace";
import { requireRole } from "@/lib/auth-server";
import { recruiterAPI } from "@/lib/recruiter-server";

export const dynamic = "force-dynamic";
export default async function RecruiterAnalyticsPage() {
  await requireRole("recruiter");
  const data = await recruiterAPI<RecruiterAnalyticsData>("/api/v1/recruiter/analytics");
  return <RecruiterShell><div className="grid gap-5 pb-24"><RecruiterProductHeader eyebrow="Recruiting insights" title="Analytics" description="Review your company’s hiring funnel, application cohorts and sources, then open the underlying workspace." /><AnalyticsWorkspace data={data} /></div></RecruiterShell>;
}
