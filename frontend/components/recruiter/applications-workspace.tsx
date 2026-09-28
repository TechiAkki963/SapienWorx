import Link from "next/link";
import { notFound } from "next/navigation";

import { ApplicationFilters, applicationFilterNames, ApplicationFilterValues, selectedStages, single } from "@/components/recruiter/application-filters";
import { ApplicantCardWorkspace } from "@/components/recruiter/applicant-card-workspace";
import { RecruiterShell } from "@/components/recruiter/recruiter-shell";
import { requireRole } from "@/lib/auth-server";
import { label, PipelineList, RecruiterJob } from "@/lib/recruiter";
import { recruiterAPI } from "@/lib/recruiter-server";

function filterQuery(params: ApplicationFilterValues, fixedJobID?: string) {
  const query = new URLSearchParams();
  for (const name of applicationFilterNames) {
    if (fixedJobID && name === "job_id") continue;
    const value = params[name];
    for (const item of Array.isArray(value) ? value : value ? [value] : []) {
      if (item) query.append(name, item);
    }
  }
  return query;
}

function filterTitle(name: string) {
  const titles: Record<string, string> = {
    q: "Keywords", exclude_q: "Exclude", stage: "Stage", current_company: "Company",
    previous_company: "Previous company", min_experience_years: "Experience from",
    max_experience_years: "Experience to", max_notice_days: "Notice period",
    applied_within_days: "Applied within", active_within_days: "Last active within",
    updated_within_days: "Updated within", has_cv: "Has CV",
  };
  return titles[name] ?? label(name);
}

function filterValue(name: string, params: ApplicationFilterValues) {
  if (name === "stage") return selectedStages(params).map(label).join(", ");
  if (name === "has_cv") return "Yes";
  if (name === "max_notice_days" && single(params, name) === "0") return "Immediate";
  if (name.endsWith("_within_days")) return `${single(params, name)} days`;
  if (name.endsWith("_experience_years")) return `${single(params, name)} years`;
  return single(params, name);
}

