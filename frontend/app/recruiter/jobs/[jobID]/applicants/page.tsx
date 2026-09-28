import { ApplicationsWorkspace } from "@/components/recruiter/applications-workspace";
import { ApplicationFilterValues } from "@/components/recruiter/application-filters";

export const dynamic = "force-dynamic";

export default async function JobApplicantsPage({ params, searchParams }: {
  params: Promise<{ jobID: string }>;
  searchParams: Promise<ApplicationFilterValues>;
}) {
  const [{ jobID }, filters] = await Promise.all([params, searchParams]);
  return <ApplicationsWorkspace searchParams={filters} fixedJobID={jobID} />;
}
