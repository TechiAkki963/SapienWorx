import { PublicJobsPage } from "../../components/public-site";
import { getPublicJobs, type ApiJob, type PublicJobQuery } from "../../lib/backend";

function publicJob(job: ApiJob) {
  return { id: job.jobId, company: job.organisationName, companySlug: job.organisationName.toLowerCase().replace(/[^a-z0-9]+/g, "-"), title: job.title,
    tags: job.skills, experience: `${job.minimumExperienceYears}–${job.maximumExperienceYears} years`, location: job.location, department: job.department,
    employmentType: job.employmentType, workplaceModel: job.workplaceModel, postedAt: job.publishedAt, verifiedEmployer: job.verifiedEmployer,
    publicPath: job.publicPath, mark: job.organisationName.slice(0, 1), tone: "blue" };
}

type Search = Record<string, string | string[] | undefined>;
const first = (value: string | string[] | undefined) => Array.isArray(value) ? value[0] : value;
const number = (value: string | string[] | undefined) => { const parsed = Number(first(value)); return Number.isFinite(parsed) ? parsed : undefined; };

export default async function JobsPage({ searchParams }: { searchParams: Promise<Search> }) {
  const search = await searchParams;
  const query: PublicJobQuery = {
    keywords: first(search.keywords),
    location: first(search.location),
    workplaceModel: first(search.workplaceModel),
    employmentType: first(search.employmentType),
    minimumExperienceYears: number(search.minimumExperienceYears),
    maximumExperienceYears: number(search.maximumExperienceYears),
    minimumSalaryLakhs: number(search.minimumSalaryLakhs),
    maximumSalaryLakhs: number(search.maximumSalaryLakhs),
    page: number(search.page) ?? 0,
    pageSize: number(search.pageSize) ?? 20,
  };
  const jobs = await getPublicJobs(query);
  return <PublicJobsPage search={search} jobs={jobs?.content ?? []} page={jobs ?? undefined} />;
}
