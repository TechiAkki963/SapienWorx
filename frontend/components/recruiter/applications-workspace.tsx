import { AutoFilterForm } from "./auto-filter-form";
import { FilterDrawer } from "./filter-drawer";
import Link from "next/link";
import { JobContext } from "./job-context";
import { ownedRecruiterJob } from "@/lib/recruiter-job-server";

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
  const limit = ["10","25","50"].includes(single(params,"limit")) ? single(params,"limit") : "25";
  query.set("limit", limit);
  const [pipeline, { items: jobs }] = await Promise.all([
    recruiterAPI<PipelineList>(`/api/v1/recruiter/pipeline?${query}`),
    recruiterAPI<{ items: RecruiterJob[] }>("/api/v1/recruiter/jobs"),
  ]);
  const ownedJob = fixedJobID ? await ownedRecruiterJob(fixedJobID) : null;
  const selectedJob = jobs.find(job => job.id === single(params, "job_id")) ?? ownedJob ?? undefined;
  const baseHref = fixedJobID ? `/recruiter/jobs/${encodeURIComponent(fixedJobID)}/applicants` : "/recruiter/pipeline";
  const hrefFor = (values: URLSearchParams) => values.size ? `${baseHref}?${values}` : baseHref;
  const clearQuery = new URLSearchParams();
  if (!fixedJobID && selectedJob) clearQuery.set("job_id", selectedJob.id);
  const clearHref = hrefFor(clearQuery);
  const pageCount = Math.max(1, Math.ceil(pipeline.total / pipeline.limit));
  const start = pipeline.total ? (pipeline.page - 1) * pipeline.limit + 1 : 0;
  const end = Math.min(pipeline.total, pipeline.page * pipeline.limit);
  const activeFilters = applicationFilterNames.filter(name => name !== "sort" && name !== "job_id" && name !== "attention" && (name === "stage" ? selectedStages(params).length > 0 : Boolean(single(params, name))));
  const pageHref = (page: number) => { const next = filterQuery(params, fixedJobID); next.set("limit",limit); next.set("page", String(page)); return hrefFor(next); };

  return <RecruiterShell><div className="grid min-w-0 gap-4">
    {single(params, "attention") === "stalled" && <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm font-semibold text-amber-950"><span>Showing applications with no stage movement for at least 7 days.</span><Link href={clearHref} className="text-indigo hover:underline">Show all applications</Link></div>}
    {ownedJob && <JobContext job={ownedJob} active="Applications"/>}
    {!ownedJob && <div>
      {fixedJobID && <Link href="/recruiter/jobs" className="text-xs font-bold text-indigo hover:underline">← Job management</Link>}
      <p className="mt-2 text-xs font-bold uppercase tracking-[0.12em] text-indigo">{fixedJobID ? "Job applications" : "Applicant management"}</p>
      <h1 className="mt-1 text-2xl font-bold tracking-[-0.035em] sm:text-3xl">{selectedJob ? fixedJobID ? selectedJob.title : `${selectedJob.title} applications` : "Applications"}</h1>
      {selectedJob && <p className="mt-1 text-sm font-bold text-indigo">Job ID: {selectedJob.job_reference}</p>}
      <p className="mt-1 text-sm text-ink-muted">Review applicants, manage stages and coordinate hiring from one place.</p>
    </div>}
    <div className="flex min-w-0 flex-wrap items-end gap-2"><AutoFilterForm action={baseHref} label="Quick application filters" className="flex min-w-0 flex-1 flex-wrap items-end gap-2">
      {applicationFilterNames.filter(name=>!["q","job_id","location","max_notice_days","sort"].includes(name)).flatMap(name=>{const value=params[name];return (Array.isArray(value)?value:value?[value]:[]).map((v,i)=><input type="hidden" key={`${name}-${i}`} name={name} value={v}/>);})}
      <label className="grid min-w-0 flex-[2_1_12rem] gap-1 text-xs font-semibold text-ink-muted">Search applications<input className="min-h-11 w-full rounded-lg border border-line bg-white px-3 text-sm" name="q" defaultValue={single(params,"q")} placeholder="Name, skill, title or Job ID"/></label>
      {!fixedJobID&&<label className="grid min-w-0 flex-[1_1_10rem] gap-1 text-xs font-semibold text-ink-muted">Job<select className="min-h-11 w-full rounded-lg border border-line bg-white px-2 text-sm" name="job_id" defaultValue={single(params,"job_id")}><option value="">All jobs</option>{jobs.map(job=><option key={job.id} value={job.id}>{job.title}</option>)}</select></label>}
      <label className="grid min-w-0 flex-[1_1_8rem] gap-1 text-xs font-semibold text-ink-muted">Location<input name="location" defaultValue={single(params,"location")} className="min-h-11 w-full rounded-lg border border-line bg-white px-3 text-sm" placeholder="Any location"/></label>
      <label className="grid gap-1 text-xs font-semibold text-ink-muted">Notice<select name="max_notice_days" defaultValue={single(params,"max_notice_days")} className="min-h-11 rounded-lg border border-line bg-white px-2 text-sm"><option value="">Any notice</option><option value="0">Immediate</option><option value="15">15 days</option><option value="30">30 days</option><option value="60">60 days</option><option value="90">90 days</option></select></label>
      <label className="grid gap-1 text-xs font-semibold text-ink-muted">Sort<select name="sort" defaultValue={single(params,"sort")||"recently_applied"} className="min-h-11 rounded-lg border border-line bg-white px-2 text-sm"><option value="recently_applied">Newest applied</option><option value="recently_moved">Stage updated</option><option value="oldest_pending">Oldest pending</option><option value="oldest_applied">Oldest applied</option><option value="recently_updated">Profile updated</option><option value="most_experienced">Experience</option><option value="last_active">Last active</option></select></label>
    </AutoFilterForm>      <FilterDrawer count={activeFilters.length}><ApplicationFilters values={params} jobs={jobs} clearHref={clearHref} action={baseHref} fixedJob={fixedJobID?selectedJob:undefined}/></FilterDrawer>
</div>
    <nav aria-label="Application stages" className="flex min-w-0 gap-1 overflow-x-auto border-b border-line">{[["","All"],["new_application","New"],["screening","Screening"],["shortlisted","Shortlisted"],["interview","Interview"],["offer","Offer"],["hired","Hired"],["rejected","Rejected"],["withdrawn","Withdrawn"]].map(([stage,title])=>{const next=filterQuery(params,fixedJobID);next.delete("stage");next.delete("page");const actualStages=stage==="interview"?["technical_interview","hr_round","final_interview"]:stage?[stage]:[];actualStages.forEach(v=>next.append("stage",v));const count=stage==="interview"?actualStages.reduce((sum,v)=>sum+(pipeline.stage_counts?.[v]??0),0):stage?pipeline.stage_counts?.[stage]:Object.values(pipeline.stage_counts??{}).reduce((sum,n)=>sum+n,0);return <Link key={title} href={hrefFor(next)} aria-current={selectedStages(params).join(",")===actualStages.join(",")?"page":undefined} className={`inline-flex min-h-11 shrink-0 items-center gap-2 border-b-2 px-3 text-sm font-semibold ${selectedStages(params).join(",")===actualStages.join(",")?"border-indigo text-indigo":"border-transparent text-ink-muted"}`}>{title}{count!==undefined&&<span className="text-xs">{count.toLocaleString()}</span>}</Link>})}</nav>
    <div>
      <section className="min-w-0">
        {activeFilters.length > 0 && <div aria-label="Active filters" className="mb-3 flex flex-wrap items-center gap-2">{activeFilters.map(name => { const remaining = filterQuery(params, fixedJobID); remaining.delete(name); return <Link key={name} href={hrefFor(remaining)} aria-label={`Remove ${filterTitle(name)} filter`} className="rounded-full border border-indigo/20 bg-indigo-soft/45 px-3 py-1.5 text-xs font-semibold text-indigo">{filterTitle(name)}: {filterValue(name, params)} ×</Link>; })}<Link href={clearHref} className="px-2 text-xs font-bold text-indigo hover:underline">Clear all</Link></div>}
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2 text-xs text-ink-muted"><span>Showing {start}–{end} of {pipeline.total} matching applications</span><span>{pipeline.limit} per page</span></div>
        <ApplicantCardWorkspace rows={pipeline.items} now={new Date().toISOString()} jobScoped={!!fixedJobID} />
        <nav aria-label="Applications pagination" className="mt-4 flex items-center justify-between gap-3"><Link aria-disabled={pipeline.page <= 1} tabIndex={pipeline.page <= 1 ? -1 : undefined} href={pageHref(Math.max(1, pipeline.page - 1))} className={`rounded-lg border border-line bg-white px-3 py-2 text-sm font-bold ${pipeline.page <= 1 ? "pointer-events-none opacity-45" : "text-ink hover:border-indigo/30"}`}>← Previous</Link><div className="flex flex-wrap items-center justify-center gap-3"><span className="text-xs font-semibold text-ink-muted">Showing {start}–{end} of {pipeline.total.toLocaleString()}</span><AutoFilterForm label="Application page size" action={baseHref} className="flex items-center gap-2">{[...filterQuery(params,fixedJobID)].map(([key,value],i)=><input type="hidden" name={key} value={value} key={`${key}-${i}`}/>)}<label className="text-xs text-ink-muted">Rows <select className="min-h-11 rounded-lg border border-line bg-white px-2" name="limit" defaultValue={limit}><option>10</option><option>25</option><option>50</option></select></label></AutoFilterForm><span className="text-xs text-ink-muted">Page {pipeline.page} of {pageCount}</span></div><Link aria-disabled={pipeline.page >= pageCount} tabIndex={pipeline.page >= pageCount ? -1 : undefined} href={pageHref(Math.min(pageCount, pipeline.page + 1))} className={`rounded-lg border border-line bg-white px-3 py-2 text-sm font-bold ${pipeline.page >= pageCount ? "pointer-events-none opacity-45" : "text-ink hover:border-indigo/30"}`}>Next →</Link></nav>
      </section>
    </div>
  </div></RecruiterShell>;
}
