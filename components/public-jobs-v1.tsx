"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { JobCard, JobSearch, PublicNavigation, type PublicJob } from "./public-site";

type PublicSearch = Record<string, string | string[] | undefined>;
type PublicPageMeta = { totalElements: number; totalPages: number; number: number };
const first = (value: string | string[] | undefined) => Array.isArray(value) ? value[0] : value;

const workplace = [["", "Any workplace"], ["REMOTE", "Remote"], ["HYBRID", "Hybrid"], ["ON_SITE", "On-site"]] as const;
const employment = [["", "Any employment type"], ["FULL_TIME", "Full-time"], ["PART_TIME", "Part-time"], ["CONTRACT", "Contract"], ["INTERNSHIP", "Internship"], ["TEMPORARY", "Temporary"]] as const;

function hrefWithout(search: PublicSearch | undefined, key: string) {
  const params = new URLSearchParams();
  Object.entries(search ?? {}).forEach(([name, raw]) => { const value = first(raw); if (value && name !== key && name !== "page") params.set(name, value); });
  return `/jobs${params.size ? `?${params}` : ""}`;
}
function pageHref(search: PublicSearch | undefined, page: number) {
  const params = new URLSearchParams();
  Object.entries(search ?? {}).forEach(([key, raw]) => { const value = first(raw); if (value && key !== "page") params.set(key, value); });
  if (page > 0) params.set("page", String(page));
  return `/jobs${params.size ? `?${params}` : ""}`;
}

function FilterForm({ search, onApplied }: { search?: PublicSearch; onApplied?: () => void }) {
  return <form action="/jobs" onSubmit={onApplied}>
    <input type="hidden" name="keywords" value={first(search?.keywords) ?? ""}/>
    <label><span>Workplace</span><select name="workplaceModel" defaultValue={first(search?.workplaceModel) ?? ""}>{workplace.map(([value,label]) => <option key={value} value={value}>{label}</option>)}</select></label>
    <label><span>Employment type</span><select name="employmentType" defaultValue={first(search?.employmentType) ?? ""}>{employment.map(([value,label]) => <option key={value} value={value}>{label}</option>)}</select></label>
    <label><span>Minimum experience</span><input type="number" min="0" max="50" name="minimumExperienceYears" defaultValue={first(search?.minimumExperienceYears) ?? ""} placeholder="Years"/></label>
    <label><span>Maximum experience</span><input type="number" min="0" max="50" name="maximumExperienceYears" defaultValue={first(search?.maximumExperienceYears) ?? ""} placeholder="Years"/></label>
    <label><span>Minimum salary</span><input type="number" min="0" name="minimumSalaryLakhs" defaultValue={first(search?.minimumSalaryLakhs) ?? ""} placeholder="LPA"/></label>
    <label><span>Maximum salary</span><input type="number" min="0" name="maximumSalaryLakhs" defaultValue={first(search?.maximumSalaryLakhs) ?? ""} placeholder="LPA"/></label>
    <div className="public-filter-actions"><Link className="button button-secondary" href="/jobs">Clear all</Link><button className="button button-primary" type="submit">Apply filters</button></div>
  </form>;
}

export function PublicJobsV1({ search, jobs, page }: { search?: PublicSearch; jobs: PublicJob[]; page?: PublicPageMeta }) {
  const [filtersOpen, setFiltersOpen] = useState(false);
  const keyword = first(search?.keywords);
  const total = page?.totalElements ?? jobs.length;
  const applied = useMemo(() => Object.entries(search ?? {}).filter(([key, raw]) => key !== "page" && Boolean(first(raw))).map(([key, raw]) => ({ key, value: first(raw)! })), [search]);
  return <main className="public-page public-list-page">
    <PublicNavigation/>
    <section className="public-page-heading"><div className="public-container"><span className="eyebrow">Job search</span><h1>{keyword ? `Roles matching “${keyword}”` : "Find a role that fits"}</h1><p>Search current published roles using criteria applied on the server.</p><JobSearch compact search={search}/></div></section>
    <section className="public-section public-jobs-layout">
      <aside className="public-filters"><strong>Refine your search</strong><FilterForm search={search}/></aside>
      <div className="public-job-results">
        <button className="public-filter-trigger" type="button" onClick={() => setFiltersOpen(true)} aria-haspopup="dialog">Filters{applied.length ? ` (${applied.length})` : ""}</button>
        {applied.length > 0 && <div className="public-applied-filters" aria-label="Applied filters">{applied.map(({key,value}) => <Link key={key} href={hrefWithout(search,key)}>{key.replace(/([A-Z])/g," $1").toLowerCase()}: {value} ×</Link>)}</div>}
        <div className="listing-summary"><strong>{total} published role{total === 1 ? "" : "s"}</strong><span>No profile-based match scores are shown on the public board.</span></div>
        {jobs.length ? <div className="public-job-grid-list">{jobs.map(job => <JobCard key={job.id} job={job}/>)}</div> : <div className="public-job-zero"><h2>No roles match these filters</h2><p>Remove one or more filters, or clear the search to see all current roles.</p><Link className="button button-primary" href="/jobs">Clear all filters</Link></div>}
        {page && page.totalPages > 1 && <nav className="public-pagination" aria-label="Job results pages"><Link className={page.number === 0 ? "disabled" : ""} aria-disabled={page.number === 0} href={pageHref(search, Math.max(0,page.number-1))}>← Previous</Link><span>Page {page.number+1} of {page.totalPages}</span><Link className={page.number+1 >= page.totalPages ? "disabled" : ""} aria-disabled={page.number+1 >= page.totalPages} href={pageHref(search,page.number+1)}>Next →</Link></nav>}
      </div>
    </section>
    {filtersOpen && <><button className="public-filter-backdrop" aria-label="Close filters" onClick={() => setFiltersOpen(false)}/><section className="public-filter-sheet" role="dialog" aria-modal="true" aria-labelledby="public-filter-title"><header><h2 id="public-filter-title">Refine your search</h2><button type="button" onClick={() => setFiltersOpen(false)} aria-label="Close filters">×</button></header><FilterForm search={search} onApplied={() => setFiltersOpen(false)}/></section></>}
  </main>;
}
