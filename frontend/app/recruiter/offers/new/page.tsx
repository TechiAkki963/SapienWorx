import {OfferComposer} from "@/components/recruiter/offer-composer";
import {RecruiterShell} from "@/components/recruiter/recruiter-shell";
import {RecruiterProductHeader} from "@/components/recruiter/recruiter-product-header";
import {WorkspaceState} from "@/components/recruiter/workspace-ui";
import {JobContext} from "@/components/recruiter/job-context";
import {ownedRecruiterJob} from "@/lib/recruiter-job-server";
import {recruiterAPI} from "@/lib/recruiter-server";
import {requireRole} from "@/lib/auth-server";
import type {OfferSettings,OfferTemplate} from "@/lib/offers";
import type {PipelineRow} from "@/lib/recruiter";
export const dynamic="force-dynamic";
export default async function NewOffer({searchParams}:{searchParams:Promise<{application_id?:string;job_id?:string}>}){
 await requireRole("recruiter");const p=await searchParams;const settings=await recruiterAPI<OfferSettings>("/api/v1/company/offer-governance");
 if(!settings.permissions["offer.create"]||!settings.permissions["offer.view_compensation"]||!settings.entitlements.features["offers.studio"])return <RecruiterShell><WorkspaceState title="Offer preparation is unavailable" description="Your company role and an active Offer Studio entitlement are both required. Existing offers remain available."/></RecruiterShell>;
 const q=new URLSearchParams();if(p.application_id)q.set("application_id",p.application_id);if(p.job_id)q.set("job_id",p.job_id);
 const [applications,templates,job]=await Promise.all([recruiterAPI<{items:PipelineRow[]}>("/api/v1/recruiter/offer-applications?"+q),settings.entitlements.features["offers.templates"]?recruiterAPI<{items:OfferTemplate[]}>("/api/v1/recruiter/offer-templates"):Promise.resolve({items:[]}),p.job_id?ownedRecruiterJob(p.job_id):Promise.resolve(null)]);
 return <RecruiterShell><div className="grid gap-5 pb-24">{job&&<JobContext job={job} active="Offers"/>}<RecruiterProductHeader eyebrow="Offer Studio" title="Prepare an offer" description="Choose the application, prepare the terms and review the calculated draft before requesting approval."/><OfferComposer applications={applications.items} templates={templates.items} settings={settings} initialApplicationID={p.application_id} jobID={p.job_id}/></div></RecruiterShell>
}
