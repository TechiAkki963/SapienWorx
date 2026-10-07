import {ReferralInvitationsWorkspace,type ReferralInvitation} from "@/components/recruiter/referral-invitations-workspace";
import { type ReferralItem } from "@/components/recruiter/referrals-workspace";
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
    <ReferralInvitationsWorkspace initialItems={invitations.items}/>{items.length>0&&<details className="rounded-xl border border-line bg-white p-4"><summary className="min-h-11 cursor-pointer content-center text-sm font-semibold text-ink">Legacy referral records ({items.length})</summary><p className="mb-4 text-xs text-ink-muted">Historical records are retained. New referrals start from candidate Job Details and join the pipeline only after consent.</p><div className="grid gap-3">{items.map(x=><div key={x.id} className="rounded-lg border border-line p-3"><p className="font-semibold text-navy">{x.candidate_name}</p><p className="mt-1 text-sm text-ink-muted">{x.job_title||"General referral"} · {x.referrer_name}</p><p className="mt-1 text-xs text-ink-muted">Historical progress: {x.status} · Recorded reward: {x.reward_status}</p></div>)}</div></details>}
  </div></RecruiterShell>;
}
