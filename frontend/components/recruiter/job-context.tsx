import Link from "next/link";
import { RecruiterProductHeader } from "./recruiter-product-header";
import { JobShareMenu } from "./job-share-menu";
import { label, type EditableRecruiterJob } from "@/lib/recruiter";
import { recruiterSecondary } from "./workspace-ui";

export function JobContext({ job, active }: { job: EditableRecruiterJob; active: "Overview" | "Applications" | "Interviews" | "Offers" | "Activity" }) {
  const id = encodeURIComponent(job.id);
  const tabs = [["Overview", `/recruiter/jobs/${id}`], ["Applications", `/recruiter/jobs/${id}/applicants`], ["Interviews", `/recruiter/interviews?job_id=${id}`], ["Offers", `/recruiter/offers?job_id=${id}`], ["Activity", `/recruiter/jobs/${id}?tab=activity`]];
  return <section className="grid gap-3 border-b border-line pb-3">
    <Link href="/recruiter/jobs" className="w-fit text-xs font-semibold text-indigo">← All jobs</Link>
    <RecruiterProductHeader eyebrow={`Job ID: ${job.job_reference}`} title={job.title} description={`${label(job.status)} · ${job.location || "Location not specified"} · ${label(job.work_mode)} · ${label(job.visibility)}`} actions={<><Link className={recruiterSecondary} href={`/recruiter/jobs/${id}/edit`}>Edit job</Link>{job.visibility === "public" ? <JobShareMenu jobId={job.id} title={job.title} active={job.status === "active"}/> : <span className="swx-type-caption text-ink-muted">Private role · sharing unavailable</span>}</>} />
    <nav aria-label="Job workspace" className="flex flex-wrap gap-1">{tabs.map(([name, href]) => <Link key={name} aria-current={name === active ? "page" : undefined} className={`min-h-11 border-b-2 px-3 py-3 text-sm font-semibold ${name === active ? "border-indigo text-indigo" : "border-transparent text-ink-muted"}`} href={href}>{name}</Link>)}</nav>
  </section>;
}
