import { RecruiterHiringLifecycleBar } from "../../../../../../components/recruiter-hiring-lifecycle-bar";
import { RecruiterJobApplicant } from "../../../../../../components/recruiter-job-applicant";

export default async function RecruiterJobApplicantPage({ params }: { params: Promise<{ jobId: string; applicationId: string }> }) {
  const { jobId, applicationId } = await params;
  return <>
    <RecruiterHiringLifecycleBar jobId={jobId} applicationId={applicationId}/>
    <RecruiterJobApplicant jobId={jobId} applicationId={applicationId}/>
  </>;
}
