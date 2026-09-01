import { RecruiterJobApplicant } from "../../../../../../components/recruiter-job-applicant";

export default async function RecruiterJobApplicantPage({ params }: { params: Promise<{ jobId: string; applicationId: string }> }) {
  const { jobId, applicationId } = await params;
  return <RecruiterJobApplicant jobId={jobId} applicationId={applicationId}/>;
}
