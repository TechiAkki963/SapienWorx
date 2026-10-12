import {ReferralInvitationsWorkspace,type ReferralInvitation} from "@/components/recruiter/referral-invitations-workspace";
import type {LegacyReferralItem as ReferralItem} from "@/lib/recruiter";
import {CandidateCard} from "@/components/recruiter/candidate-card";
import { RecruiterProductHeader } from "@/components/recruiter/recruiter-product-header";
import { RecruiterShell } from "@/components/recruiter/recruiter-shell";
import { requireRole } from "@/lib/auth-server";
import { recruiterAPI } from "@/lib/recruiter-server";

export const dynamic="force-dynamic";
export default async function ReferralsPage(){
  await requireRole("recruiter");
  const [{items},invitations]=await Promise.all([
    recruiterAPI<{items:ReferralItem[]}>("/api/v1/recruiter/referrals"),
    recruiterAPI<{items:ReferralInvitation[]}>("/api/v1/recruiter/referral-invitations"),
  ]);
  return <RecruiterShell><div className="grid gap-5 pb-24">
    <RecruiterProductHeader eyebrow="Hiring sources" title="Referrals" description="Track recommendations and consented applicants in your normal hiring pipeline." />
    <ReferralInvitationsWorkspace initialItems={invitations.items}/>{items.length>0&&<details className="rounded-xl border border-line bg-white p-4"><summary className="min-h-11 cursor-pointer content-center text-sm font-semibold text-ink">Legacy referral records ({items.length})</summary><p className="mb-4 text-xs text-ink-muted">Historical records are retained. New referrals start from candidate Job Details and join the pipeline only after consent.</p><div className="grid gap-3">{items.map(x=><CandidateCard key={x.id} candidate={{id:x.id,name:x.candidate_name}} context={<div><p className="text-sm text-ink-muted">{x.job_title||"General referral"} · {x.referrer_name}</p><p className="mt-2 text-xs text-ink-muted">Historical progress: {x.status} · Recorded reward: {x.reward_status}</p></div>}/>)}</div></details>}
  </div></RecruiterShell>;
}
