import Link from "next/link";

import { RecruiterShell } from "@/components/recruiter/recruiter-shell";
import { DiscoveryCandidateActions, SaveDiscoverySearch } from "@/components/recruiter/discovery-actions";
import { TaxonomyInput } from "@/components/workforce/taxonomy-input";
import { requireRole } from "@/lib/auth-server";
import { RecruiterBackendError, recruiterAPI } from "@/lib/recruiter-server";

export const dynamic = "force-dynamic";

type Candidate = {
  id: string; full_name: string; headline?: string; designation: string; current_company: string;
  current_city?: string; current_state?: string; experience_months: number;
  notice_period_days?: number; preferred_locations: string; skills: string[];
  education: string; updated_at: string;
};
type Results = { items: Candidate[]; page: number; limit: number; total: number };
type SavedSearch = { id:string; name:string; filters:Record<string,string>; updated_at:string };
type RecentSearch = { id:number; filters:Record<string,string>; created_at:string };
type Filters = Record<string, string | undefined>;
type Props = { searchParams: Promise<Filters> };
const names = ["q", "designation", "current_company", "previous_company", "min_experience", "max_experience", "location", "preferred_location", "max_notice_days", "skills", "education", "employment_type", "work_mode", "industry", "functional_area", "languages", "certifications", "availability", "gender", "disability", "defence_background", "updated_since", "sort"] as const;
const fieldClass = "min-h-10 w-full rounded-lg border border-line bg-white px-3 py-2 text-sm text-ink focus:outline-none focus:ring-2 focus:ring-indigo";

function href(filters: Filters, page: number) {
  const query = new URLSearchParams();
  for (const name of names) if (filters[name]) query.set(name, filters[name]);
  query.set("page", String(page));
  return `/recruiter/discover?${query}`;
}

