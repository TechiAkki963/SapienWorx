import { RecruiterJobRediscovery } from "../../../../../components/recruitment-evolution";

export default async function RecruiterJobRediscoveryPage({ params }: { params: Promise<{ jobId: string }> }) {
  const { jobId } = await params;
  return <RecruiterJobRediscovery jobId={jobId} />;
}
