import { CandidateJobs } from "../../../components/candidate";
export default async function CandidateJobsPage({ searchParams }: { searchParams: Promise<{ sharedJob?: string | string[]; apply?: string | string[] }> }) {
  const { sharedJob, apply } = await searchParams;
  return <CandidateJobs sharedJobId={typeof sharedJob === "string" ? sharedJob : undefined} sharedApplyOutcome={typeof apply === "string" ? apply : undefined} />;
}
