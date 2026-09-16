import Link from "next/link";

import { WorkspaceError } from "@/components/candidate/workspace-error";
import { Surface } from "@/components/ui/surface";
import { CandidateInterview, humanize } from "@/lib/candidate";
import { candidateAPI } from "@/lib/candidate-server";

export default async function CandidateInterviewsPage() {
  let items: CandidateInterview[];
  try {
    ({ items } = await candidateAPI<{ items: CandidateInterview[] }>("/api/v1/candidate/interviews"));
  } catch {
    return <WorkspaceError title="We couldn’t load your interviews." />;
  }

  return (
    <div>
      <div>
        <p className="text-xs font-bold uppercase tracking-[0.14em] text-indigo">Interview schedule</p>
        <h1 className="mt-2 text-4xl font-bold tracking-[-0.045em] text-navy">Your interviews</h1>
        <p className="mt-2 max-w-2xl text-sm leading-6 text-ink-muted">Keep every scheduled interview, date, duration and meeting link in one place.</p>
      </div>

      {!items.length ? (
        <Surface className="mt-6 p-8 text-center" tone="mint">
          <h2 className="text-xl font-bold text-navy">No interviews scheduled yet.</h2>
          <p className="mt-2 text-sm text-ink-muted">When a recruiter schedules an interview, it will appear here automatically.</p>
          <Link href="/candidate/applications" className="mt-4 inline-flex text-sm font-bold text-indigo hover:underline">View applications</Link>
        </Surface>
      ) : (
        <div className="mt-6 grid gap-4">
          {items.map((item) => {
            const scheduledAt = new Date(item.scheduled_at);
            const isJoinable = item.status === "scheduled";
            return (
              <Surface key={item.id} className="p-5 sm:p-6">
                <div className="flex flex-col justify-between gap-5 sm:flex-row sm:items-start">
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="rounded-full bg-indigo-soft/70 px-3 py-1 text-xs font-bold text-indigo">{humanize(item.status)}</span>
                      <span className="text-xs font-semibold text-ink-muted">{item.duration_minutes} minutes</span>
                    </div>
                    <h2 className="mt-3 text-xl font-bold text-navy">{item.job_title}</h2>
                    <p className="mt-1 text-sm font-semibold text-ink-muted">{item.company_name}</p>
                    <p className="mt-4 text-sm font-bold text-ink">{scheduledAt.toLocaleString("en-IN", { dateStyle: "full", timeStyle: "short" })}</p>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <Link href={`/candidate/jobs/${item.job_id}`} className="inline-flex min-h-10 items-center justify-center rounded-xl border border-line bg-white px-4 text-sm font-bold text-ink transition hover:bg-slate-50">View role</Link>
                    {isJoinable && (
                      <a href={item.meeting_url} target="_blank" rel="noreferrer" className="inline-flex min-h-10 items-center justify-center rounded-xl bg-indigo px-4 text-sm font-bold text-white shadow-sm transition hover:opacity-90">Join interview</a>
                    )}
                  </div>
                </div>
              </Surface>
            );
          })}
        </div>
      )}
    </div>
  );
}
