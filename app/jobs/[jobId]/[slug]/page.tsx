import { PublicJobDetail } from "../../../../components/recruiter";
import { knownJobRoutes } from "../../../../lib/jobs/routes";

export function generateStaticParams() {
  return knownJobRoutes;
}

export default async function PublicJobDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ jobId: string; slug: string }>;
  searchParams: Promise<{ from?: string | string[] }>;
}) {
  const { jobId, slug } = await params;
  const { from } = await searchParams;
  return <PublicJobDetail jobId={jobId} slug={slug} fromSearch={from === "search" || (Array.isArray(from) && from.includes("search"))} />;
}
