import { JobCard } from "@/components/candidate/job-card";
import { SalaryRangeFilter } from "@/components/candidate/salary-range-filter";
import { Button } from "@/components/ui/button";
import { Surface } from "@/components/ui/surface";
import { TaxonomyInput } from "@/components/workforce/taxonomy-input";
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

const roleCategoryOptions = [
  "Healthcare",
  "Finance",
  "Human Resources",
  "Operations",
  "Sales",
  "Marketing",
  "Technology",
  "Product",
  "Design",
  "Manufacturing",
  "Logistics",
  "Hospitality",
  "Education",
  "Construction",
  "Legal",
  "Retail",
  "Other",
];

const discoveryEntityTypes = [
  "industry",
  "sector",
  "functional_area",
  "job_family",
  "occupation",
  "specialisation",
  "skill",
  "competency",
  "tool",
  "technology",
  "equipment",
  "certification",
  "licence",
  "qualification",
  "domain_knowledge",
  "regulatory_requirement",
  "methodology",
];

const competencyEntityTypes = [
  "skill",
  "competency",
  "tool",
  "technology",
  "equipment",
  "certification",
  "licence",
  "qualification",
  "domain_knowledge",
  "regulatory_requirement",
  "methodology",
];

const inputClass = "min-h-11 w-full rounded-xl border border-line bg-white px-3 font-normal outline-none focus:border-indigo/40 focus:ring-2 focus:ring-indigo/15";

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
  const employmentType = single(params.employment_type);
  const roleCategory = single(params.role_category);
  const competency = single(params.competency);
  const experience = single(params.experience);
  const education = many(params.education);
  const minSalary = single(params.min_salary);
  const maxSalary = single(params.max_salary);
  const salaryCurrency = single(params.salary_currency) || "INR";
  const postedWithin = single(params.posted_within);
  const sort = single(params.sort) || (q || competency ? "relevance" : "newest");
  const page = Math.max(1, Number(single(params.page)) || 1);

  const query = new URLSearchParams({ q, location, company, page: String(page), limit: "10" });
  if (workMode) query.set("work_mode", workMode);
  if (employmentType) query.set("employment_type", employmentType);
  if (roleCategory) query.set("role_category", roleCategory);
  if (competency) query.set("competency", competency);
  if (experience) query.set("experience", experience);
  if (minSalary) query.set("min_salary", minSalary);
  if (maxSalary) query.set("max_salary", maxSalary);
  if (minSalary || maxSalary) query.set("salary_currency", salaryCurrency);
  if (postedWithin) query.set("posted_within", postedWithin);
  query.set("sort", sort);
  for (const value of education) query.append("education", value);

  const [result, recommendationResult, savedResult] = await Promise.all([
    candidateAPI<JobList>(`/api/v1/candidate/jobs?${query.toString()}`).catch(() => null),
    candidateAPI<{ items: CandidateJob[]; minimum_match: number }>("/api/v1/candidate/recommendations").catch(() => ({ items: [], minimum_match: 65 })),
    candidateAPI<{ items: CandidateJob[] }>("/api/v1/candidate/saved-jobs").catch(() => ({ items: [] })),
  ]);
  const savedIds = new Set(savedResult.items.map((item) => item.id));

  const pageCount = result ? Math.max(1, Math.ceil(result.total / result.limit)) : 1;
  const pageHref = (next: number) => {
    const nextQuery = new URLSearchParams(query);
    nextQuery.set("page", String(next));
    return `/candidate/jobs?${nextQuery.toString()}`;
  };
  const hasFilters = Boolean(
    q ||
    location ||
    company ||
    workMode ||
    employmentType ||
    roleCategory ||
    competency ||
    experience ||
    education.length ||
    minSalary ||
    maxSalary ||
    postedWithin,
  );

  return (
    <div>
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.14em] text-indigo">Candidate job discovery</p>
          <h1 className="mt-2 text-4xl font-bold tracking-[-0.045em] text-navy">Find work that fits your profile.</h1>
          <p className="mt-2 max-w-3xl text-sm leading-6 text-ink-muted">
            Search active roles across industries by occupation, competencies, location, experience, education, working model and compensation.
          </p>
        </div>
      </div>

      {recommendationResult.items.length > 0 && (
        <section className="mt-7" aria-labelledby="recommended-title">
          <div className="flex flex-wrap items-end justify-between gap-3">
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.14em] text-indigo">Recommended for you</p>
              <h2 id="recommended-title" className="mt-1 text-2xl font-bold text-navy">65%+ competency matches</h2>
            </div>
            <p className="max-w-xl text-xs font-semibold leading-5 text-ink-muted">
              Based on competencies saved in your profile and the requirements attached to each active role.
            </p>
          </div>
          <div className="mt-4 grid gap-4 xl:grid-cols-2">
            {recommendationResult.items.map((job) => <JobCard key={job.id} job={job} hrefBase="/candidate/jobs" initialSaved={savedIds.has(job.id)} />)}
          </div>
        </section>
      )}

      <div className="mt-8 grid gap-6 xl:grid-cols-[20rem_minmax(0,1fr)]">
        <aside className="xl:sticky xl:top-24 xl:self-start">
          <Surface className="p-5">
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.15em] text-indigo">Refine search</p>
              <p className="mt-1 text-xs leading-5 text-ink-muted">All filters are optional and remain in the URL so the search can be revisited or shared.</p>
            </div>

            <form className="mt-5 grid gap-4" action="/candidate/jobs">
              <div className="grid gap-1.5">
                <span className="text-sm font-semibold text-ink">Role or keyword</span>
                <TaxonomyInput
                  name="q"
                  defaultValue={q}
                  entityTypes={discoveryEntityTypes}
                  ariaLabel="Keyword"
                  placeholder="e.g. ICU Nursing, Accounts Payable"
                  className={inputClass}
                />
                <span className="text-xs leading-5 text-ink-muted">Recognised aliases use the workforce taxonomy; legitimate new terms still use literal search.</span>
              </div>

              <div className="grid gap-1.5">
                <span className="text-sm font-semibold text-ink">Competency or requirement</span>
                <TaxonomyInput
                  name="competency"
                  defaultValue={competency}
                  entityTypes={competencyEntityTypes}
                  ariaLabel="Competency"
                  placeholder="e.g. Patient Assessment, Negotiation"
                  className={inputClass}
                />
              </div>

              <label className="grid gap-1.5 text-sm font-semibold text-ink">Company name<input name="company" defaultValue={company} className={inputClass} placeholder="Search company" /></label>
              <label className="grid gap-1.5 text-sm font-semibold text-ink">Location<input name="location" defaultValue={location} className={inputClass} placeholder="Mumbai, Pune…" /></label>

              <label className="grid gap-1.5 text-sm font-semibold text-ink">
                Role / function
                <select name="role_category" defaultValue={roleCategory} className={inputClass}>
                  <option value="">Any role / function</option>
                  {roleCategoryOptions.map((option) => <option key={option} value={option}>{option}</option>)}
                </select>
              </label>

              <label className="grid gap-1.5 text-sm font-semibold text-ink">
                Employment type
                <select name="employment_type" defaultValue={employmentType} className={inputClass}>
                  <option value="">Any employment type</option>
                  <option value="full_time">Full time</option>
                  <option value="part_time">Part time</option>
                  <option value="contract">Contract</option>
                  <option value="internship">Internship</option>
                  <option value="temporary">Temporary</option>
                </select>
              </label>

              <label className="grid gap-1.5 text-sm font-semibold text-ink">
                Experience
                <select name="experience" defaultValue={experience} className={inputClass}>
                  <option value="">Any experience</option>
                  <option value="0">Fresher / 0 years</option>
                  <option value="1">1 year</option>
                  <option value="2">2 years</option>
                  <option value="3">3 years</option>
                  <option value="5">5 years</option>
                  <option value="8">8 years</option>
                  <option value="10">10+ years</option>
                </select>
              </label>

              <SalaryRangeFilter key={`${salaryCurrency}:${minSalary}:${maxSalary}`} minSalary={minSalary} maxSalary={maxSalary} salaryCurrency={salaryCurrency} />

              <label className="grid gap-1.5 text-sm font-semibold text-ink">
                Work mode
                <select name="work_mode" defaultValue={workMode} className={inputClass}>
                  <option value="">Any work mode</option>
                  <option value="remote">Remote</option>
                  <option value="hybrid">Hybrid</option>
                  <option value="onsite">On-site</option>
                </select>
              </label>

              <label className="grid gap-1.5 text-sm font-semibold text-ink">
                Posted date
                <select name="posted_within" defaultValue={postedWithin} className={inputClass}>
                  <option value="">Any time</option>
                  <option value="1">Past 24 hours</option>
                  <option value="3">Past 3 days</option>
                  <option value="7">Past week</option>
                  <option value="14">Past 2 weeks</option>
                  <option value="30">Past month</option>
                  <option value="90">Past 3 months</option>
                </select>
              </label>

              <details className="rounded-xl border border-line bg-white" open={education.length > 0}>
                <summary className="cursor-pointer list-none px-3 py-3 text-sm font-semibold text-ink">
                  Education {education.length ? <span className="ml-1 text-xs text-indigo">({education.length})</span> : null}
                </summary>
                <div className="max-h-80 overflow-y-auto border-t border-line px-3 py-3">
                  <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-1">
                    {educationOptions.map((option) => (
                      <label key={option} className="flex items-start gap-2 text-xs font-medium leading-5 text-ink-muted">
                        <input type="checkbox" name="education" value={option} defaultChecked={education.includes(option)} className="mt-0.5 h-4 w-4 rounded border-line" />
                        <span>{option}</span>
                      </label>
                    ))}
                  </div>
                </div>
              </details>

              <label className="grid gap-1.5 text-sm font-semibold text-ink">
                Sort by
                <select name="sort" defaultValue={sort} className={inputClass}>
                  <option value="relevance">Relevance</option>
                  <option value="newest">Newest</option>
                </select>
              </label>

              <Button type="submit">Apply filters</Button>
              {hasFilters && <Button href="/candidate/jobs" variant="ghost">Clear filters</Button>}
            </form>
          </Surface>
        </aside>

        <section aria-labelledby="all-jobs-title" className="min-w-0">
          <div className="flex flex-wrap items-end justify-between gap-3">
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.14em] text-indigo">Search results</p>
              <h2 id="all-jobs-title" className="mt-1 text-2xl font-bold text-navy">All active roles</h2>
            </div>
            {result && <p className="text-sm font-semibold text-ink-muted">{result.total} roles · {result.sort === "relevance" ? "Relevance" : "Newest"}</p>}
          </div>

          {(result?.query_interpretation || result?.competency_interpretation) && (
            <Surface className="mt-4 p-4" tone="lavender">
              <p className="text-xs font-bold uppercase tracking-[0.12em] text-indigo">Taxonomy interpretation</p>
              {result?.query_interpretation && (
                <p className="mt-1 text-sm leading-6 text-ink">
                  Interpreted “{result.query_interpretation.input}” as <strong>{result.query_interpretation.canonical}</strong> <span className="capitalize text-ink-muted">({result.query_interpretation.entity_type.replaceAll("_", " ")})</span>.
                </p>
              )}
              {result?.competency_interpretation && (
                <p className="mt-1 text-sm leading-6 text-ink">
                  Interpreted competency “{result.competency_interpretation.input}” as <strong>{result.competency_interpretation.canonical}</strong>.
                </p>
              )}
            </Surface>
          )}

          {!result ? (
            <Surface className="mt-5 p-8 text-center" tone="peach"><h3 className="font-bold">Jobs are temporarily unavailable.</h3></Surface>
          ) : result.items.length ? (
            <div className="mt-5 grid gap-4 2xl:grid-cols-2">{result.items.map((job) => <JobCard key={job.id} job={job} hrefBase="/candidate/jobs" initialSaved={savedIds.has(job.id)} />)}</div>
          ) : (
            <Surface className="mt-5 p-8 text-center" tone="mint">
              <h3 className="font-bold">No roles match those filters yet.</h3>
              <p className="mt-2 text-sm text-ink-muted">Try broadening the role, competency, company, education, salary, experience or location filters.</p>
            </Surface>
          )}

          {result && result.total > result.limit && (
            <nav className="mt-7 flex items-center justify-between gap-4" aria-label="Job result pages">
              <Button href={pageHref(Math.max(1, page - 1))} variant="secondary" size="sm" className={page <= 1 ? "pointer-events-none opacity-50" : undefined}>← Previous</Button>
              <span className="text-sm font-semibold text-ink-muted">Page {page} of {pageCount}</span>
              <Button href={pageHref(Math.min(pageCount, page + 1))} variant="secondary" size="sm" className={page >= pageCount ? "pointer-events-none opacity-50" : undefined}>Next →</Button>
            </nav>
          )}
        </section>
      </div>
    </div>
  );
}
