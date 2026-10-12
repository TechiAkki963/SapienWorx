import {notFound} from "next/navigation";
import {requireRole} from "@/lib/auth-server";
import {recruiterAPI} from "@/lib/recruiter-server";
import type {OfferSettings,OfferTemplate} from "@/lib/offers";
import {RecruiterShell} from "@/components/recruiter/recruiter-shell";
import {RecruiterProductHeader} from "@/components/recruiter/recruiter-product-header";
import {OfferTemplateEditor} from "@/components/recruiter/offer-template-editor";
export const dynamic="force-dynamic";
export default async function NewTemplate({searchParams}:{searchParams:Promise<{clone?:string}>}){await requireRole("recruiter");const settings=await recruiterAPI<OfferSettings>("/api/v1/company/offer-governance");if(!settings.permissions["offer.manage_templates"]||!settings.permissions["offer.view_compensation"]||!settings.entitlements.features["offers.templates"])notFound();const source=(await searchParams).clone;const clone=source?(await recruiterAPI<{items:OfferTemplate[]}>("/api/v1/recruiter/offer-templates")).items.find(t=>t.id===source):undefined;if(source&&!clone)notFound();return <RecruiterShell><div className="grid gap-5 pb-24"><RecruiterProductHeader eyebrow="Offer Studio" title="Create company template" description="Define reusable terms without changing a candidate’s offer."/><OfferTemplateEditor clone={clone} settings={settings}/></div></RecruiterShell>}
