import { RecruiterShell } from "@/components/recruiter/recruiter-shell";
import { ScheduleInterviewForm } from "@/components/recruiter/schedule-interview-form";
import { StatusPill } from "@/components/recruiter/status-menu";
import { requireRole } from "@/lib/auth-server";
import { Interview, PipelineList } from "@/lib/recruiter";
import { recruiterAPI } from "@/lib/recruiter-server";

export const dynamic = "force-dynamic";

export default async function InterviewsPage() {
  await requireRole("recruiter");
  const [{ items }, pipeline] = await Promise.all([
    recruiterAPI<{ items: Interview[] }>("/api/v1/recruiter/interviews"),
    recruiterAPI<PipelineList>("/api/v1/recruiter/pipeline?page=1&limit=50"),
  ]);

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

        {items.length ? (
          <div className="overflow-x-auto rounded-2xl border border-line/70 bg-white shadow-[0_1px_2px_rgba(16,33,63,0.03)]">
            <table className="min-w-[920px] w-full text-left text-sm">
              <thead className="border-b border-line/70 bg-slate-50/80 text-[10px] font-extrabold uppercase tracking-[0.1em] text-ink-muted">
                <tr><th className="px-4 py-3">Candidate</th><th className="px-3 py-3">Job</th><th className="px-3 py-3">Schedule</th><th className="px-3 py-3">Duration</th><th className="px-3 py-3">Status</th><th className="px-3 py-3">Meeting</th></tr>
              </thead>
              <tbody>
                {items.map((interview) => (
                  <tr key={interview.id} className="border-t border-line/50 transition hover:bg-slate-50/65">
                    <td className="px-4 py-3.5 font-bold text-ink">{interview.candidate_name}</td>
                    <td className="px-3 py-3.5 text-ink">{interview.job_title}</td>
                    <td className="px-3 py-3.5 text-ink-muted">{new Intl.DateTimeFormat("en-IN", { dateStyle: "medium", timeStyle: "short" }).format(new Date(interview.scheduled_at))}</td>
                    <td className="px-3 py-3.5 text-ink-muted">{interview.duration_minutes} min</td>
                    <td className="px-3 py-3.5"><StatusPill value={interview.status} /></td>
                    <td className="px-3 py-3.5"><a href={interview.meeting_url} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 rounded-lg px-2 py-1.5 text-xs font-bold text-indigo transition hover:bg-indigo-soft focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo">Join meeting <span aria-hidden="true">↗</span></a></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="rounded-2xl border border-dashed border-line bg-white p-12 text-center">
            <div className="mx-auto flex h-11 w-11 items-center justify-center rounded-full bg-slate-100 text-slate-500"><svg aria-hidden="true" viewBox="0 0 24 24" className="h-5 w-5 fill-none stroke-current stroke-[1.8]"><rect x="4" y="5.5" width="16" height="14" rx="2" /><path d="M8 3.5v4M16 3.5v4M4 10h16" /></svg></div>
            <h2 className="mt-3 font-bold text-ink">No interviews scheduled</h2><p className="mt-1 text-sm text-ink-muted">Choose an application and attach your external meeting URL when an interview is arranged.</p>
          </div>
        )}
      </div>
    </RecruiterShell>
  );
}
