import { ReferralsWorkspace, type ReferralCandidate, type ReferralItem, type ReferralJob } from "@/components/recruiter/referrals-workspace";
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
    <header><p className="text-[10px] font-extrabold uppercase tracking-[.14em] text-indigo">Referral engine</p><h1 className="mt-1 text-2xl font-bold tracking-[-.035em] text-navy sm:text-3xl">Referrals</h1><p className="mt-1 max-w-3xl text-sm leading-6 text-ink-muted">Track referred talent, hiring progress and reward status with company-scoped records.</p></header>
    <ReferralsWorkspace initialItems={items??[]} candidates={candidates} jobs={jobs.items??[]}/>
  </div></RecruiterShell>;
}
