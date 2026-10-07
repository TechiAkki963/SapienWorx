import Link from "next/link";
import { JobShareMenu } from "./job-share-menu";
import { label, type EditableRecruiterJob } from "@/lib/recruiter";
import { recruiterSecondary } from "./workspace-ui";

export function JobContext({ job, active }: { job: EditableRecruiterJob; active: "Overview" | "Applications" | "Interviews" | "Offers" | "Activity" }) {
  const id = encodeURIComponent(job.id);
  const tabs = [["Overview", `/recruiter/jobs/${id}`], ["Applications", `/recruiter/jobs/${id}/applicants`], ["Interviews", `/recruiter/interviews?job_id=${id}`], ["Offers", `/recruiter/offers?job_id=${id}`], ["Activity", `/recruiter/jobs/${id}?tab=activity`]];
  return <section className="grid gap-3 border-b border-line pb-3">
    <Link href="/recruiter/jobs" className="w-fit text-xs font-semibold text-indigo">← All jobs</Link>
    <div className="flex flex-wrap items-start justify-between gap-3"><div className="min-w-0"><p className="text-xs font-semibold text-indigo">Job ID: {job.job_reference}</p><h1 className="mt-1 break-words text-2xl font-semibold tracking-tight text-navy">{job.title}</h1><p className="mt-2 text-sm text-ink-muted">{label(job.status)} · {job.location || "Location not specified"} · {label(job.work_mode)} · {label(job.visibility)}</p></div><div className="flex flex-wrap items-center gap-2"><Link className={recruiterSecondary} href={`/recruiter/jobs/${id}/edit`}>Edit job</Link>{job.visibility === "public" ? <JobShareMenu jobId={job.id} title={job.title} active={job.status === "active"}/> : <span className="text-xs text-ink-muted">Private role · sharing unavailable</span>}</div></div>
    <nav aria-label="Job workspace" className="flex flex-wrap gap-1">{tabs.map(([name, href]) => <Link key={name} aria-current={name === active ? "page" : undefined} className={`min-h-11 border-b-2 px-3 py-3 text-sm font-semibold ${name === active ? "border-indigo text-indigo" : "border-transparent text-ink-muted"}`} href={href}>{name}</Link>)}</nav>
  </section>;
}
