import { JobCard } from "@/components/candidate/job-card";
import { Button } from "@/components/ui/button";
import { Surface } from "@/components/ui/surface";
import { CandidateJob, JobList } from "@/lib/candidate";
import { candidateAPI } from "@/lib/candidate-server";

export const dynamic = "force-dynamic";

type Props = { searchParams: Promise<Record<string, string | string[] | undefined>> };

const educationOptions = [
  "Any Postgraduate",
  "Post Graduation Not Required",
  "M.Tech",
  "MCA",
  "MS/M.Sc(Science)",
  "MBA/PGDM",
  "LLM",
  "PG Diploma",
  "Any Graduate",
  "B.Tech / B.E.",
  "B.Sc",
  "B.C.A.",
  "Graduation Not Required",
  "B.A - Bachelor of Arts",
  "B.Com",
  "Diploma",
];

function single(value: string | string[] | undefined): string {
  return Array.isArray(value) ? value[0] ?? "" : value ?? "";
}

function many(value: string | string[] | undefined): string[] {
  if (Array.isArray(value)) return value.filter(Boolean);
  return value ? [value] : [];
}

export default async function CandidateJobsPage({ searchParams }: Props) {
  const params = await searchParams;
  const q = single(params.q);
  const location = single(params.location);
  const company = single(params.company);
  const workMode = single(params.work_mode);
  const experience = single(params.experience);
  const education = many(params.education);
  const page = Math.max(1, Number(single(params.page)) || 1);
  const query = new URLSearchParams({ q, location, company, page: String(page), limit: "10" });
  if (workMode) query.set("work_mode", workMode);
  if (experience) query.set("experience", experience);
  for (const value of education) query.append("education", value);

  const [result, recommendationResult] = await Promise.all([
    candidateAPI<JobList>(`/api/v1/candidate/jobs?${query.toString()}`).catch(() => null),
    candidateAPI<{ items: CandidateJob[]; minimum_match: number }>("/api/v1/candidate/recommendations").catch(() => ({ items: [], minimum_match: 65 })),
  ]);

  const pageCount = result ? Math.max(1, Math.ceil(result.total / result.limit)) : 1;
  const pageHref = (next: number) => {
    const nextQuery = new URLSearchParams(query);
    nextQuery.set("page", String(next));
    return `/candidate/jobs?${nextQuery.toString()}`;
  };
  const hasFilters = Boolean(q || location || company || workMode || experience || education.length);

  return (
    <div>
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.14em] text-indigo">Candidate job discovery</p>
          <h1 className="mt-2 text-4xl font-bold tracking-[-0.045em] text-navy">Find jobs without leaving your workspace.</h1>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-ink-muted">Search active roles by skills, company, education, experience and location while staying signed in.</p>
        </div>
      </div>

      {recommendationResult.items.length > 0 && (
        <section className="mt-7" aria-labelledby="recommended-title">
          <div className="flex flex-wrap items-end justify-between gap-3">
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.14em] text-indigo">Recommended for you</p>
              <h2 id="recommended-title" className="mt-1 text-2xl font-bold text-navy">65%+ skill matches</h2>
            </div>
            <p className="text-xs font-semibold text-ink-muted">Based only on your saved IT skills and each job&apos;s required skills.</p>
          </div>
          <div className="mt-4 grid gap-4 xl:grid-cols-2">
            {recommendationResult.items.map((job) => <JobCard key={job.id} job={job} hrefBase="/candidate/jobs" />)}
          </div>
        </section>
      )}

      <div className="mt-8 grid gap-6 lg:grid-cols-[20rem_minmax(0,1fr)]">
        <aside className="lg:sticky lg:top-24 lg:self-start">
          <Surface className="p-5">
            <p className="text-xs font-bold uppercase tracking-[0.15em] text-indigo">Refine search</p>
            <form className="mt-5 grid gap-4" action="/candidate/jobs">
              <label className="grid gap-1.5 text-sm font-semibold text-ink">Keyword<input name="q" defaultValue={q} className="min-h-11 rounded-xl border border-line bg-white px-3 font-normal outline-none focus:border-indigo/40 focus:ring-2 focus:ring-indigo/15" placeholder="Role or skill" /></label>
              <label className="grid gap-1.5 text-sm font-semibold text-ink">Company name<input name="company" defaultValue={company} className="min-h-11 rounded-xl border border-line bg-white px-3 font-normal outline-none focus:border-indigo/40 focus:ring-2 focus:ring-indigo/15" placeholder="Search company" /></label>
              <label className="grid gap-1.5 text-sm font-semibold text-ink">Location<input name="location" defaultValue={location} className="min-h-11 rounded-xl border border-line bg-white px-3 font-normal outline-none focus:border-indigo/40 focus:ring-2 focus:ring-indigo/15" placeholder="Mumbai, Pune…" /></label>
              <label className="grid gap-1.5 text-sm font-semibold text-ink">Experience<select name="experience" defaultValue={experience} className="min-h-11 rounded-xl border border-line bg-white px-3 font-normal outline-none focus:border-indigo/40 focus:ring-2 focus:ring-indigo/15"><option value="">Any experience</option><option value="0">Fresher / 0 years</option><option value="1">1 year</option><option value="2">2 years</option><option value="3">3 years</option><option value="5">5 years</option><option value="8">8 years</option><option value="10">10+ years</option></select></label>
              <label className="grid gap-1.5 text-sm font-semibold text-ink">Work mode<select name="work_mode" defaultValue={workMode} className="min-h-11 rounded-xl border border-line bg-white px-3 font-normal outline-none focus:border-indigo/40 focus:ring-2 focus:ring-indigo/15"><option value="">Any</option><option value="remote">Remote</option><option value="hybrid">Hybrid</option><option value="onsite">On-site</option></select></label>

              <details className="rounded-xl border border-line bg-white" open={education.length > 0}>
                <summary className="cursor-pointer list-none px-3 py-3 text-sm font-semibold text-ink">Education {education.length ? <span className="ml-1 text-xs text-indigo">({education.length})</span> : null}</summary>
                <div className="max-h-80 overflow-y-auto border-t border-line px-3 py-3">
                  <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-1">
                    {educationOptions.map((option) => (
                      <label key={option} className="flex items-start gap-2 text-xs font-medium leading-5 text-ink-muted">
                        <input type="checkbox" name="education" value={option} defaultChecked={education.includes(option)} className="mt-0.5 h-4 w-4 rounded border-line" />
                        <span>{option}</span>
                      </label>
                    ))}
                  </div>
                </div>
              </details>

              <Button type="submit">Apply filters</Button>
              {hasFilters && <Button href="/candidate/jobs" variant="ghost">Clear filters</Button>}
            </form>
          </Surface>
        </aside>

        <section aria-labelledby="all-jobs-title">
          <div className="flex items-end justify-between gap-3"><h2 id="all-jobs-title" className="text-2xl font-bold text-navy">All active roles</h2>{result && <p className="text-sm font-semibold text-ink-muted">{result.total} roles</p>}</div>
          {!result ? <Surface className="mt-5 p-8 text-center" tone="peach"><h3 className="font-bold">Jobs are temporarily unavailable.</h3></Surface> : result.items.length ? <div className="mt-5 grid gap-4 xl:grid-cols-2">{result.items.map((job) => <JobCard key={job.id} job={job} hrefBase="/candidate/jobs" />)}</div> : <Surface className="mt-5 p-8 text-center" tone="mint"><h3 className="font-bold">No roles match those filters yet.</h3><p className="mt-2 text-sm text-ink-muted">Try broadening company, education, experience or location filters.</p></Surface>}

          {result && result.total > result.limit && <nav className="mt-7 flex items-center justify-between gap-4" aria-label="Job result pages"><Button href={pageHref(Math.max(1, page - 1))} variant="secondary" size="sm" className={page <= 1 ? "pointer-events-none opacity-50" : undefined}>← Previous</Button><span className="text-sm font-semibold text-ink-muted">Page {page} of {pageCount}</span><Button href={pageHref(Math.min(pageCount, page + 1))} variant="secondary" size="sm" className={page >= pageCount ? "pointer-events-none opacity-50" : undefined}>Next →</Button></nav>}
        </section>
      </div>
    </div>
  );
}
