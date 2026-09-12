import { RecruiterInterviewAvailability } from "../../../../../components/recruiter-interview-availability";

export default async function RecruiterInterviewAvailabilityPage({ params }: { params: Promise<{ applicationId: string }> }) {
  const { applicationId } = await params;
  return <RecruiterInterviewAvailability applicationId={applicationId} />;
}
