import {JobActions} from "@/components/recruiter/job-actions";
import { AutoFilterForm } from "@/components/recruiter/auto-filter-form";
import { JobSelectAll } from "@/components/recruiter/job-select-all";
import Link from "next/link";

import { BulkJobToolbar } from "@/components/recruiter/bulk-job-toolbar";
import { JobStatusControl } from "@/components/recruiter/job-status-control";
import { RecruiterProductHeader } from "@/components/recruiter/recruiter-product-header";
import { RecruiterShell } from "@/components/recruiter/recruiter-shell";
import { requireRole } from "@/lib/auth-server";
import { RecruiterJob, RecruiterJobWorkspace, RecruiterTeamMember, label } from "@/lib/recruiter";
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

const inputClass = "min-h-11 w-full rounded-xl border border-line bg-white px-3 text-sm font-medium text-ink outline-none focus:border-indigo/40 focus:ring-2 focus:ring-indigo/15";

function single(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] ?? "" : value ?? "";
}

function location(job: RecruiterJob) {
  return job.city || job.state || job.country_code;
}

const jobTimeZone = "Asia/Kolkata";
const calendarParts = new Intl.DateTimeFormat("en-GB", { day: "2-digit", month: "2-digit", year: "numeric", timeZone: jobTimeZone });

function calendarDay(date: Date) {
  const parts = calendarParts.formatToParts(date);
  const part = (type: string) => Number(parts.find(item => item.type === type)?.value);
  return Date.UTC(part("year"), part("month") - 1, part("day"));
}

function dateOffset(value: string | undefined, now: Date) {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : (calendarDay(date) - calendarDay(now)) / 86400000;
}

function JobDate({ value, kind, now }: { value?: string; kind: "posted" | "deadline"; now: Date }) {
  const days = dateOffset(value, now);
  if (days === null || !value) return <span className="text-xs text-ink-muted">{kind === "posted" ? "Not posted" : "No deadline"}</span>;
  const date = new Date(value);
  const sameYear = calendarParts.formatToParts(date).find(part => part.type === "year")?.value === calendarParts.formatToParts(now).find(part => part.type === "year")?.value;
  const dateLabel = new Intl.DateTimeFormat("en-GB", { day: "2-digit", month: "short", ...(sameYear ? {} : { year: "numeric" as const }), timeZone: jobTimeZone }).format(date);
  const fullDate = new Intl.DateTimeFormat("en-GB", { dateStyle: "long", timeZone: jobTimeZone }).format(date);
  const count = Math.abs(days);
  const duration = `${count} ${count === 1 ? "day" : "days"}`;
  const hint = kind === "posted"
    ? days === 0 ? "Posted today" : days < 0 ? `${duration} ago` : `In ${duration}`
    : days === 0 ? "Closes today" : days > 0 ? `${duration} left` : `${duration} overdue`;
  return <div className="text-xs"><time dateTime={value} title={`${fullDate} (IST)`} aria-label={`${kind === "posted" ? "Posted" : "Deadline"} ${fullDate}`} className="whitespace-nowrap font-semibold text-ink">{dateLabel}</time><p className="mt-1 whitespace-nowrap text-ink-muted">{hint}</p></div>;
}

