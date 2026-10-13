import {notFound} from "next/navigation";
import {OfferDetail} from "@/components/recruiter/offer-detail";
import {RecruiterShell} from "@/components/recruiter/recruiter-shell";
import {JobContext} from "@/components/recruiter/job-context";
import {ownedRecruiterJob} from "@/lib/recruiter-job-server";
import {recruiterAPI,RecruiterBackendError} from "@/lib/recruiter-server";
import {requireRole} from "@/lib/auth-server";
import type {GovernedOffer,OfferSettings} from "@/lib/offers";
export const dynamic="force-dynamic";
export default async function Offer({params,searchParams}:{params:Promise<{offerID:string}>;searchParams:Promise<{job_id?:string}>}){
 const user=await requireRole("recruiter");const {offerID}=await params;const q=await searchParams;let item:GovernedOffer;
 try{item=await recruiterAPI<GovernedOffer>(`/api/v1/recruiter/offers/${encodeURIComponent(offerID)}`)}catch(cause){if(cause instanceof RecruiterBackendError&&[403,404].includes(cause.status))notFound();throw cause}
 if(q.job_id&&q.job_id!==item.job_id)notFound();const [settings,job]=await Promise.all([recruiterAPI<OfferSettings>("/api/v1/company/offer-governance"),q.job_id?ownedRecruiterJob(q.job_id):Promise.resolve(null)]);
 return <RecruiterShell><div className="grid gap-5 pb-24">{job&&<JobContext job={job} active="Offers"/>}<OfferDetail initial={item} userID={user.id} jobID={q.job_id} canPrepare={settings.entitlements.features["offers.studio"]}/></div></RecruiterShell>
}
