import {notFound} from "next/navigation";
import {OfferComposer} from "@/components/recruiter/offer-composer";
import {RecruiterShell} from "@/components/recruiter/recruiter-shell";
import {RecruiterProductHeader} from "@/components/recruiter/recruiter-product-header";
import {recruiterAPI,RecruiterBackendError} from "@/lib/recruiter-server";
import {requireRole} from "@/lib/auth-server";
import type {GovernedOffer,OfferSettings,OfferTemplate} from "@/lib/offers";
export const dynamic="force-dynamic";
export default async function EditOffer({params,searchParams}:{params:Promise<{offerID:string}>;searchParams:Promise<{job_id?:string}>}){
 await requireRole("recruiter");const {offerID}=await params;const q=await searchParams;let item:GovernedOffer;
 try{item=await recruiterAPI<GovernedOffer>(`/api/v1/recruiter/offers/${encodeURIComponent(offerID)}`)}catch(cause){if(cause instanceof RecruiterBackendError&&[403,404].includes(cause.status))notFound();throw cause}
 if(q.job_id&&q.job_id!==item.job_id)notFound();const settings=await recruiterAPI<OfferSettings>("/api/v1/company/offer-governance");const templates=settings.permissions["offer.view_compensation"]&&settings.entitlements.features["offers.templates"]?await recruiterAPI<{items:OfferTemplate[]}>("/api/v1/recruiter/offer-templates"):{items:[]};
 return <RecruiterShell><div className="grid gap-5 pb-24"><RecruiterProductHeader eyebrow="Offer Studio" title={`Prepare version ${item.active_version+1}`} description="The current terms and approval history remain intact. Your changes create a new private version."/><OfferComposer applications={item.candidate?[item.candidate]:[]} templates={templates.items} settings={settings} initial={item} jobID={q.job_id}/></div></RecruiterShell>
}
