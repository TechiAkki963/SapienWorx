import { CompanyJobsPage, type PublicJob } from "../../../components/public-site";
import { getPublicJobs } from "../../../lib/backend";

export const dynamic = "force-dynamic";

function toPublicJob(job: NonNullable<Awaited<ReturnType<typeof getPublicJobs>>>["content"][number]): PublicJob {
  return {
    id: job.jobId,
    company: job.organisationName,
    companySlug: job.organisationName.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, ""),
    title: job.title,
    tags: job.skills,
    experience: `${job.minimumExperienceYears}–${job.maximumExperienceYears} years`,
    location: job.location,
    type: job.department || "Full-time",
    mark: job.organisationName.slice(0, 2).toUpperCase(),
    tone: "teal",
  };
}

export default async function CompanyPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const page = await getPublicJobs();
  const jobs = page?.content.map(toPublicJob);
  return <CompanyJobsPage slug={slug} jobs={jobs?.length ? jobs : undefined} />;
}
