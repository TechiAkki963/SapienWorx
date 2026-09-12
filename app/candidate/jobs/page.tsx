import { CandidateJobsV2 } from "../../../components/candidate-jobs-v2";

export default async function CandidateJobsPage({ searchParams }: { searchParams: Promise<{ sharedJob?: string | string[]; apply?: string | string[] }> }) {
  const { sharedJob, apply } = await searchParams;
  return <CandidateJobsV2 sharedJobId={typeof sharedJob === "string" ? sharedJob : undefined} sharedApplyOutcome={typeof apply === "string" ? apply : undefined} />;
}
