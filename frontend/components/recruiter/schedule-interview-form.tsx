"use client";

import { FormEvent, useId, useState } from "react";
import { useRouter } from "next/navigation";

import { Button } from "@/components/ui/button";
import { RecruiterDrawer } from "./workspace-ui";
import { interviewTimeISO } from "@/lib/interview-time";
import { apiRequest } from "@/lib/api";
import { PipelineRow } from "@/lib/recruiter";

const controlClass = "min-h-11 w-full rounded-xl border border-line bg-white px-3 text-sm text-ink outline-none transition focus:border-indigo/40 focus:ring-3 focus:ring-indigo-soft";
const labelClass = "grid gap-1.5 text-xs font-bold text-ink";

export function ScheduleInterviewForm({ applications, compactTrigger = false }: { applications: PipelineRow[]; compactTrigger?: boolean }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const formID = useId();

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy) return;
    setBusy(true);
    setError("");
    const data = new FormData(event.currentTarget);
    try {
      await apiRequest("/api/v1/recruiter/interviews", {
        method: "POST",
        body: JSON.stringify({
          application_id: data.get("application_id"),
          scheduled_at: interviewTimeISO(String(data.get("scheduled_at")),String(data.get("timezone"))),
          duration_minutes: Number(data.get("duration_minutes")),
          meeting_url: data.get("meeting_url"),
          round_label: data.get("round_label"),
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
      <Button onClick={() => setOpen(true)} disabled={!applications.length} aria-haspopup="dialog" aria-expanded={open} variant={compactTrigger ? "secondary" : "primary"} size={compactTrigger ? "sm" : "md"} className={compactTrigger ? "max-sm:min-w-[6.5rem] max-sm:flex-1" : undefined}><span className={compactTrigger ? "sm:hidden" : "hidden"}>Interview</span><span className={compactTrigger ? "max-sm:hidden" : ""}>Schedule interview</span></Button>
      <RecruiterDrawer initialFocus='select[name="application_id"]' open={open} onClose={()=>{if(!busy)setOpen(false);}} title="Schedule interview" footer={<><Button type="button" variant="secondary" onClick={() => setOpen(false)} disabled={busy}>Cancel</Button><Button type="submit" form={formID} disabled={busy}>{busy ? "Scheduling…" : "Schedule interview"}</Button></>}><form id={formID} onSubmit={submit} className="p-5 sm:p-6">
              {error && <p role="alert" className="mb-4 rounded-xl border border-red-100 bg-red-50 px-3 py-2.5 text-sm font-semibold text-red-700">{error}</p>}
              <div className="grid gap-4 md:grid-cols-2">
                <label className={`${labelClass} md:col-span-2`}>Candidate and job<select name="application_id" required className={controlClass}>{applications.map((application) => <option key={application.application_id} value={application.application_id}>{application.candidate_name} — {application.job_title}</option>)}</select></label>
                <label className={`${labelClass} md:col-span-2`}>Interview round<input name="round_label" maxLength={120} defaultValue="First interview" required className={controlClass} /></label>
                <label className={labelClass}>Timezone<select name="timezone" defaultValue="Asia/Kolkata" className={controlClass}>{["Asia/Kolkata","UTC","Europe/London","Europe/Paris","America/New_York","America/Los_Angeles","Asia/Dubai","Asia/Singapore","Australia/Sydney"].map(zone=><option key={zone} value={zone}>{zone}</option>)}</select></label><label className={labelClass}>Date and time<input name="scheduled_at" type="datetime-local" required className={controlClass} /></label>
                <label className={labelClass}>Duration (minutes)<input name="duration_minutes" type="number" min="10" max="480" defaultValue="45" className={controlClass} /></label>
                <label className={`${labelClass} md:col-span-2`}>External meeting URL<input name="meeting_url" type="url" required placeholder="https://..." className={controlClass} /><span className="font-normal text-ink-muted">SapienWorx stores and opens this URL; it does not create or host the meeting.</span></label>
                <label className={`${labelClass} md:col-span-2`}>Internal notes<textarea name="notes" rows={4} className={`${controlClass} min-h-28 py-3`} placeholder="Agenda, panel notes or preparation context" /></label>
              </div>
            </form></RecruiterDrawer>
    </>
  );
}
