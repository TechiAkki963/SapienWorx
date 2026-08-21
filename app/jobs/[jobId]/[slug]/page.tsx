import { PublicJobDetail } from "../../../../components/recruiter";
import { getPublicJob } from "../../../../lib/backend";

export const dynamic = "force-dynamic";

export default async function PublicJobDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ jobId: string; slug: string }>;
  searchParams: Promise<{ from?: string | string[] }>;
}) {
  const { jobId, slug } = await params;
  const { from } = await searchParams;
  return <PublicJobDetail jobId={jobId} slug={slug} initialJob={await getPublicJob(jobId)} fromSearch={from === "search" || (Array.isArray(from) && from.includes("search"))} />;
}
