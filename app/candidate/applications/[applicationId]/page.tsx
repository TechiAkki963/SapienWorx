import { CandidateApplicationJourney } from "../../../../components/recruitment-evolution";

export default async function CandidateApplicationJourneyPage({ params }: { params: Promise<{ applicationId: string }> }) {
  const { applicationId } = await params;
  return <CandidateApplicationJourney applicationId={applicationId} />;
}
