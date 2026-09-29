import Link from "next/link";

import { BulkJobToolbar } from "@/components/recruiter/bulk-job-toolbar";
import { JobShareMenu } from "@/components/recruiter/job-share-menu";
import { JobStatusControl } from "@/components/recruiter/job-status-control";
import { RecruiterShell } from "@/components/recruiter/recruiter-shell";
import { requireRole } from "@/lib/auth-server";
import { RecruiterJob, RecruiterJobWorkspace, RecruiterTeamMember, compactDate, label } from "@/lib/recruiter";
import { recruiterAPI } from "@/lib/recruiter-server";

export const dynamic = "force-dynamic";

type Props = { searchParams: Promise<Record<string, string | string[] | undefined>> };

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

const inputClass = "min-h-10 w-full rounded-xl border border-line bg-white px-3 text-sm font-medium text-ink outline-none focus:border-indigo/40 focus:ring-2 focus:ring-indigo/15";

function single(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] ?? "" : value ?? "";
}

function location(job: RecruiterJob) {
  return [job.city, job.state].filter(Boolean).join(", ") || job.country_code;
}

function JobActions({ job }: { job: RecruiterJob }) {
  const publiclyShareable = job.status === "active" && job.visibility === "public";
  return (
    <div className="flex flex-wrap items-center gap-2">
      <Link href={`/recruiter/jobs/${job.id}/applicants`} className="rounded-lg bg-indigo px-2.5 py-1.5 text-xs font-bold text-white hover:bg-navy">View applicants →</Link>
      <Link href={`/recruiter/jobs/${job.id}/edit`} className="rounded-lg border border-line bg-white px-2.5 py-1.5 text-xs font-bold text-ink hover:text-indigo">Edit</Link>
      <Link href={`/recruiter/jobs/${job.id}/analytics`} className="rounded-lg border border-line bg-white px-2.5 py-1.5 text-xs font-bold text-ink hover:text-indigo">Analytics</Link>
      {publiclyShareable ? (
        <Link href={`/jobs/${job.id}`} target="_blank" rel="noopener noreferrer" className="rounded-lg border border-line bg-white px-2.5 py-1.5 text-xs font-bold text-ink hover:text-indigo">Preview ↗</Link>
      ) : null}
      <JobShareMenu jobId={job.id} title={job.title} active={publiclyShareable} />
    </div>
  );
}

