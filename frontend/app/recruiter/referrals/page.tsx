import { ReferralsWorkspace, type ReferralCandidate, type ReferralItem, type ReferralJob } from "@/components/recruiter/referrals-workspace";
import { RecruiterProductHeader } from "@/components/recruiter/recruiter-product-header";
import { RecruiterShell } from "@/components/recruiter/recruiter-shell";
import { requireRole } from "@/lib/auth-server";
import { recruiterAPI } from "@/lib/recruiter-server";

export const dynamic="force-dynamic";
export default async function ReferralsPage(){
  await requireRole("recruiter");
  const [{items},pool,jobs]=await Promise.all([
    recruiterAPI<{items:ReferralItem[]}>("/api/v1/recruiter/referrals"),
    recruiterAPI<{items:Array<{candidate_id:string;full_name:string}>}>("/api/v1/recruiter/talent-pool"),
    recruiterAPI<{items:ReferralJob[]}>("/api/v1/recruiter/jobs?limit=50&sort=updated"),
  ]);
  const candidates:ReferralCandidate[]=pool.items??[];
  return <RecruiterShell><div className="grid gap-5 pb-24">
    <RecruiterProductHeader eyebrow="Referral engine" title="Referrals" description="Track referred talent, hiring progress and reward status with company-scoped records." />
    <ReferralsWorkspace initialItems={items??[]} candidates={candidates} jobs={jobs.items??[]}/>
  </div></RecruiterShell>;
}