function JobHealth({ job, now }: { job: RecruiterJob; now: Date }) {
  const days = dateOffset(job.application_deadline, now);
  let title = "Healthy", reason = "Active job with no pending application queue or expired deadline.";
  if (job.status !== "active") { title = "Inactive"; reason = "Health actions apply to active roles."; }
  else if (days !== null && days < 0) { title = "Deadline passed"; reason = "The application deadline has passed. Review or close this role."; }
  else if (days !== null && days <= 3) { title="Closing soon"; reason="The deadline is within three days."; }
  else if (job.new_applications > 0) { title = "Needs attention"; reason = `${job.new_applications} new applications are awaiting a recruiter review.`; }
  else if (job.applications === 0) { title = "No applications"; reason = "No applications have been received. Review the role requirements and visibility."; }
  return <details><summary className="min-h-11 cursor-pointer content-center text-xs font-semibold text-ink">{title}</summary><p className="mt-1 text-xs leading-5 text-ink-muted">{reason}</p></details>;
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
  const now = new Date();
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
        <RecruiterProductHeader
          eyebrow="Vacancy control"
          title="Job management"
          description="Manage vacancies, applicants and hiring activity."
          actions={<Link href="/recruiter/jobs/new" className="rounded-xl bg-indigo px-4 py-2.5 text-sm font-bold text-white shadow-sm transition hover:bg-violet-ink">+ Post a job</Link>}
        />

        <nav aria-label="Job status views" className="flex flex-wrap gap-1 border-b border-line">{["", "active", "draft", "paused", "closed", "expired", "archived"].map(value=>{const next=new URLSearchParams(query);next.delete("page");if(value)next.set("status",value);else next.delete("status");return <Link key={value} href={`/recruiter/jobs?${next}`} aria-current={status===value?"page":undefined} className={`min-h-11 border-b-2 px-3 py-3 text-sm font-semibold ${status===value?"border-indigo text-indigo":"border-transparent text-ink-muted"}`}>{value?label(value):"All jobs"} <span className="ml-1 text-xs">{(value ? result.summary[`${value}_jobs` as keyof typeof result.summary] : result.summary.total_jobs)?.toLocaleString()}</span></Link>;})}</nav>

        <section>
          <AutoFilterForm label="Job filters" action="/recruiter/jobs" className="grid min-w-0 gap-2 grid-cols-2 lg:grid-cols-3 xl:grid-cols-[minmax(12rem,2fr)_repeat(5,minmax(0,1fr))]">
            <label className="grid gap-1 text-xs font-bold text-ink-muted">
              Search
              <input name="q" defaultValue={q} className={inputClass} placeholder="Job ID, title, team or location" />
            </label>
            <label className="grid gap-1 text-xs font-bold text-ink-muted">
              Status
              <select aria-label="Status" name="status" defaultValue={status} className={inputClass}>
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
              <select aria-label="Role / function" name="role_category" defaultValue={roleCategory} className={inputClass}>
                <option value="">All functions</option>
                {roleCategoryOptions.map((option) => <option key={option} value={option}>{option}</option>)}
              </select>
            </label>
            <label className="grid gap-1 text-xs font-bold text-ink-muted">
              Work mode
              <select aria-label="Work mode" name="work_mode" defaultValue={workMode} className={inputClass}>
                <option value="">All modes</option>
                <option value="onsite">On-site</option>
                <option value="hybrid">Hybrid</option>
                <option value="remote">Remote</option>
              </select>
            </label>
            <label className="grid gap-1 text-xs font-bold text-ink-muted">
              Employment
              <select aria-label="Employment" name="employment_type" defaultValue={employmentType} className={inputClass}>
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
              <select aria-label="Sort" name="sort" defaultValue={sort} className={inputClass}>
                <option value="updated">Recently updated</option>
                <option value="applications">Most applications</option>
                <option value="newest">Newest jobs</option>
                <option value="deadline">Deadline</option>
              </select>
            </label>
            {deadline && <input type="hidden" name="deadline" value={deadline} />}
            <div className="flex items-end gap-2">

              {hasFilters && <Link href="/recruiter/jobs" className="inline-flex min-h-11 items-center rounded-xl border border-line px-3 text-sm font-bold text-ink hover:text-indigo">Clear</Link>}
            </div>
          </AutoFilterForm>
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
                <table className="w-full table-fixed border-collapse text-left text-sm">
                  <thead className="bg-slate-50/90 text-[13px] font-extrabold uppercase tracking-[0.08em] text-ink-muted">
                    <tr>
                      <th scope="col" className="w-10 px-3 py-3"><JobSelectAll/></th>
                      <th scope="col" className="px-4 py-3">Job</th>
                      <th scope="col" className="w-36 px-3 py-3">Status</th>
                      <th scope="col" className="w-[14%] px-3 py-3 text-right">Applications</th>
                      <th scope="col" className="w-28 px-3 py-3">Posted</th>
                      <th scope="col" className="w-28 px-3 py-3">Deadline</th>
                      <th scope="col" className="w-32 px-3 py-3">Health</th>
                      <th scope="col" className="w-16 px-3 py-3"><span className="sr-only">Actions</span></th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-line/60">
                    {result.items.map((job) => (
                      <tr key={job.id} className="align-top hover:bg-slate-50/45">
                        <td className="px-3 py-3"><input type="checkbox" data-bulk-job-id={job.id} aria-label={`Select ${job.job_reference} ${job.title}`} className="h-4 w-4 rounded border-line accent-indigo" /></td>
                        <td className="px-4 py-3">

                          <p className="mt-0.5 break-words font-bold text-navy"><Link href={`/recruiter/jobs/${job.id}`} className="hover:text-indigo">{job.title}</Link></p>
                          <p className="mt-1 text-xs leading-5 text-ink-muted">{location(job)} · {job.department || job.role_category || "Other"} · {job.openings} {job.openings === 1 ? "opening" : "openings"}</p>
                        </td>
                        <td className="px-3 py-3"><JobStatusControl jobId={job.id} status={job.status} /></td>
                        <td className="px-3 py-3 text-right">
                          <Link href={`/recruiter/jobs/${job.id}/applicants`} aria-label={`View ${job.applications.toLocaleString()} applications for ${job.title}`} className="font-bold text-navy hover:text-indigo">{job.applications.toLocaleString()}</Link>
                          <Link href={`/recruiter/jobs/${job.id}/applicants?stage=new_application`} className="mt-1 block text-xs font-semibold leading-5 text-indigo">+{job.new_applications.toLocaleString()} new</Link>
                        </td>
                        <td className="px-3 py-3"><JobDate value={job.published_at} kind="posted" now={now} /></td>
                        <td className="px-3 py-3"><JobDate value={job.application_deadline} kind="deadline" now={now} /></td>
                        <td className="px-3 py-3"><JobHealth job={job} now={now} /></td>
                        <td className="px-3 py-3"><JobActions job={job} team={team} compact /></td>
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

                        <h2 className="mt-1 break-words text-lg font-bold text-navy"><Link href={`/recruiter/jobs/${job.id}`} className="hover:text-indigo">{job.title}</Link></h2>
                        <p className="mt-1 text-xs leading-5 text-ink-muted">{location(job)} · {job.department || job.role_category || "Other"} · {job.openings} {job.openings === 1 ? "opening" : "openings"}</p>
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
                    </div>
                    <dl className="mt-3 grid grid-cols-2 gap-3 border-t border-line/60 pt-3"><div><dt className="mb-1 text-xs text-ink-muted">Posted</dt><dd><JobDate value={job.published_at} kind="posted" now={now} /></dd></div><div><dt className="mb-1 text-xs text-ink-muted">Deadline</dt><dd><JobDate value={job.application_deadline} kind="deadline" now={now} /></dd></div></dl>
                    <div className="mt-3"><JobHealth job={job} now={now} /></div><div className="mt-3 border-t border-line/60 pt-3"><JobActions job={job} team={team} /></div>
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
