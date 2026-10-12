import {JobContext} from "@/components/recruiter/job-context";
import {ownedRecruiterJob} from "@/lib/recruiter-job-server";
import {OffersWorkspace} from "@/components/recruiter/offers-workspace";
import {RecruiterProductHeader} from "@/components/recruiter/recruiter-product-header";
import {RecruiterShell} from "@/components/recruiter/recruiter-shell";
import {requireRole} from "@/lib/auth-server";
import {recruiterAPI} from "@/lib/recruiter-server";
import type {OfferList,OfferSettings} from "@/lib/offers";
export const dynamic="force-dynamic";
export default async function OffersPage({searchParams}:{searchParams:Promise<{job_id?:string;view?:string;status?:string;q?:string;page?:string}>}){
 await requireRole("recruiter");const params=await searchParams;const view=params.view||"overview";const status=view==="approvals"?"awaiting_approval":params.status||"";
 const job=params.job_id?await ownedRecruiterJob(params.job_id):null;const query=new URLSearchParams({page:params.page||"1",limit:"25",status,q:params.q||""});if(params.job_id)query.set("job_id",params.job_id);
 const [data,settings]=await Promise.all([recruiterAPI<OfferList>("/api/v1/recruiter/offers?"+query),recruiterAPI<OfferSettings>("/api/v1/company/offer-governance")]);
 return <RecruiterShell><div className="grid gap-5 pb-24">{job&&<JobContext job={job} active="Offers"/>}<RecruiterProductHeader eyebrow="Recruit Plus+" title="Offer Studio" description="Prepare, approve and share offers. Every decision stays linked to its exact version."/><OffersWorkspace data={data} settings={settings} jobID={params.job_id} view={view} status={status} query={params.q}/></div></RecruiterShell>
}
