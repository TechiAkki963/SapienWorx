import Link from "next/link";
import { RecruiterShell } from "@/components/recruiter/recruiter-shell";
import { JobContext } from "@/components/recruiter/job-context";
import { WorkspaceState } from "@/components/recruiter/workspace-ui";
import { requireRole } from "@/lib/auth-server";
import { recruiterAPI } from "@/lib/recruiter-server";
import { ownedRecruiterJob } from "@/lib/recruiter-job-server";
import { label, type JobAnalytics, type JobAuditEvent, type RecruiterTeamMember } from "@/lib/recruiter";

export const dynamic = "force-dynamic";
export default async function JobWorkspacePage({ params, searchParams }: { params: Promise<{ jobID: string }>; searchParams: Promise<{ tab?: string }> }) {
  await requireRole("recruiter");
  const { jobID } = await params;
  const job = await ownedRecruiterJob(jobID);
  const activity = (await searchParams).tab === "activity";
  const [metrics, history, team] = await Promise.all([
    recruiterAPI<JobAnalytics>(`/api/v1/recruiter/jobs/${encodeURIComponent(jobID)}/analytics`),
    recruiterAPI<{ items: JobAuditEvent[] }>(`/api/v1/recruiter/jobs/${encodeURIComponent(jobID)}/history?limit=20`),
    recruiterAPI<{ items: RecruiterTeamMember[] }>("/api/v1/recruiter/team"),
  ]);
  const owner = team.items.find(member => member.user_id === job.assigned_recruiter_id);
  const events = <section aria-label="Job change history" className="rounded-xl border border-line bg-white p-5"><h2 className="text-lg font-semibold text-navy">Recent activity</h2><p className="mt-1 text-xs text-ink-muted">Latest 20 recorded job changes</p>{history.items.length ? <ol className="mt-4 divide-y divide-line">{history.items.map(event => <li key={event.id} className="py-3"><p className="text-sm font-semibold text-ink">{label(event.action)}</p><p className="mt-1 text-xs leading-6 text-ink-muted">{event.actor_name} · {new Intl.DateTimeFormat("en-IN", { dateStyle: "medium", timeStyle: "short", timeZone: "Asia/Kolkata" }).format(new Date(event.changed_at))} IST</p></li>)}</ol> : <WorkspaceState title="No recorded job changes" description="Published changes and lifecycle events will appear here."/>}</section>;
  return <RecruiterShell><div className="grid gap-5 pb-24"><JobContext job={job} active={activity ? "Activity" : "Overview"}/>{activity ? events : <>
    <section aria-label="Job hiring progress"><h2 className="text-lg font-semibold text-navy">Hiring progress</h2><p className="mt-1 text-xs leading-6 text-ink-muted">Applications that have reached each stage, including later stages. These totals describe progress, rather than the current stage distribution.</p><dl className="mt-3 grid grid-cols-2 divide-line rounded-xl border border-line bg-white sm:grid-cols-3 xl:grid-cols-6">{metrics.funnel.map(point => <div key={point.stage} className="p-4"><dt className="text-xs text-ink-muted">{point.stage}</dt><dd className="mt-1 text-2xl font-semibold text-navy">{point.count}</dd></div>)}</dl></section>
    <section className="rounded-xl border border-line bg-white p-5"><h2 className="text-lg font-semibold text-navy">Role details</h2><dl className="mt-4 grid gap-4 sm:grid-cols-2">{[["Department", job.department || "Not specified"], ["Employment",label(job.employment_type)],["Openings",String(job.openings)],["Assigned recruiter",owner?.full_name || (job.assigned_recruiter_id ? "Assigned team member" : "Default job owner")],["Application deadline",job.application_deadline || "Not specified"],["Visibility",label(job.visibility)]].map(([name,value]) => <div key={name}><dt className="text-xs text-ink-muted">{name}</dt><dd className="mt-1 text-sm text-ink">{value}</dd></div>)}</dl><h3 className="mt-5 text-sm font-semibold text-navy">Description</h3><p className="mt-2 whitespace-pre-line text-sm leading-7 text-ink-muted">{job.description}</p><h3 className="mt-5 text-sm font-semibold text-navy">Hiring workflow</h3><ol className="mt-2 list-inside list-decimal text-sm leading-7 text-ink-muted">{job.hiring_process.map((stage,index) => <li key={`${index}-${stage}`}>{stage}</li>)}</ol><Link href={`/recruiter/jobs/${encodeURIComponent(jobID)}/analytics`} className="mt-4 inline-flex min-h-11 items-center text-sm font-semibold text-indigo">View job analytics</Link></section>{events}
  </>}</div></RecruiterShell>;
}