export default async function RecruiterJobsPage({ searchParams }: Props) {
  await requireRole("recruiter");
  const params = await searchParams;
  const q = single(params.q);
  const status = single(params.status);
  const employmentType = single(params.employment_type);
  const workMode = single(params.work_mode);
  const roleCategory = single(params.role_category);
  const deadline = single(params.deadline);
  const sort = single(params.sort) || "updated";
  const page = Math.max(1, Number(single(params.page)) || 1);

  const query = new URLSearchParams({ page: String(page), limit: "20", sort });
  if (q) query.set("q", q);
  if (status) query.set("status", status);
  if (employmentType) query.set("employment_type", employmentType);
  if (workMode) query.set("work_mode", workMode);
  if (roleCategory) query.set("role_category", roleCategory);
  if (deadline) query.set("deadline", deadline);

  const [result, teamResponse] = await Promise.all([
    recruiterAPI<RecruiterJobWorkspace>(`/api/v1/recruiter/jobs?${query.toString()}`),
    recruiterAPI<{ items: RecruiterTeamMember[] }>("/api/v1/recruiter/team"),
  ]);
  const team = teamResponse.items;
  const pageCount = Math.max(1, Math.ceil(result.total / result.limit));
  const hasFilters = Boolean(q || status || employmentType || workMode || roleCategory || deadline || sort !== "updated");
  const pageHref = (next: number) => {
    const nextQuery = new URLSearchParams(query);
    nextQuery.set("page", String(next));
    return `/recruiter/jobs?${nextQuery.toString()}`;
  };

  return (
    <RecruiterShell>
      <div className="grid gap-5">
        <section className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="text-[10px] font-extrabold uppercase tracking-[0.14em] text-indigo">Vacancy control</p>
            <h1 className="mt-1.5 text-2xl font-bold tracking-[-0.04em] text-navy sm:text-[2rem]">Job management</h1>
            <p className="mt-1 max-w-3xl text-sm text-ink-muted">A compact operating workspace for vacancies across every hiring domain.</p>
          </div>
          <Link href="/recruiter/jobs/new" className="rounded-xl bg-indigo px-4 py-2.5 text-sm font-bold text-white shadow-sm transition hover:bg-violet-ink">+ Post a job</Link>
        </section>

        <section className="grid grid-cols-2 gap-3 xl:grid-cols-4" aria-label="Job summary">
          <div className="rounded-2xl border border-line/70 bg-white p-4"><p className="text-[10px] font-extrabold uppercase tracking-[0.1em] text-ink-muted">Active roles</p><p className="mt-2 text-2xl font-black tracking-[-0.04em] text-navy">{result.summary.active_jobs}</p></div>
          <div className="rounded-2xl border border-line/70 bg-white p-4"><p className="text-[10px] font-extrabold uppercase tracking-[0.1em] text-ink-muted">Drafts</p><p className="mt-2 text-2xl font-black tracking-[-0.04em] text-navy">{result.summary.draft_jobs}</p></div>
          <div className="rounded-2xl border border-line/70 bg-white p-4"><p className="text-[10px] font-extrabold uppercase tracking-[0.1em] text-ink-muted">Total applications</p><p className="mt-2 text-2xl font-black tracking-[-0.04em] text-navy">{result.summary.applications}</p></div>
          <div className="rounded-2xl border border-mint/50 bg-mint/20 p-4"><p className="text-[10px] font-extrabold uppercase tracking-[0.1em] text-emerald-800">New applications</p><p className="mt-2 text-2xl font-black tracking-[-0.04em] text-emerald-900">{result.summary.new_applications}</p></div>
        </section>

        <section className="rounded-2xl border border-line/70 bg-white p-4 shadow-[0_4px_20px_rgba(16,33,63,0.035)]">
          <form aria-label="Job filters" action="/recruiter/jobs" className="grid min-w-0 gap-3 md:grid-cols-2 xl:grid-cols-4 2xl:grid-cols-[minmax(14rem,1.5fr)_repeat(5,minmax(9rem,1fr))_auto]">
            <label className="grid gap-1 text-xs font-bold text-ink-muted">
              Search
              <input name="q" defaultValue={q} className={inputClass} placeholder="Job ID, title, team or location" />
            </label>
            <label className="grid gap-1 text-xs font-bold text-ink-muted">
              Status
              <select name="status" defaultValue={status} className={inputClass}>
                <option value="">All statuses</option>
                <option value="active">Active</option>
                <option value="draft">Draft</option>
                <option value="paused">Paused</option>
                <option value="closed">Closed</option>
                <option value="expired">Expired</option>
                <option value="archived">Archived</option>
              </select>
            </label>
            <label className="grid gap-1 text-xs font-bold text-ink-muted">
              Role / function
              <select name="role_category" defaultValue={roleCategory} className={inputClass}>
                <option value="">All functions</option>
                {roleCategoryOptions.map((option) => <option key={option} value={option}>{option}</option>)}
              </select>
            </label>
            <label className="grid gap-1 text-xs font-bold text-ink-muted">
              Work mode
              <select name="work_mode" defaultValue={workMode} className={inputClass}>
                <option value="">All modes</option>
                <option value="onsite">On-site</option>
                <option value="hybrid">Hybrid</option>
                <option value="remote">Remote</option>
              </select>
            </label>
            <label className="grid gap-1 text-xs font-bold text-ink-muted">
              Employment
              <select name="employment_type" defaultValue={employmentType} className={inputClass}>
                <option value="">All types</option>
                <option value="full_time">Full time</option>
                <option value="part_time">Part time</option>
                <option value="contract">Contract</option>
                <option value="internship">Internship</option>
                <option value="temporary">Temporary</option>
              </select>
            </label>
            <label className="grid gap-1 text-xs font-bold text-ink-muted">
              Sort
              <select name="sort" defaultValue={sort} className={inputClass}>
                <option value="updated">Recently updated</option>
                <option value="applications">Most applications</option>
                <option value="newest">Newest jobs</option>
                <option value="deadline">Deadline</option>
              </select>
            </label>
            {deadline && <input type="hidden" name="deadline" value={deadline} />}
            <div className="flex items-end gap-2">
              <button type="submit" className="min-h-10 rounded-xl bg-indigo px-4 text-sm font-bold text-white hover:bg-navy">Apply</button>
              {hasFilters && <Link href="/recruiter/jobs" className="inline-flex min-h-10 items-center rounded-xl border border-line px-3 text-sm font-bold text-ink hover:text-indigo">Clear</Link>}
            </div>
          </form>
          {deadline === "soon" && <div className="mt-3 flex flex-wrap items-center justify-between gap-2 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-xs font-semibold text-amber-950"><span>Showing active jobs closing in the next 3 days.</span><Link href="/recruiter/jobs" className="text-indigo hover:underline">Show all jobs</Link></div>}
          {status === "active" && deadline !== "soon" && <div className="mt-3 flex flex-wrap items-center justify-between gap-2 rounded-xl border border-indigo/20 bg-indigo-soft/40 px-3 py-2 text-xs font-semibold text-navy"><span>Showing active jobs.</span><Link href="/recruiter/jobs" className="text-indigo hover:underline">Show all jobs</Link></div>}
        </section>

        {result.items.length > 0 && <BulkJobToolbar team={team} pageJobCount={result.items.length} />}

        <section aria-label="Jobs" className="min-w-0">
          <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
            <p className="text-sm font-semibold text-ink-muted">Showing {result.items.length ? (result.page - 1) * result.limit + 1 : 0}–{Math.min(result.page * result.limit, result.total)} of {result.total} matching jobs</p>
            <p className="text-xs font-bold uppercase tracking-[0.08em] text-ink-muted">{result.summary.total_jobs} total jobs</p>
          </div>

          {result.items.length ? (
            <>
              <div className="hidden min-w-0 max-w-full overflow-x-auto rounded-2xl border border-line/70 bg-white shadow-[0_4px_20px_rgba(16,33,63,0.035)] lg:block">
                <table className="w-full min-w-[1120px] border-collapse text-left text-sm">
                  <thead className="bg-slate-50/90 text-[10px] font-extrabold uppercase tracking-[0.08em] text-ink-muted">
                    <tr>
                      <th className="w-10 px-3 py-3"><span className="sr-only">Select</span></th>
                      <th className="px-4 py-3">Job</th>
                      <th className="px-3 py-3">Status</th>
                      <th className="px-3 py-3">Function / mode</th>
                      <th className="px-3 py-3 text-right">Applications</th>
                      <th className="px-3 py-3">Deadline</th>
                      <th className="px-3 py-3">Updated</th>
                      <th className="px-4 py-3">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-line/60">
                    {result.items.map((job) => (
                      <tr key={job.id} className="align-top hover:bg-slate-50/45">
                        <td className="px-3 py-3"><input type="checkbox" data-bulk-job-id={job.id} aria-label={`Select ${job.job_reference} ${job.title}`} className="h-4 w-4 rounded border-line accent-indigo" /></td>
                        <td className="px-4 py-3">
                          <p className="text-[10px] font-extrabold tracking-[0.06em] text-indigo">{job.job_reference}</p>
                          <p className="mt-0.5 max-w-[20rem] font-bold text-navy">{job.title}</p>
                          <p className="mt-1 text-xs text-ink-muted">{job.department ?? "No department"} · {location(job)} · {job.openings} {job.openings === 1 ? "opening" : "openings"}</p>
                        </td>
                        <td className="px-3 py-3"><JobStatusControl jobId={job.id} status={job.status} /></td>
                        <td className="px-3 py-3 text-xs">
                          <p className="font-bold text-ink">{job.role_category || "Other"}</p>
                          <p className="mt-1 text-ink-muted">{label(job.work_mode)} · {label(job.employment_type)}</p>
                        </td>
                        <td className="px-3 py-3 text-right">
                          <Link href={`/recruiter/jobs/${job.id}/applicants`} className="font-black text-navy hover:text-indigo">{job.applications}</Link>
                          <p className="mt-1 text-xs font-semibold text-emerald-700">{job.new_applications} new</p>
                        </td>
                        <td className="px-3 py-3 text-xs font-semibold text-ink">{compactDate(job.application_deadline)}</td>
                        <td className="px-3 py-3 text-xs font-semibold text-ink">{compactDate(job.updated_at)}</td>
                        <td className="px-4 py-3"><JobActions job={job} /></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <div className="grid gap-3 lg:hidden">
                {result.items.map((job) => (
                  <article key={job.id} className="rounded-2xl border border-line/70 bg-white p-4 shadow-[0_4px_20px_rgba(16,33,63,0.04)]">
                    <div className="mb-3 flex items-center gap-2 border-b border-line/60 pb-3"><input type="checkbox" data-bulk-job-id={job.id} aria-label={`Select ${job.job_reference} ${job.title}`} className="h-4 w-4 rounded border-line accent-indigo" /><span className="text-xs font-bold text-ink-muted">Select vacancy</span></div>
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div className="min-w-0 flex-1">
                        <p className="text-[10px] font-extrabold tracking-[0.06em] text-indigo">{job.job_reference}</p>
                        <h2 className="mt-1 break-words text-lg font-bold text-navy">{job.title}</h2>
                        <p className="mt-1 text-xs text-ink-muted">{job.role_category || job.department || "Other"} · {location(job)}</p>
                      </div>
                      <JobStatusControl jobId={job.id} status={job.status} />
                    </div>
                    <div className="mt-3 grid grid-cols-3 gap-2 rounded-xl bg-slate-50/80 p-3 text-xs">
                      <div><p className="text-ink-muted">Applications</p><p className="mt-1 text-lg font-extrabold text-navy">{job.applications}</p></div>
                      <div><p className="text-ink-muted">New</p><p className="mt-1 text-lg font-extrabold text-emerald-800">{job.new_applications}</p></div>
                      <div><p className="text-ink-muted">Openings</p><p className="mt-1 text-lg font-extrabold text-navy">{job.openings}</p></div>
                    </div>
                    <div className="mt-3 flex flex-wrap gap-2 text-xs font-semibold text-ink-muted">
                      <span>{label(job.work_mode)} · {label(job.employment_type)}</span>
                      <span>Deadline {compactDate(job.application_deadline)}</span>
                    </div>
                    <div className="mt-3 border-t border-line/60 pt-3"><JobActions job={job} /></div>
                  </article>
                ))}
              </div>

              {result.total > result.limit && (
                <nav aria-label="Job result pages" className="mt-5 flex items-center justify-between gap-3">
                  <Link href={pageHref(Math.max(1, page - 1))} aria-disabled={page <= 1} className={`rounded-xl border border-line bg-white px-3 py-2 text-sm font-bold text-ink ${page <= 1 ? "pointer-events-none opacity-50" : "hover:text-indigo"}`}>← Previous</Link>
                  <span className="text-sm font-semibold text-ink-muted">Page {page} of {pageCount}</span>
                  <Link href={pageHref(Math.min(pageCount, page + 1))} aria-disabled={page >= pageCount} className={`rounded-xl border border-line bg-white px-3 py-2 text-sm font-bold text-ink ${page >= pageCount ? "pointer-events-none opacity-50" : "hover:text-indigo"}`}>Next →</Link>
                </nav>
              )}
            </>
          ) : (
            <div className="rounded-2xl border border-dashed border-line bg-white p-12 text-center">
              <h2 className="font-bold text-ink">No jobs match these filters</h2>
              <p className="mt-1 text-sm text-ink-muted">Clear one or more filters, or create a new vacancy.</p>
              <Link href="/recruiter/jobs/new" className="mt-4 inline-flex rounded-xl bg-indigo px-4 py-2.5 text-sm font-bold text-white">Post a job</Link>
            </div>
          )}
        </section>
      </div>
    </RecruiterShell>
  );
}
