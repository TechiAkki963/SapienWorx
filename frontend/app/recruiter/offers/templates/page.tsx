import Link from "next/link";
import {requireRole} from "@/lib/auth-server";
import {recruiterAPI} from "@/lib/recruiter-server";
import {offerDate} from "@/lib/offers";
import type {OfferSettings,OfferTemplate} from "@/lib/offers";
import {RecruiterShell} from "@/components/recruiter/recruiter-shell";
import {RecruiterProductHeader} from "@/components/recruiter/recruiter-product-header";
import {OfferTemplateActions} from "@/components/recruiter/offer-template-actions";
import {OfferStudioTabs} from "@/components/recruiter/offers-workspace";
import {WorkspaceState,recruiterPrimary,recruiterSecondary} from "@/components/recruiter/workspace-ui";
export const dynamic="force-dynamic";
export default async function Templates(){
 await requireRole("recruiter");const settings=await recruiterAPI<OfferSettings>("/api/v1/company/offer-governance");
 const canRead=settings.permissions["offer.view_compensation"];
 const data=canRead?await recruiterAPI<{items:OfferTemplate[]}>("/api/v1/recruiter/offer-templates"):{items:[]};
 const canManage=settings.permissions["offer.manage_templates"]&&canRead&&settings.entitlements.features["offers.templates"];
 const grouped=new Map<string,OfferTemplate[]>();for(const t of data.items)grouped.set(t.id,[...(grouped.get(t.id)??[]),t]);
 return <RecruiterShell><div className="grid min-w-0 gap-5 pb-24"><RecruiterProductHeader eyebrow="Offer Studio" title="Company offer templates" description="Versioned company terms, typed compensation fields and locked clauses."/><OfferStudioTabs active="Templates"/>{canManage&&<Link className={`${recruiterPrimary} justify-self-end`} href="/recruiter/offers/templates/new">Create template</Link>}{grouped.size?<section className="grid gap-4 md:grid-cols-2">{Array.from(grouped).map(([id,versions])=>{const latest=versions[0];return <article key={id} className="swx-workspace-surface grid gap-3 rounded-xl border border-line p-5"><h2 className="text-lg font-semibold text-navy">{latest.name}</h2>{latest.owner_name&&<p className="text-sm text-ink-muted">Owner: {latest.owner_name}</p>}{latest.updated_at&&<p className="text-xs text-ink-muted">Updated {offerDate(latest.updated_at)}</p>}<p className="text-xs leading-5 text-ink-muted">Company approval rules apply when an offer is submitted for review.</p>{versions.map(t=><p key={t.version_id} className="text-sm text-ink-muted">Version {t.version} · {t.status==="in_review"?"In review":t.status} · {t.definition.currency} · {t.definition.fields.length} fields</p>)}{canManage&&<OfferTemplateActions template={latest}/>}</article>})}</section>:<WorkspaceState title={canRead?"No company templates yet":"Template terms require compensation permission"} description="You can prepare a basic offer when your company role allows it. Existing offer versions keep their original terms."/>}</div></RecruiterShell>
}