export async function ApplicationsWorkspace({ searchParams, fixedJobID }: { searchParams: ApplicationFilterValues; fixedJobID?: string }) {
  await requireRole("recruiter");
  const params = fixedJobID ? { ...searchParams, job_id: fixedJobID } : searchParams;
  const requestedPage = Math.max(1, Number.parseInt(single(params, "page") || "1", 10) || 1);
  const query = filterQuery(params, fixedJobID);
  if (fixedJobID) query.set("job_id", fixedJobID);
  query.set("page", String(requestedPage));
  query.set("limit", "10");
  const [pipeline, { items: jobs }] = await Promise.all([
    recruiterAPI<PipelineList>(`/api/v1/recruiter/pipeline?${query}`),
    recruiterAPI<{ items: RecruiterJob[] }>("/api/v1/recruiter/jobs"),
  ]);
  const selectedJob = jobs.find(job => job.id === single(params, "job_id"));
  if (fixedJobID && !selectedJob) notFound();
  const baseHref = fixedJobID ? `/recruiter/jobs/${encodeURIComponent(fixedJobID)}/applicants` : "/recruiter/pipeline";
  const hrefFor = (values: URLSearchParams) => values.size ? `${baseHref}?${values}` : baseHref;
  const clearQuery = new URLSearchParams();
  if (!fixedJobID && selectedJob) clearQuery.set("job_id", selectedJob.id);
  const clearHref = hrefFor(clearQuery);
  const pageCount = Math.max(1, Math.ceil(pipeline.total / pipeline.limit));
  const start = pipeline.total ? (pipeline.page - 1) * pipeline.limit + 1 : 0;
  const end = Math.min(pipeline.total, pipeline.page * pipeline.limit);
  const activeFilters = applicationFilterNames.filter(name => name !== "sort" && name !== "job_id" && name !== "attention" && (name === "stage" ? selectedStages(params).length > 0 : Boolean(single(params, name))));
  const pageHref = (page: number) => { const next = filterQuery(params, fixedJobID); next.set("page", String(page)); return hrefFor(next); };

  return <RecruiterShell><div className="grid min-w-0 gap-4">
    {single(params, "attention") === "stalled" && <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm font-semibold text-amber-950"><span>Showing applications with no stage movement for at least 7 days.</span><Link href={clearHref} className="text-indigo hover:underline">Show all applications</Link></div>}
    <div>
      {fixedJobID && <Link href="/recruiter/jobs" className="text-xs font-bold text-indigo hover:underline">← Job management</Link>}
      <p className="mt-2 text-xs font-bold uppercase tracking-[0.12em] text-indigo">{fixedJobID ? "Job applications" : "Applicant management"}</p>
      <h1 className="mt-1 text-2xl font-bold tracking-[-0.035em] sm:text-3xl">{selectedJob ? fixedJobID ? selectedJob.title : `${selectedJob.title} applications` : "Applications"}</h1>
      {selectedJob && <p className="mt-1 text-sm font-bold text-indigo">Job ID: {selectedJob.job_reference}</p>}
      <p className="mt-1 text-sm text-ink-muted">Review applicants, manage stages and coordinate hiring from one place.</p>
    </div>
    <div className="grid min-w-0 gap-4 xl:grid-cols-[15.5rem_minmax(0,1fr)]">
      <div className="xl:hidden"><details className="rounded-xl border border-line bg-white"><summary className="cursor-pointer px-4 py-3 text-sm font-bold text-indigo">Filters{activeFilters.length ? ` (${activeFilters.length})` : ""}</summary><div className="border-t border-line p-2"><ApplicationFilters values={params} jobs={jobs} clearHref={clearHref} action={baseHref} fixedJob={fixedJobID ? selectedJob : undefined} /></div></details></div>
      <aside className="hidden xl:sticky xl:top-6 xl:block xl:max-h-[calc(100vh-3rem)] xl:self-start xl:overflow-y-auto xl:overscroll-contain"><ApplicationFilters values={params} jobs={jobs} clearHref={clearHref} action={baseHref} fixedJob={fixedJobID ? selectedJob : undefined} /></aside>
      <section className="min-w-0">
        {activeFilters.length > 0 && <div aria-label="Active filters" className="mb-3 flex flex-wrap items-center gap-2">{activeFilters.map(name => { const remaining = filterQuery(params, fixedJobID); remaining.delete(name); return <Link key={name} href={hrefFor(remaining)} aria-label={`Remove ${filterTitle(name)} filter`} className="rounded-full border border-indigo/20 bg-indigo-soft/45 px-3 py-1.5 text-xs font-semibold text-indigo">{filterTitle(name)}: {filterValue(name, params)} ×</Link>; })}<Link href={clearHref} className="px-2 text-xs font-bold text-indigo hover:underline">Clear all</Link></div>}
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2 text-xs text-ink-muted"><span>Showing {start}–{end} of {pipeline.total} matching applications</span><span>{pipeline.limit} per page</span></div>
        <ApplicantCardWorkspace rows={pipeline.items} now={new Date().toISOString()} />
        <nav aria-label="Applications pagination" className="mt-4 flex items-center justify-between gap-3"><Link aria-disabled={pipeline.page <= 1} tabIndex={pipeline.page <= 1 ? -1 : undefined} href={pageHref(Math.max(1, pipeline.page - 1))} className={`rounded-lg border border-line bg-white px-3 py-2 text-sm font-bold ${pipeline.page <= 1 ? "pointer-events-none opacity-45" : "text-ink hover:border-indigo/30"}`}>← Previous</Link><span className="text-xs font-semibold text-ink-muted">Page {pipeline.page} of {pageCount}</span><Link aria-disabled={pipeline.page >= pageCount} tabIndex={pipeline.page >= pageCount ? -1 : undefined} href={pageHref(Math.min(pageCount, pipeline.page + 1))} className={`rounded-lg border border-line bg-white px-3 py-2 text-sm font-bold ${pipeline.page >= pageCount ? "pointer-events-none opacity-45" : "text-ink hover:border-indigo/30"}`}>Next →</Link></nav>
      </section>
    </div>
  </div></RecruiterShell>;
}
