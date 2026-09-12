import { RecruiterHiringPlan } from "../../../../../components/recruitment-evolution";

export default async function RecruiterHiringPlanPage({ params }: { params: Promise<{ jobId: string }> }) {
  const { jobId } = await params;
  return <RecruiterHiringPlan jobId={jobId} />;
}
