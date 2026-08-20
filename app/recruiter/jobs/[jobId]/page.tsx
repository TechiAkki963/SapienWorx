import { RecruiterJobDetail } from "../../../../components/recruiter";
import { knownJobRoutes } from "../../../../lib/jobs/routes";

export function generateStaticParams() {
  return knownJobRoutes.map(({ jobId }) => ({ jobId }));
}

export default async function RecruiterJobDetailPage({
  params,
}: {
  params: Promise<{ jobId: string }>;
}) {
  const { jobId } = await params;
  return <RecruiterJobDetail jobId={jobId} />;
}