export default async function DiscoverTalentPage({ searchParams }: Props) {
  await requireRole("recruiter");
  const filters = await searchParams;
  const query = new URLSearchParams();
  for (const name of names) if (filters[name]) query.set(name, filters[name]);
  query.set("page", filters.page || "1");
  let result: Results | null = null;
  let error = "";
  try { result = await recruiterAPI<Results>(`/api/v1/recruiter/discover?${query}`); }
  catch (cause) {
    if (cause instanceof RecruiterBackendError && cause.status === 400) error = "Check the Boolean search syntax and filter ranges, then try again.";
    else throw cause;
  }
  const pages = result ? Math.max(1, Math.ceil(result.total / result.limit)) : 1;
  const [{items:savedSearches},{items:recentSearches}] = await Promise.all([recruiterAPI<{items:SavedSearch[]}>("/api/v1/recruiter/saved-searches"), recruiterAPI<{items:RecentSearch[]}>("/api/v1/recruiter/recent-searches")]);
  const searchHref=(values:Record<string,string>)=>{const p=new URLSearchParams();for(const name of names)if(values[name])p.set(name,values[name]);return `/recruiter/discover?${p}`};

  return <RecruiterShell><div className="grid gap-5 pb-24">
    <header className="rounded-2xl border border-indigo/10 bg-[linear-gradient(120deg,#f1f1ff,#f3faf7)] p-5 sm:p-6">
      <p className="text-xs font-extrabold uppercase tracking-[0.14em] text-indigo">Recruiter workspace</p>
      <h1 className="mt-1 text-2xl font-extrabold tracking-tight text-navy sm:text-3xl">Discover Talent</h1>
      <p className="mt-2 max-w-3xl text-sm leading-6 text-ink-muted">Find candidates who chose to appear in recruiter search, before they apply. Search professional details only; private contact information and CVs remain protected.</p>
    </header>
    <div className="grid items-start gap-5 xl:grid-cols-[17rem_minmax(0,1fr)_14rem]">
      <aside className="xl:sticky xl:top-5"><div className="rounded-2xl border border-line/70 bg-white shadow-sm xl:border-0 xl:bg-transparent xl:shadow-none"><input id="discovery-filter-toggle" type="checkbox" className="peer sr-only" /><label htmlFor="discovery-filter-toggle" className="flex min-h-12 cursor-pointer items-center justify-between gap-3 px-4 text-sm font-extrabold text-navy xl:hidden">Search & filters <span aria-hidden="true" className="text-indigo transition peer-checked:rotate-180">⌄</span></label><form action="/recruiter/discover" method="get" className="hidden gap-3 border-t border-line/70 p-4 peer-checked:grid xl:grid xl:rounded-2xl xl:border xl:bg-white xl:shadow-sm">
        <div><h2 className="text-sm font-bold text-navy">Search & filters</h2><p className="mt-1 text-xs leading-5 text-ink-muted">Use AND, OR, NOT, quotes and parentheses. Filters stay in the URL so you can bookmark this search.</p></div>
        <label className="grid gap-1 text-xs font-semibold text-ink-muted">Keywords or Boolean query<input name="q" defaultValue={filters.q ?? ""} maxLength={300} placeholder='("Java" OR "Go") AND PostgreSQL' className={fieldClass} /></label>
        <label className="grid gap-1 text-xs font-semibold text-ink-muted">Designation<input name="designation" defaultValue={filters.designation ?? ""} placeholder="Backend engineer" className={fieldClass} /></label>
        <label className="grid gap-1 text-xs font-semibold text-ink-muted">Current company<input name="current_company" defaultValue={filters.current_company ?? ""} className={fieldClass} /></label>
        <label className="grid gap-1 text-xs font-semibold text-ink-muted">Previous company<input name="previous_company" defaultValue={filters.previous_company ?? ""} className={fieldClass} /></label>
        <div className="grid grid-cols-2 gap-2"><label className="grid gap-1 text-xs font-semibold text-ink-muted">Min years<input name="min_experience" type="number" min="0" max="60" defaultValue={filters.min_experience ?? ""} className={fieldClass} /></label><label className="grid gap-1 text-xs font-semibold text-ink-muted">Max years<input name="max_experience" type="number" min="0" max="60" defaultValue={filters.max_experience ?? ""} className={fieldClass} /></label></div>
        <label className="grid gap-1 text-xs font-semibold text-ink-muted">Current location<input name="location" defaultValue={filters.location ?? ""} placeholder="Mumbai" className={fieldClass} /></label>
        <label className="grid gap-1 text-xs font-semibold text-ink-muted">Preferred location<input name="preferred_location" defaultValue={filters.preferred_location ?? ""} placeholder="Pune" className={fieldClass} /></label>
        <label className="grid gap-1 text-xs font-semibold text-ink-muted">Notice period, up to (days)<input name="max_notice_days" type="number" min="0" max="3650" defaultValue={filters.max_notice_days ?? ""} placeholder="30" className={fieldClass} /></label>
        <label className="grid gap-1 text-xs font-semibold text-ink-muted">Skills (all, comma-separated)<input name="skills" defaultValue={filters.skills ?? ""} placeholder="Java, PostgreSQL" className={fieldClass} /></label>
        <label className="grid gap-1 text-xs font-semibold text-ink-muted">Education<input name="education" defaultValue={filters.education ?? ""} placeholder="Computer Science" className={fieldClass} /></label>
        <label className="grid gap-1 text-xs font-semibold text-ink-muted">Employment type<select name="employment_type" defaultValue={filters.employment_type ?? ""} className={fieldClass}><option value="">Any</option>{["Full time", "Part time", "Contract", "Internship", "Temporary"].map(value => <option key={value}>{value}</option>)}</select></label>
        <label className="grid gap-1 text-xs font-semibold text-ink-muted">Work mode<select name="work_mode" defaultValue={filters.work_mode ?? ""} className={fieldClass}><option value="">Any</option><option>Remote</option><option>Hybrid</option><option>On-site</option></select></label>
        <label className="grid gap-1 text-xs font-semibold text-ink-muted">Industry<TaxonomyInput name="industry" defaultValue={filters.industry ?? ""} placeholder="Healthcare, Manufacturing, BFSI…" className={fieldClass} entityTypes={["industry","sector"]} ariaLabel="Industry" /></label>
        <label className="grid gap-1 text-xs font-semibold text-ink-muted">Function / role family<TaxonomyInput name="functional_area" defaultValue={filters.functional_area ?? ""} placeholder="Sales, Nursing, Operations…" className={fieldClass} entityTypes={["functional_area","job_family","occupation"]} ariaLabel="Function or role family" /></label>
        <label className="grid gap-1 text-xs font-semibold text-ink-muted">Languages<TaxonomyInput name="languages" defaultValue={filters.languages ?? ""} placeholder="English, Marathi" className={fieldClass} entityTypes={["language"]} ariaLabel="Languages" /></label>
        <label className="grid gap-1 text-xs font-semibold text-ink-muted">Certification / licence<TaxonomyInput name="certifications" defaultValue={filters.certifications ?? ""} placeholder="BLS, CA, Forklift licence…" className={fieldClass} entityTypes={["certification","licence","qualification"]} ariaLabel="Certification or licence" /></label>
        <label className="grid gap-1 text-xs font-semibold text-ink-muted">Availability<input name="availability" defaultValue={filters.availability ?? ""} placeholder="Immediate, 30 days…" className={fieldClass} /></label>
        <fieldset className="grid gap-3 rounded-xl border border-indigo/15 bg-indigo-soft/20 p-3"><legend className="px-1 text-xs font-extrabold text-navy">Diversity sourcing</legend><p className="text-[11px] leading-4 text-ink-muted">Shown only for candidates who explicitly opted in to diversity search. These fields do not change match scoring.</p><label className="grid gap-1 text-xs font-semibold text-ink-muted">Gender<select name="gender" defaultValue={filters.gender ?? ""} className={fieldClass}><option value="">Any opted-in candidate</option><option value="woman">Women</option><option value="man">Men</option><option value="non-binary">Non-binary</option></select></label><label className="grid gap-1 text-xs font-semibold text-ink-muted">Disability<select name="disability" defaultValue={filters.disability ?? ""} className={fieldClass}><option value="">Any opted-in candidate</option><option value="person with disability">Persons with disabilities</option></select></label><label className="grid gap-1 text-xs font-semibold text-ink-muted">Defence background<select name="defence_background" defaultValue={filters.defence_background ?? ""} className={fieldClass}><option value="">Any opted-in candidate</option><option value="veteran">Veteran / ex-service</option><option value="defence spouse">Defence spouse</option><option value="returning service member">Returning service member</option></select></label></fieldset>
        <label className="grid gap-1 text-xs font-semibold text-ink-muted">Updated since<input name="updated_since" type="date" defaultValue={filters.updated_since ?? ""} className={fieldClass} /></label>
        <label className="grid gap-1 text-xs font-semibold text-ink-muted">Sort results<select name="sort" defaultValue={filters.sort ?? "recently_updated"} className={fieldClass}><option value="recently_updated">Recently updated</option><option value="most_experienced">Most experienced</option><option value="least_notice">Shortest notice</option></select></label>
        <button className="min-h-11 rounded-xl bg-indigo px-4 text-sm font-bold text-white hover:bg-navy focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo focus-visible:ring-offset-2">Search candidates</button>
        <Link href="/recruiter/discover" className="text-center text-xs font-bold text-indigo hover:underline">Clear all filters</Link><SaveDiscoverySearch filters={filters} />
      </form></div></aside>
      <section className="min-w-0" aria-label="Candidate search results">
        {error ? <p role="alert" className="rounded-xl border border-rose-200 bg-rose-50 p-4 text-sm font-semibold text-rose-800">{error}</p> : <>
          <div className="mb-3 flex flex-wrap items-center justify-between gap-2 text-sm text-ink-muted"><span><strong className="text-navy">{result?.total ?? 0}</strong> discoverable candidate{result?.total === 1 ? "" : "s"}</span><span>{filters.sort === "most_experienced" ? "Most experienced first" : filters.sort === "least_notice" ? "Shortest notice first" : "Most recently updated first"}</span></div>
          {result?.items.length ? <div className="grid gap-3">{result.items.map(candidate => <article key={candidate.id} className="rounded-2xl border border-[#e2eaf5] bg-white p-4 shadow-[0_8px_24px_rgba(24,51,96,0.06)] sm:p-5">
            <div className="flex flex-wrap items-start justify-between gap-3"><div className="min-w-0"><h2 className="text-base font-extrabold text-navy">{candidate.full_name}</h2><p className="mt-0.5 text-sm font-semibold text-indigo">{candidate.designation || candidate.headline || "Professional profile"}</p>{candidate.current_company && <p className="mt-1 text-xs text-ink-muted">Currently at {candidate.current_company}</p>}</div><span className="rounded-full bg-indigo-soft/50 px-3 py-1 text-xs font-bold text-indigo">{candidate.experience_months >= 12 ? `${Math.floor(candidate.experience_months / 12)}y ` : ""}{candidate.experience_months % 12 ? `${candidate.experience_months % 12}m` : ""} experience</span></div>
            <dl className="mt-4 grid gap-x-5 gap-y-2 border-t border-line/70 pt-3 text-xs sm:grid-cols-2 lg:grid-cols-3"><div><dt className="text-ink-muted">Current location</dt><dd className="font-semibold text-navy">{[candidate.current_city, candidate.current_state].filter(Boolean).join(", ") || "Not provided"}</dd></div><div><dt className="text-ink-muted">Preferred location</dt><dd className="font-semibold text-navy">{candidate.preferred_locations || "Not provided"}</dd></div><div><dt className="text-ink-muted">Notice period</dt><dd className="font-semibold text-navy">{candidate.notice_period_days == null ? "Not provided" : `${candidate.notice_period_days} days`}</dd></div>{candidate.education && <div className="sm:col-span-2 lg:col-span-3"><dt className="text-ink-muted">Education</dt><dd className="font-semibold text-navy">{candidate.education}</dd></div>}</dl>
            {candidate.skills?.length > 0 && <div className="mt-3 flex flex-wrap gap-1.5" aria-label="Skills">{candidate.skills.map(skill => <span key={skill} className="rounded-full bg-mint/40 px-2.5 py-1 text-xs font-semibold text-emerald-900">{skill}</span>)}</div>}
            <div className="mt-4 flex flex-wrap gap-2 border-t border-line/70 pt-3"><Link href={`/recruiter/candidates/${candidate.id}`} className="inline-flex min-h-10 items-center justify-center rounded-lg bg-indigo px-3 text-xs font-bold text-white hover:bg-navy">View profile</Link><Link href={`/recruiter/candidates/${candidate.id}?compose=1`} className="inline-flex min-h-10 items-center justify-center rounded-lg border border-indigo/25 px-3 text-xs font-bold text-indigo hover:bg-indigo-soft">Send InMail</Link><DiscoveryCandidateActions candidateID={candidate.id} /></div>
            <p className="mt-3 text-[11px] text-ink-muted">Profile updated {new Date(candidate.updated_at).toLocaleDateString("en-IN", { timeZone: "Asia/Kolkata" })}</p>
          </article>)}</div> : <div className="rounded-2xl border border-dashed border-line bg-white p-8 text-center"><h2 className="font-bold text-navy">No discoverable candidates found</h2><p className="mx-auto mt-2 max-w-lg text-sm leading-6 text-ink-muted">Try broadening the filters. Candidates appear here only after they explicitly opt in from their profile settings.</p></div>}
          {result && <nav aria-label="Discovery pagination" className="mt-4 flex items-center justify-between gap-3 text-sm"><Link aria-disabled={result.page <= 1} tabIndex={result.page <= 1 ? -1 : undefined} href={href(filters, Math.max(1, result.page - 1))} className={`rounded-lg border border-line bg-white px-3 py-2 font-bold ${result.page <= 1 ? "pointer-events-none opacity-40" : "text-indigo hover:bg-indigo-soft"}`}>← Previous</Link><span className="text-xs text-ink-muted">Page {result.page} of {pages}</span><Link aria-disabled={result.page >= pages} tabIndex={result.page >= pages ? -1 : undefined} href={href(filters, Math.min(pages, result.page + 1))} className={`rounded-lg border border-line bg-white px-3 py-2 font-bold ${result.page >= pages ? "pointer-events-none opacity-40" : "text-indigo hover:bg-indigo-soft"}`}>Next →</Link></nav>}
        </>}
      </section>
      <aside className="grid gap-4 xl:sticky xl:top-5"><section className="rounded-2xl border border-line/70 bg-white p-4 shadow-sm"><div className="flex items-center justify-between"><h2 className="text-sm font-extrabold text-navy">Saved searches</h2><span className="text-[10px] font-bold text-ink-muted">{savedSearches.length}</span></div><div className="mt-3 grid gap-2">{savedSearches.length?savedSearches.map(item=><Link key={item.id} href={searchHref(item.filters)} className="rounded-lg border border-line/60 p-2.5 hover:bg-indigo-soft/30"><span className="block text-xs font-bold text-navy">{item.name}</span><span className="mt-1 block truncate text-[10px] text-ink-muted">{item.filters.q || item.filters.designation || item.filters.industry || "Filtered search"}</span></Link>):<p className="text-xs leading-5 text-ink-muted">Save a useful search to reuse it here.</p>}</div></section><section className="rounded-2xl border border-line/70 bg-white p-4 shadow-sm"><h2 className="text-sm font-extrabold text-navy">Recent searches</h2><div className="mt-3 grid gap-2">{recentSearches.length?recentSearches.slice(0,5).map(item=><Link key={item.id} href={searchHref(item.filters)} className="rounded-lg px-2 py-2 text-xs font-semibold text-indigo hover:bg-indigo-soft/30">{item.filters.q || item.filters.designation || item.filters.industry || "Filtered candidate search"}</Link>):<p className="text-xs leading-5 text-ink-muted">Your recent sourcing searches will appear here.</p>}</div></section></aside>
    </div>
  </div></RecruiterShell>;
}
