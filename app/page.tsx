import { PublicLanding } from "../components/public-site";
import { getPublicJobs, getPublicKnowledgePosts, type ApiJob } from "../lib/backend";

function publicJob(job: ApiJob) {
  return { id: job.jobId, company: job.organisationName, companySlug: job.organisationName.toLowerCase().replace(/[^a-z0-9]+/g, "-"), title: job.title,
    tags: job.skills, experience: `${job.minimumExperienceYears}–${job.maximumExperienceYears} years`, location: job.location, department: job.department,
    employmentType: job.employmentType, workplaceModel: job.workplaceModel, postedAt: job.publishedAt, verifiedEmployer: job.verifiedEmployer,
    publicPath: job.publicPath, mark: job.organisationName.slice(0, 1), tone: "blue" };
}

export default async function HomePage() {
  const [jobs, articles] = await Promise.all([getPublicJobs(), getPublicKnowledgePosts()]);
  return <PublicLanding jobs={jobs?.content.map(publicJob)} articles={articles ?? undefined} />;
}
