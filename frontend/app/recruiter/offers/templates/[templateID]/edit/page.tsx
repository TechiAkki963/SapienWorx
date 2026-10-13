import {notFound} from "next/navigation";
import {requireRole} from "@/lib/auth-server";
import {recruiterAPI} from "@/lib/recruiter-server";
import type {OfferSettings,OfferTemplate} from "@/lib/offers";
import {RecruiterShell} from "@/components/recruiter/recruiter-shell";
import {RecruiterProductHeader} from "@/components/recruiter/recruiter-product-header";
import {OfferTemplateEditor} from "@/components/recruiter/offer-template-editor";
export const dynamic="force-dynamic";
export default async function EditTemplate({params}:{params:Promise<{templateID:string}>}){await requireRole("recruiter");const {templateID}=await params;const settings=await recruiterAPI<OfferSettings>("/api/v1/company/offer-governance");if(!settings.permissions["offer.manage_templates"]||!settings.permissions["offer.view_compensation"]||!settings.entitlements.features["offers.templates"])notFound();const data=await recruiterAPI<{items:OfferTemplate[]}>("/api/v1/recruiter/offer-templates");const template=data.items.filter(t=>t.id===templateID).sort((a,b)=>b.version-a.version)[0];if(!template)notFound();return <RecruiterShell><div className="grid gap-5 pb-24"><RecruiterProductHeader eyebrow="Offer Studio" title="Edit company template" description={`Create a new version after version ${template.version}. Existing offers remain unchanged.`}/><OfferTemplateEditor initial={template} settings={settings}/></div></RecruiterShell>}
