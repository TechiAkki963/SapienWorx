import type { Metadata } from "next";
import { PublicJobDetail } from "../../../../components/recruiter";
import { getPublicJob, getSimilarPublicJobs } from "../../../../lib/backend";

export const dynamic = "force-dynamic";

function descriptionFromHtml(html: string) {
  return html.replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim().slice(0, 155);
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ jobId: string; slug: string }>;
}): Promise<Metadata> {
  const { jobId, slug } = await params;
  const job = await getPublicJob(jobId);

  if (!job) {
    return {
      title: "Job unavailable | Sapienworx",
      robots: { index: false, follow: false },
    };
  }

  const title = `${job.title} at ${job.organisationName} | Sapienworx`;
  const description = descriptionFromHtml(job.descriptionHtml) || `${job.title} role at ${job.organisationName}.`;
  const canonicalPath = job.publicPath || `/jobs/${encodeURIComponent(jobId)}/${encodeURIComponent(slug)}`;

  return {
    title,
    description,
    alternates: { canonical: canonicalPath },
    openGraph: {
      type: "website",
      title,
      description,
      url: canonicalPath,
      siteName: "Sapienworx",
      images: [{ url: `${canonicalPath}/opengraph-image`, width: 1200, height: 630, alt: `${job.title} at ${job.organisationName}` }],
    },
    twitter: { card: "summary_large_image", title, description, images: [`${canonicalPath}/opengraph-image`] },
  };
}

export default async function PublicJobDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ jobId: string; slug: string }>;
  searchParams: Promise<{ from?: string | string[]; ref?: string | string[]; source?: string | string[] }>;
}) {
  const { jobId, slug } = await params;
  const { from, ref, source } = await searchParams;
  const [job, similarJobs] = await Promise.all([getPublicJob(jobId), getSimilarPublicJobs(jobId)]);
  return <PublicJobDetail jobId={jobId} slug={slug} initialJob={job} similarJobs={similarJobs ?? []} referralCode={typeof ref === "string" ? ref : undefined} shareSource={typeof source === "string" ? source : undefined} fromSearch={from === "search" || (Array.isArray(from) && from.includes("search"))} />;
}
