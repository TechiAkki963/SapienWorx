import { PublicLanding } from "../components/public-site";
import { getPublicJobs, type ApiJob } from "../lib/backend";

function publicJob(job: ApiJob) {
  return { id: job.jobId, company: job.organisationName, companySlug: job.organisationName.toLowerCase().replace(/[^a-z0-9]+/g, "-"), title: job.title,
    tags: job.skills, experience: `${job.minimumExperienceYears}–${job.maximumExperienceYears} years`, location: job.location, type: job.department, mark: job.organisationName.slice(0, 1), tone: "blue" };
}

export default async function HomePage() {
  const jobs = await getPublicJobs();
  return <PublicLanding jobs={jobs?.content.map(publicJob)} />;
}
