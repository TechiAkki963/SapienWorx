"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";

import { apiRequest } from "@/lib/api";
import { Interview } from "@/lib/recruiter";

function localDateTime(value: string) {
  const date = new Date(value);
  return new Date(date.getTime() - date.getTimezoneOffset() * 60000).toISOString().slice(0, 16);
}

export function InterviewActions({ interview }: { interview: Interview }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function change(action: "reschedule" | "cancel" | "complete", details: Record<string, unknown> = {}) {
    setBusy(true);
    setError("");
    try {
      await apiRequest(`/api/v1/recruiter/interviews/${interview.id}`, { method: "PATCH", body: JSON.stringify({ action, ...details }) });
      setOpen(false);
      router.refresh();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not update interview.");
    } finally {
      setBusy(false);
    }
  }

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    const date = new Date(String(data.get("scheduled_at")));
    if (Number.isNaN(date.getTime())) { setError("Choose a valid interview date and time."); return; }
    void change("reschedule", {
      scheduled_at: date.toISOString(),
      duration_minutes: Number(data.get("duration_minutes")),
      meeting_url: String(data.get("meeting_url")),
      round_label: String(data.get("round_label")),
      notes: String(data.get("notes")),
    });
  }

  if (interview.status !== "scheduled") return <span className="text-xs text-ink-muted">—</span>;
  return <>
    <div className="flex flex-wrap gap-1.5">
      <button type="button" onClick={() => setOpen(true)} disabled={busy} className="rounded-lg border border-line px-2.5 py-1.5 text-xs font-bold text-indigo hover:bg-indigo-soft">Reschedule</button>
      <button type="button" onClick={() => { if (window.confirm(`Mark the interview with ${interview.candidate_name} as completed?`)) void change("complete"); }} disabled={busy} className="rounded-lg border border-line px-2.5 py-1.5 text-xs font-bold text-emerald-700 hover:bg-emerald-50">Complete</button>
      <button type="button" onClick={() => { if (window.confirm(`Cancel the interview with ${interview.candidate_name}? The candidate will be notified.`)) void change("cancel"); }} disabled={busy} className="rounded-lg border border-line px-2.5 py-1.5 text-xs font-bold text-rose-700 hover:bg-rose-50">Cancel</button>
    </div>
    {error && !open && <p role="alert" className="mt-2 text-xs text-rose-700">{error}</p>}
    {open && <div role="presentation" className="fixed inset-0 z-50 flex items-end justify-center bg-navy/40 p-0 sm:items-center sm:p-5" onMouseDown={(event) => { if (event.target === event.currentTarget && !busy) setOpen(false); }}>
      <section role="dialog" aria-modal="true" aria-label={`Reschedule ${interview.candidate_name}`} className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-t-2xl bg-white p-5 shadow-xl sm:rounded-2xl sm:p-6">
        <h2 className="text-xl font-bold text-navy">Reschedule interview</h2>
        <p className="mt-1 text-sm text-ink-muted">{interview.candidate_name} · {interview.job_title}</p>
        {error && <p role="alert" className="mt-3 rounded-lg bg-rose-50 p-3 text-sm text-rose-700">{error}</p>}
        <form onSubmit={submit} className="mt-4 grid gap-4">
          <label className="grid gap-1 text-xs font-bold text-ink">Round<input name="round_label" defaultValue={interview.round_label} maxLength={120} required className="min-h-11 rounded-xl border border-line px-3 text-sm" /></label>
          <label className="grid gap-1 text-xs font-bold text-ink">Date and time<input name="scheduled_at" type="datetime-local" defaultValue={localDateTime(interview.scheduled_at)} required className="min-h-11 rounded-xl border border-line px-3 text-sm" /></label>
          <label className="grid gap-1 text-xs font-bold text-ink">Duration (minutes)<input name="duration_minutes" type="number" min="10" max="480" defaultValue={interview.duration_minutes} required className="min-h-11 rounded-xl border border-line px-3 text-sm" /></label>
          <label className="grid gap-1 text-xs font-bold text-ink">External meeting URL<input name="meeting_url" type="url" defaultValue={interview.meeting_url} required className="min-h-11 rounded-xl border border-line px-3 text-sm" /></label>
          <label className="grid gap-1 text-xs font-bold text-ink">Internal notes<textarea name="notes" defaultValue={interview.notes ?? ""} rows={3} className="rounded-xl border border-line px-3 py-2 text-sm" /></label>
          <div className="flex justify-end gap-2"><button type="button" onClick={() => setOpen(false)} disabled={busy} className="rounded-xl border border-line px-4 py-2 text-sm font-bold text-ink">Close</button><button type="submit" disabled={busy} className="rounded-xl bg-indigo px-4 py-2 text-sm font-bold text-white">{busy ? "Saving…" : "Save new schedule"}</button></div>
        </form>
      </section>
    </div>}
  </>;
}
