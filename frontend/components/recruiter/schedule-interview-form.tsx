"use client";

import { FormEvent, useId, useState } from "react";
import { useRouter } from "next/navigation";

import { Button } from "@/components/ui/button";
import { RecruiterDrawer } from "./workspace-ui";
import { interviewTimeISO } from "@/lib/interview-time";
import { apiRequest } from "@/lib/api";
import { PipelineRow, RecruiterTeamMember } from "@/lib/recruiter";
import { interviewZones } from "@/lib/interview-workspace";

const controlClass = "min-h-11 w-full rounded-xl border border-line bg-white px-3 text-sm text-ink outline-none transition focus:border-indigo/40 focus:ring-3 focus:ring-indigo-soft";
const labelClass = "grid gap-1.5 text-xs font-bold text-ink";

export function ScheduleInterviewForm({ applications, compactTrigger = false, team = [], endpoint = "/api/v1/recruiter/interviews", onScheduled }: { applications: Pick<PipelineRow,"application_id"|"candidate_name"|"job_title">[]; compactTrigger?: boolean; team?: RecruiterTeamMember[]; endpoint?: string; onScheduled?: ()=>Promise<void> }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [format, setFormat] = useState("video");
  const formID = useId();

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy) return;
    setBusy(true);
    setError("");
    const data = new FormData(event.currentTarget);
    try {
      await apiRequest(endpoint, {
        method: "POST",
        body: JSON.stringify({
          application_id: data.get("application_id"),
          scheduled_at: interviewTimeISO(String(data.get("scheduled_at")),String(data.get("timezone"))),
          duration_minutes: Number(data.get("duration_minutes")),
          meeting_url: data.get("meeting_url"),
          round_label: data.get("round_label"),
          notes: data.get("notes"),
          timezone: data.get("timezone"),
          format,
          location: data.get("location") || "",
          interviewer_ids: data.getAll("interviewer_id"),
        }),
      });
      setOpen(false);
      await onScheduled?.();
      router.refresh();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not schedule interview.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <Button onClick={() => setOpen(true)} disabled={!applications.length} aria-haspopup="dialog" aria-expanded={open} variant={compactTrigger ? "secondary" : "primary"} size={compactTrigger ? "sm" : "md"} className={compactTrigger ? "max-sm:min-w-[6.5rem] max-sm:flex-1" : undefined}><svg aria-hidden="true" viewBox="0 0 24 24" className="h-5 w-5 fill-none stroke-current stroke-[1.8]"><rect x="3" y="5" width="18" height="16" rx="2"/><path d="M16 3v4M8 3v4M3 11h18m-9 3v4m-2-2h4"/></svg><span>Schedule interview</span></Button>
      <RecruiterDrawer initialFocus='select[name="application_id"]' open={open} onClose={()=>{if(!busy)setOpen(false);}} title="Schedule interview" footer={<><Button type="button" variant="secondary" onClick={() => setOpen(false)} disabled={busy}>Cancel</Button><Button type="submit" form={formID} disabled={busy}>{busy ? "Scheduling…" : "Schedule interview"}</Button></>}><form id={formID} onSubmit={submit} className="p-5 sm:p-6">
              {error && <p role="alert" className="mb-4 rounded-xl border border-red-100 bg-red-50 px-3 py-2.5 text-sm font-semibold text-red-700">{error}</p>}
              <div className="grid gap-4 md:grid-cols-2">
                <label className={`${labelClass} md:col-span-2`}>Candidate and job<select name="application_id" required className={controlClass}>{applications.map((application) => <option key={application.application_id} value={application.application_id}>{application.candidate_name} — {application.job_title}</option>)}</select></label>
                <label className={`${labelClass} md:col-span-2`}>Interview round<input name="round_label" list={`${formID}-rounds`} maxLength={120} defaultValue="Screening" required className={controlClass} /><datalist id={`${formID}-rounds`}>{["Screening","Technical","Managerial","HR","Final","Portfolio"].map(round=><option key={round} value={round}/>)}</datalist></label>
                {team.length > 0 && <fieldset className="md:col-span-2"><legend className="swx-type-label mb-2 text-ink">Interviewers</legend><p className="swx-type-caption mb-2 text-ink-muted">Select up to 10 verified teammates. If none are selected, you will be the interviewer.</p><div className="grid gap-2">{team.map(person=><label key={person.user_id} className="flex min-h-11 items-center gap-3 text-sm"><input type="checkbox" name="interviewer_id" value={person.user_id} className="h-4 w-4 accent-indigo"/>{person.full_name}</label>)}</div></fieldset>}
                <label className={labelClass}>Timezone<select aria-label="Timezone" name="timezone" defaultValue="Asia/Kolkata" className={controlClass}>{interviewZones.map(zone=><option key={zone} value={zone}>{zone}</option>)}</select></label><label className={labelClass}>Date and time<input name="scheduled_at" type="datetime-local" required className={controlClass} /></label>
                <label className={labelClass}>Duration (minutes)<input name="duration_minutes" type="number" min="10" max="480" defaultValue="45" className={controlClass} /></label>
                <label className={labelClass}>Format<select aria-label="Format" value={format} onChange={event=>setFormat(event.target.value)} className={controlClass}><option value="video">Video</option><option value="phone">Phone</option><option value="in_person">In-person</option></select></label>
                {format === "video" && <label className={`${labelClass} md:col-span-2`}>Meeting link<input name="meeting_url" type="url" required placeholder="https://..." className={controlClass} /><span className="font-normal text-ink-muted">Paste the meeting link supplied by your team.</span></label>}
                {format !== "video" && <label className={`${labelClass} md:col-span-2`}>{format === "phone" ? "Call instructions" : "Location"}<input name="location" maxLength={500} required={format === "in_person"} className={controlClass}/></label>}
                <label className={`${labelClass} md:col-span-2`}>Internal notes<textarea name="notes" rows={4} className={`${controlClass} min-h-28 py-3`} placeholder="Agenda, panel notes or preparation context" /></label>
                <div className="md:col-span-2 grid gap-3 rounded-lg border border-line p-3 text-sm sm:grid-cols-2"><div><p className="font-semibold text-ink">Standard scorecard</p><p className="mt-1 text-ink-muted">Rating, recommendation and supporting feedback.</p></div><div><p className="font-semibold text-ink">In-app reminder</p><p className="mt-1 text-ink-muted">Appears in Notifications 30 minutes before the interview.</p></div></div>
              </div>
            </form></RecruiterDrawer>
    </>
  );
}
