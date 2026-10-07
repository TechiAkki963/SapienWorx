import { JobContext } from "@/components/recruiter/job-context";
import { ownedRecruiterJob } from "@/lib/recruiter-job-server";
import { OffersWorkspace, type OfferApplicationOption, type OfferItem } from "@/components/recruiter/offers-workspace";
import { RecruiterProductHeader } from "@/components/recruiter/recruiter-product-header";
import { RecruiterShell } from "@/components/recruiter/recruiter-shell";
import { requireRole } from "@/lib/auth-server";
import { recruiterAPI } from "@/lib/recruiter-server";

export const dynamic="force-dynamic";

type Pipeline={items:OfferApplicationOption[]};

export default async function OffersPage({searchParams}:{searchParams:Promise<{job_id?:string}>}){
  await requireRole("recruiter");
  const {job_id} = await searchParams;
  const job = job_id ? await ownedRecruiterJob(job_id) : null;
  const suffix = job_id ? `?job_id=${encodeURIComponent(job_id)}` : "";
  const [{items},pipeline]=await Promise.all([
    recruiterAPI<{items:OfferItem[]}>(`/api/v1/recruiter/offers${suffix}`),
    recruiterAPI<Pipeline>(`/api/v1/recruiter/pipeline?limit=50&sort=recently_updated${job_id ? `&job_id=${encodeURIComponent(job_id)}` : ""}`),
  ]);
  const applications=(pipeline.items??[]).filter(item=>!["hired","rejected","withdrawn"].includes(item.stage));
  return <RecruiterShell><div className="grid gap-5 pb-24">
    {job && <JobContext job={job} active="Offers"/>}
    <RecruiterProductHeader eyebrow="Candidate conversion" title="Offers" description="Create, send and track offers without losing the application and company context." />
    <OffersWorkspace initialItems={items??[]} applications={applications}/>
  </div></RecruiterShell>;
}
