import Link from "next/link";

import { InterviewCandidateCard } from "@/components/recruiter/applicant-card-workspace";
import { InterviewCalendar } from "@/components/recruiter/interview-calendar";
import { RecruiterShell } from "@/components/recruiter/recruiter-shell";
import { ScheduleInterviewForm } from "@/components/recruiter/schedule-interview-form";
import { InterviewActions } from "@/components/recruiter/interview-actions";
import { StatusPill } from "@/components/recruiter/status-menu";
import { requireRole } from "@/lib/auth-server";
import { Interview, InterviewChangeEvent, PipelineList } from "@/lib/recruiter";
import { recruiterAPI } from "@/lib/recruiter-server";

export const dynamic = "force-dynamic";

export default async function InterviewsPage({ searchParams }: { searchParams: Promise<{ interview_id?: string; status?: string; view?: string; mode?: string; date?: string }> }) {
  await requireRole("recruiter");
  const { interview_id, status, view, mode, date } = await searchParams;
  const [{ items }, pipeline] = await Promise.all([
    recruiterAPI<{ items: Interview[] }>("/api/v1/recruiter/interviews"),
    recruiterAPI<PipelineList>("/api/v1/recruiter/pipeline?page=1&limit=50"),
  ]);
  const visibleItems = items.filter((item) => (!interview_id || item.id === interview_id) && (status !== "upcoming" || (item.status === "scheduled" && new Date(item.scheduled_at).getTime() >= Date.now())));
  const calendar = view === "calendar";
  const history = interview_id && visibleItems.length ? await recruiterAPI<{ items: InterviewChangeEvent[] }>(`/api/v1/recruiter/interviews/${encodeURIComponent(interview_id)}/history`) : null;

  return (
    <RecruiterShell>
      <div className="grid gap-5">
        <section className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="text-[10px] font-extrabold uppercase tracking-[0.14em] text-indigo">Interview operations</p>
            <h1 className="mt-1.5 text-2xl font-bold tracking-[-0.04em] text-navy sm:text-[2rem]">Interviews</h1>
            <p className="mt-1 text-sm text-ink-muted">Coordinate interviews while keeping the meeting itself in the external tool your team already uses.</p>
          </div>
          <ScheduleInterviewForm applications={pipeline.items} />
        </section>

        <nav aria-label="Interview views" className="flex flex-wrap items-center gap-2"><Link href="/recruiter/interviews" aria-current={!calendar ? "page" : undefined} className={`rounded-lg px-3 py-2 text-sm font-bold ${!calendar ? "bg-indigo text-white" : "border border-line bg-white text-navy"}`}>List view</Link><Link href="/recruiter/interviews?view=calendar&mode=week" aria-current={calendar ? "page" : undefined} className={`rounded-lg px-3 py-2 text-sm font-bold ${calendar ? "bg-indigo text-white" : "border border-line bg-white text-navy"}`}>Calendar view</Link>{status === "upcoming" && <Link href="/recruiter/interviews" className="ml-auto text-sm font-bold text-indigo hover:underline">Show all interviews</Link>}</nav>
        {interview_id && <Link href="/recruiter/interviews" className="text-sm font-bold text-indigo hover:underline">← All interviews</Link>}
        {calendar ? <InterviewCalendar items={visibleItems} mode={mode === "day" ? "day" : "week"} date={date} /> : visibleItems.length ? (<>
          <div className="grid gap-3 xl:hidden" aria-label="Interview cards">
            {visibleItems.map((interview) => <article key={interview.id} className="rounded-2xl border border-line/70 bg-white p-4 shadow-sm">
              <div className="flex flex-wrap items-start justify-between gap-2"><div><p className="text-xs font-extrabold text-indigo">{interview.job_reference}</p><h2 className="font-bold text-navy">{interview.job_title}</h2><p className="mt-0.5 text-sm text-ink-muted">{interview.round_label}</p></div><StatusPill value={interview.status} /></div>
              <div className="mt-3 border-t border-line/60 pt-3"><InterviewCandidateCard interview={interview} /></div>
              <dl className="mt-4 grid grid-cols-2 gap-3 border-t border-line/60 pt-3 text-xs"><div><dt className="text-ink-muted">Schedule</dt><dd className="mt-1 font-semibold text-ink">{new Intl.DateTimeFormat("en-IN", { dateStyle: "medium", timeStyle: "short", timeZone: "Asia/Kolkata" }).format(new Date(interview.scheduled_at))} IST</dd></div><div><dt className="text-ink-muted">Duration</dt><dd className="mt-1 font-semibold text-ink">{interview.duration_minutes} min</dd></div></dl>
              <div className="mt-4 flex flex-wrap items-center gap-3"><a href={interview.meeting_url} target="_blank" rel="noopener noreferrer" className="text-xs font-bold text-indigo hover:underline">Open meeting ↗</a><InterviewActions interview={interview} /></div>
            </article>)}
          </div>
          <div className="hidden overflow-x-auto rounded-2xl border border-line/70 bg-white shadow-[0_1px_2px_rgba(16,33,63,0.03)] xl:block">
            <table className="min-w-[920px] w-full text-left text-sm">
              <thead className="border-b border-line/70 bg-slate-50/80 text-[10px] font-extrabold uppercase tracking-[0.1em] text-ink-muted">
                <tr><th className="px-4 py-3">Candidate</th><th className="px-3 py-3">Job and round</th><th className="px-3 py-3">Schedule</th><th className="px-3 py-3">Duration</th><th className="px-3 py-3">Status</th><th className="px-3 py-3">Meeting</th><th className="px-3 py-3">Actions</th></tr>
              </thead>
              <tbody>
                {visibleItems.map((interview) => (
                  <tr key={interview.id} className="border-t border-line/50 transition hover:bg-slate-50/65">
                    <td className="px-4 py-3.5 font-bold text-ink"><InterviewCandidateCard interview={interview} /></td>
                    <td className="px-3 py-3.5 text-ink"><span className="block text-xs font-bold text-indigo">{interview.job_reference}</span><span className="block font-semibold">{interview.job_title}</span><span className="text-xs text-ink-muted">{interview.round_label}</span></td>
                    <td className="px-3 py-3.5 text-ink-muted">{new Intl.DateTimeFormat("en-IN", { dateStyle: "medium", timeStyle: "short", timeZone: "Asia/Kolkata" }).format(new Date(interview.scheduled_at))} IST</td>
                    <td className="px-3 py-3.5 text-ink-muted">{interview.duration_minutes} min</td>
                    <td className="px-3 py-3.5"><StatusPill value={interview.status} /></td>
                    <td className="px-3 py-3.5"><a href={interview.meeting_url} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 rounded-lg px-2 py-1.5 text-xs font-bold text-indigo transition hover:bg-indigo-soft focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo">Join meeting <span aria-hidden="true">↗</span></a></td>
                    <td className="px-3 py-3.5"><InterviewActions interview={interview} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div></>
        ) : (
          <div className="rounded-2xl border border-dashed border-line bg-white p-12 text-center">
            <div className="mx-auto flex h-11 w-11 items-center justify-center rounded-full bg-slate-100 text-slate-500"><svg aria-hidden="true" viewBox="0 0 24 24" className="h-5 w-5 fill-none stroke-current stroke-[1.8]"><rect x="4" y="5.5" width="16" height="14" rx="2" /><path d="M8 3.5v4M16 3.5v4M4 10h16" /></svg></div>
            <h2 className="mt-3 font-bold text-ink">{interview_id ? "Interview unavailable" : status === "upcoming" ? "No upcoming interviews" : "No interviews scheduled"}</h2><p className="mt-1 text-sm text-ink-muted">{interview_id ? "This interview is no longer available in your workspace." : "Choose an application and attach your external meeting URL when an interview is arranged."}</p>
          </div>
        )}
        {history && <section aria-label="Interview history" className="rounded-2xl border border-line/70 bg-white p-4"><h2 className="font-bold text-navy">Change history</h2>{history.items.length ? <ol className="mt-3 grid gap-2">{history.items.map((event, index) => <li key={`${event.changed_at}-${index}`} className="rounded-lg border border-line/60 p-3 text-sm"><span className="font-bold capitalize text-navy">{event.action}</span><span className="text-ink-muted"> by {event.actor_name} · {new Intl.DateTimeFormat("en-IN", { dateStyle: "medium", timeStyle: "short", timeZone: "Asia/Kolkata" }).format(new Date(event.changed_at))} IST</span>{event.action === "reschedule" && <p className="mt-1 text-xs text-ink-muted">Moved from {new Intl.DateTimeFormat("en-IN", { dateStyle: "medium", timeStyle: "short", timeZone: "Asia/Kolkata" }).format(new Date(event.previous_scheduled_at))} to {new Intl.DateTimeFormat("en-IN", { dateStyle: "medium", timeStyle: "short", timeZone: "Asia/Kolkata" }).format(new Date(event.new_scheduled_at))} IST.</p>}</li>)}</ol> : <p className="mt-2 text-sm text-ink-muted">No changes have been recorded for this interview.</p>}</section>}
      </div>
    </RecruiterShell>
  );
}
