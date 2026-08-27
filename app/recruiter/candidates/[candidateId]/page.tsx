import { RecruiterCandidateDetail } from "../../../../components/recruiter-candidate-detail";

function safeReturnTo(value: string | string[] | undefined) {
  const destination = Array.isArray(value) ? value[0] : value;
  return destination?.startsWith("/search/results") ? destination : "/recruiter/sourcing";
}

export default async function RecruiterCandidateProfilePage({ params, searchParams }: { params: Promise<{ candidateId: string }>; searchParams: Promise<{ returnTo?: string | string[] }> }) {
  const { candidateId } = await params;
  const { returnTo } = await searchParams;
  return <RecruiterCandidateDetail candidateId={candidateId} returnTo={safeReturnTo(returnTo)} />;
}
