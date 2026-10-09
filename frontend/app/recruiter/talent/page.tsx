import {talentAccess,TalentAccessNotice} from "@/components/company/talent-access";
import Link from "next/link";
import { RecruiterShell } from "@/components/recruiter/recruiter-shell";
import { RecruiterProductHeader } from "@/components/recruiter/recruiter-product-header";
import { recruiterInput, recruiterPrimary } from "@/components/recruiter/workspace-ui";
import { requireRole } from "@/lib/auth-server";

export const dynamic = "force-dynamic";
export default async function TalentWorkspacePage() {
  await requireRole("recruiter");
  const access=await talentAccess();if(!access.allowed)return <RecruiterShell><TalentAccessNotice owner={access.owner}/></RecruiterShell>;
  return <RecruiterShell><div className="grid gap-6 pb-24"><RecruiterProductHeader eyebrow="SapienWorx Talent" title="Find the right talent" description="Discover and nurture prospective candidates while your active applicants stay in Recruit." />
    <form action="/recruiter/discover" className="grid max-w-4xl gap-4 rounded-xl border border-line bg-white p-5 sm:p-6"><label className="grid gap-2 text-sm font-semibold text-ink">Professional keywords<input name="q" className={recruiterInput} placeholder="e.g. Java, microservices, AWS" maxLength={300} /></label><p className="text-xs leading-6 text-ink-muted">Search the candidate’s shared professional profile. Use structured filters for experience, location and availability.</p><div className="flex flex-wrap items-center gap-4"><button className={recruiterPrimary}>Search Talent</button><Link href="/recruiter/discover" className="min-h-11 content-center text-sm font-semibold text-indigo">Open advanced search</Link></div></form>
    <section aria-labelledby="talent-workflow-title"><h2 id="talent-workflow-title" className="text-lg font-semibold text-navy">Your talent workflow</h2><ul className="mt-3 divide-y divide-line rounded-xl border border-line bg-white">{[["Pools / projects","Organize saved, authorized candidates with private pool tags.","/recruiter/talent-pool"],["Saved searches","Reuse precise criteria and configure daily or weekly alerts.","/recruiter/saved-searches"],["Outreach","Create reviewed campaigns and follow-up sequences through protected delivery.","/recruiter/outreach"],["Insights","Review recorded campaign delivery and search activity.","/recruiter/talent/insights"]].map(([name,description,href])=><li key={name}><Link href={href} className="flex min-h-20 items-center justify-between gap-4 px-5 py-4"><div><p className="text-sm font-semibold text-navy">{name}</p><p className="mt-1 text-xs leading-6 text-ink-muted">{description}</p></div><span aria-hidden="true" className="text-indigo">→</span></Link></li>)}</ul></section>
  </div></RecruiterShell>;
}
