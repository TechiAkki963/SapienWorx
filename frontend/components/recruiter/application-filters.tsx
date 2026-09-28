import Link from "next/link";

import { label, RecruiterJob, stages } from "@/lib/recruiter";

export type ApplicationFilterValues = Record<string, string | string[] | undefined>;

export const applicationFilterNames = [
  "q", "exclude_q", "stage", "job_id", "attention", "current_company", "previous_company",
  "location", "designation", "education", "university", "min_experience_years",
  "max_experience_years", "max_notice_days", "applied_within_days", "active_within_days",
  "updated_within_days", "has_cv", "sort",
] as const;

export function single(values: ApplicationFilterValues, name: string): string {
  const value = values[name];
  return Array.isArray(value) ? value[0] ?? "" : value ?? "";
}

export function selectedStages(values: ApplicationFilterValues): string[] {
  const value = values.stage;
  return Array.isArray(value) ? value : value ? [value] : [];
}

const inputClass = "box-border min-h-10 w-full min-w-0 rounded-lg border border-line bg-white px-3 text-sm font-normal text-ink outline-none focus:border-indigo/40 focus:ring-2 focus:ring-indigo/15";
const labelClass = "grid min-w-0 gap-1.5 text-xs font-bold text-ink-muted";

export function ApplicationFilters({ values, jobs, clearHref, action = "/recruiter/pipeline", fixedJob }: { values: ApplicationFilterValues; jobs: RecruiterJob[]; clearHref: string; action?: string; fixedJob?: RecruiterJob }) {
  const chosenStages = selectedStages(values);
  const advancedActive = ["exclude_q", "designation", "previous_company", "university", "applied_within_days", "active_within_days", "updated_within_days", "has_cv"].some(name => Boolean(single(values, name)));
  return <form action={action} aria-label="Application filters" className="grid min-w-0 gap-4 rounded-2xl border border-line/70 bg-white p-4 shadow-sm">
    {single(values, "attention") === "stalled" && <input type="hidden" name="attention" value="stalled" />}
    <div><p className="text-xs font-extrabold uppercase tracking-[0.08em] text-navy">Refine applications</p><p className="mt-1 text-xs leading-5 text-ink-muted">Search only applicants to your organization’s jobs.</p></div>
    <label className={labelClass}>Keywords<input className={inputClass} name="q" defaultValue={single(values, "q")} placeholder="Name, role, skill or Job ID" /></label>
    {fixedJob ? <div className={labelClass}>Job<span className="rounded-lg border border-line bg-slate-50 px-3 py-2 text-sm font-semibold text-ink">{fixedJob.title}<span className="block text-xs text-indigo">{fixedJob.job_reference}</span></span></div> : <label className={labelClass}>Job<select className={inputClass} name="job_id" defaultValue={single(values, "job_id")}><option value="">All jobs</option>{jobs.map(job => <option key={job.id} value={job.id}>{job.title} · {job.job_reference}</option>)}</select></label>}
    <fieldset className="grid gap-2 border-t border-line/70 pt-3"><legend className="text-xs font-bold text-ink-muted">Application stage</legend><div className="grid max-h-44 gap-1 overflow-y-auto pr-1">{stages.map(stage => <label key={stage} className="flex min-h-8 items-center gap-2 text-xs font-medium text-ink"><input type="checkbox" name="stage" value={stage} defaultChecked={chosenStages.includes(stage)} className="h-4 w-4 accent-indigo" />{label(stage)}</label>)}</div></fieldset>
    <label className={labelClass}>Current company<input className={inputClass} name="current_company" defaultValue={single(values, "current_company")} placeholder="Employer name" /></label>
    <label className={labelClass}>Current or preferred location<input className={inputClass} name="location" defaultValue={single(values, "location")} placeholder="City or remote" /></label>
    <div className="grid min-w-0 grid-cols-2 gap-2"><label className={labelClass}>Experience from<input className={inputClass} name="min_experience_years" type="number" min="0" max="80" defaultValue={single(values, "min_experience_years")} placeholder="Years" /></label><label className={labelClass}>Experience to<input className={inputClass} name="max_experience_years" type="number" min="0" max="80" defaultValue={single(values, "max_experience_years")} placeholder="Years" /></label></div>
    <label className={labelClass}>Notice period<select className={inputClass} name="max_notice_days" defaultValue={single(values, "max_notice_days")}><option value="">Any notice</option><option value="0">Immediate</option><option value="15">Within 15 days</option><option value="30">Within 30 days</option><option value="60">Within 60 days</option><option value="90">Within 90 days</option></select></label>
    <label className={labelClass}>Education<input className={inputClass} name="education" defaultValue={single(values, "education")} placeholder="Degree or course" /></label>
    <details open={advancedActive} className="group rounded-xl border border-line/70 bg-canvas/40 p-3"><summary className="cursor-pointer text-xs font-bold text-indigo">Advanced filters</summary><div className="mt-3 grid gap-3">
      <label className={labelClass}>Exclude keywords<input className={inputClass} name="exclude_q" defaultValue={single(values, "exclude_q")} placeholder="Terms to exclude" /></label>
      <label className={labelClass}>Current designation<input className={inputClass} name="designation" defaultValue={single(values, "designation")} placeholder="Role title" /></label>
      <label className={labelClass}>Previous company<input className={inputClass} name="previous_company" defaultValue={single(values, "previous_company")} placeholder="Former employer" /></label>
      <label className={labelClass}>University<input className={inputClass} name="university" defaultValue={single(values, "university")} placeholder="Institution" /></label>
      <label className={labelClass}>Applied within<select className={inputClass} name="applied_within_days" defaultValue={single(values, "applied_within_days")}><option value="">Any time</option><option value="7">7 days</option><option value="30">30 days</option><option value="90">90 days</option></select></label>
      <label className={labelClass}>Last active within<select className={inputClass} name="active_within_days" defaultValue={single(values, "active_within_days")}><option value="">Any time</option><option value="7">7 days</option><option value="30">30 days</option><option value="90">90 days</option></select></label>
      <label className={labelClass}>Profile updated within<select className={inputClass} name="updated_within_days" defaultValue={single(values, "updated_within_days")}><option value="">Any time</option><option value="7">7 days</option><option value="30">30 days</option><option value="90">90 days</option></select></label>
      <label className="flex items-center gap-2 text-xs font-semibold text-ink-muted"><input type="checkbox" name="has_cv" value="true" defaultChecked={single(values, "has_cv") === "true"} className="h-4 w-4 accent-indigo" />Has CV</label>
    </div></details>
    <label className={labelClass}>Sort results<select className={inputClass} name="sort" defaultValue={single(values, "sort") || "recently_applied"}><option value="recently_applied">Recently applied</option><option value="oldest_applied">Oldest applied</option><option value="recently_updated">Profile updated</option><option value="last_active">Last active</option><option value="most_experienced">Most experienced</option></select></label>
    <div className="grid grid-cols-2 gap-2"><button type="submit" className="min-h-10 rounded-lg bg-indigo px-3 text-sm font-bold text-white hover:bg-navy">Apply filters</button><Link href={clearHref} className="inline-flex min-h-10 items-center justify-center rounded-lg border border-line bg-white px-3 text-sm font-bold text-indigo">Clear filters</Link></div>
  </form>;
}
