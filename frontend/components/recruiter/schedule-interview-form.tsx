"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";

import { Button } from "@/components/ui/button";
import { apiRequest } from "@/lib/api";
import { PipelineRow } from "@/lib/recruiter";

const controlClass = "min-h-11 w-full rounded-xl border border-line bg-white px-3 text-sm text-ink outline-none transition focus:border-indigo/40 focus:ring-3 focus:ring-indigo-soft";
const labelClass = "grid gap-1.5 text-xs font-bold text-ink";

export function ScheduleInterviewForm({ applications }: { applications: PipelineRow[] }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError("");
    const data = new FormData(event.currentTarget);
    try {
      await apiRequest("/api/v1/recruiter/interviews", {
        method: "POST",
        body: JSON.stringify({
          application_id: data.get("application_id"),
          scheduled_at: new Date(String(data.get("scheduled_at"))).toISOString(),
          duration_minutes: Number(data.get("duration_minutes")),
          meeting_url: data.get("meeting_url"),
          notes: data.get("notes"),
        }),
      });
      setOpen(false);
      router.refresh();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not schedule interview.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <Button onClick={() => setOpen(true)} disabled={!applications.length}>Schedule interview</Button>
      {open && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-navy/35 p-0 backdrop-blur-[2px] sm:items-center sm:p-6" role="presentation" onMouseDown={(event) => { if (event.currentTarget === event.target && !busy) setOpen(false); }}>
          <section role="dialog" aria-modal="true" aria-labelledby="schedule-interview-title" className="w-full max-w-2xl rounded-t-3xl bg-white shadow-[0_24px_80px_rgba(7,29,73,0.28)] sm:rounded-3xl">
            <div className="flex items-start justify-between gap-4 border-b border-line/70 px-5 py-4 sm:px-6">
              <div><p className="text-[10px] font-extrabold uppercase tracking-[0.13em] text-indigo">Interview coordination</p><h2 id="schedule-interview-title" className="mt-1 text-xl font-bold text-navy">Schedule interview</h2><p className="mt-1 text-xs text-ink-muted">Use the meeting URL created in your external conferencing tool.</p></div>
              <button type="button" onClick={() => !busy && setOpen(false)} className="flex h-9 w-9 items-center justify-center rounded-full border border-line text-lg text-ink-muted hover:bg-slate-50" aria-label="Close interview dialog">×</button>
            </div>
            <form onSubmit={submit} className="p-5 sm:p-6">
              {error && <p role="alert" className="mb-4 rounded-xl border border-red-100 bg-red-50 px-3 py-2.5 text-sm font-semibold text-red-700">{error}</p>}
              <div className="grid gap-4 md:grid-cols-2">
                <label className={`${labelClass} md:col-span-2`}>Candidate and job<select name="application_id" required className={controlClass}>{applications.map((application) => <option key={application.application_id} value={application.application_id}>{application.candidate_name} — {application.job_title}</option>)}</select></label>
                <label className={labelClass}>Date and time<input name="scheduled_at" type="datetime-local" required className={controlClass} /></label>
                <label className={labelClass}>Duration (minutes)<input name="duration_minutes" type="number" min="10" max="480" defaultValue="45" className={controlClass} /></label>
                <label className={`${labelClass} md:col-span-2`}>External meeting URL<input name="meeting_url" type="url" required placeholder="https://..." className={controlClass} /><span className="font-normal text-ink-muted">SapienWorx stores and opens this URL; it does not create or host the meeting.</span></label>
                <label className={`${labelClass} md:col-span-2`}>Internal notes<textarea name="notes" rows={4} className={`${controlClass} min-h-28 py-3`} placeholder="Agenda, panel notes or preparation context" /></label>
              </div>
              <div className="mt-5 flex justify-end gap-2 border-t border-line/70 pt-4"><Button type="button" variant="secondary" onClick={() => setOpen(false)} disabled={busy}>Cancel</Button><Button type="submit" disabled={busy}>{busy ? "Scheduling…" : "Schedule interview"}</Button></div>
            </form>
          </section>
        </div>
      )}
    </>
  );
}
