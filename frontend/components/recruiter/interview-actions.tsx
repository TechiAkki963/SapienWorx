"use client";

import Link from "next/link";
import { FormEvent, useId, useState } from "react";
import { useRouter } from "next/navigation";

import { RecruiterDrawer, recruiterPrimary, recruiterSecondary } from "./workspace-ui";
import { interviewTimeISO } from "@/lib/interview-time";
import { apiRequest } from "@/lib/api";
import { Interview } from "@/lib/recruiter";

function localDateTime(value: string) {
  const date = new Date(value);
  return new Date(date.getTime() - date.getTimezoneOffset() * 60000).toISOString().slice(0, 16);
}

export function InterviewActions({ interview }: { interview: Interview }) {
  const router = useRouter();
  const formID=useId();
  const [menu,setMenu]=useState(false);
  const [notice,setNotice]=useState("");
  const upcoming=interview.status==="scheduled"&&new Date(interview.scheduled_at).getTime()>=Date.now();
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
    let scheduledAt: string;
    try { scheduledAt = interviewTimeISO(String(data.get("scheduled_at")), Intl.DateTimeFormat().resolvedOptions().timeZone); }
    catch (cause) { setError(cause instanceof Error ? cause.message : "Choose a valid interview date and time."); return; }
    void change("reschedule", {
      scheduled_at: scheduledAt,
      duration_minutes: Number(data.get("duration_minutes")),
      meeting_url: String(data.get("meeting_url")),
      round_label: String(data.get("round_label")),
      notes: String(data.get("notes")),
    });
  }

  return <>
    <div className="flex flex-wrap items-center gap-2">
      {upcoming?<>{interview.meeting_url && <a href={interview.meeting_url} target="_blank" rel="noopener noreferrer" className={recruiterPrimary}>Join meeting ↗</a>}<button type="button" onClick={()=>setOpen(true)} disabled={busy} className={recruiterSecondary}>Reschedule</button></>:interview.status==="scheduled"?<button className={recruiterSecondary} disabled={busy} onClick={()=>{if(window.confirm(`Mark the interview with ${interview.candidate_name} as completed?`))void change("complete")}}>Complete</button>:<Link className={recruiterSecondary} href={`/recruiter/interviews?status=all&interview_id=${interview.id}`}>Details</Link>}
      <button aria-label={`More interview actions for ${interview.candidate_name}`} className={recruiterSecondary} onClick={()=>setMenu(true)}>⋯</button>
    </div>
    <RecruiterDrawer open={menu} onClose={()=>setMenu(false)} title={`Interview with ${interview.candidate_name}`}><div className="grid gap-3"><p className="font-semibold text-navy">{interview.job_title} · {interview.round_label}</p><p className="text-sm text-ink-muted">{interview.duration_minutes} minutes · {interview.status}</p><Link className={recruiterSecondary} href={`/recruiter/interviews?status=all&interview_id=${interview.id}`} onClick={()=>setMenu(false)}>View details & history</Link>{interview.meeting_url&&<button className={recruiterSecondary} onClick={async()=>{try{await navigator.clipboard.writeText(interview.meeting_url);setNotice("Meeting link copied.")}catch{setNotice("Could not copy the meeting link.")}}}>Copy meeting link</button>}{notice&&<p role="status" className="text-sm text-ink-muted">{notice}</p>}{interview.status==="scheduled"&&<><button className={recruiterSecondary} disabled={busy} onClick={()=>{setMenu(false);setOpen(true)}}>Reschedule</button><button className={recruiterSecondary} disabled={busy} onClick={()=>{if(window.confirm(`Mark the interview with ${interview.candidate_name} as completed?`)){setMenu(false);void change("complete")}}}>Complete interview</button><button className={`${recruiterSecondary} text-rose-700`} disabled={busy} onClick={()=>{if(window.confirm(`Cancel the interview with ${interview.candidate_name}? The candidate will be notified.`)){setMenu(false);void change("cancel")}}}>Cancel interview</button></>}</div></RecruiterDrawer>
    {error && !open && <p role="alert" className="mt-2 text-xs text-rose-700">{error}</p>}
    <RecruiterDrawer open={open} onClose={()=>{if(!busy)setOpen(false);}} title={`Reschedule ${interview.candidate_name}`} footer={<><button type="button" disabled={busy} onClick={()=>setOpen(false)} className={recruiterSecondary}>Cancel</button><button type="submit" form={formID} disabled={busy} className={recruiterPrimary}>{busy?"Saving…":"Save new schedule"}</button></>}><h2 className="text-xl font-bold text-navy">Reschedule interview</h2>
        <p className="mt-1 text-sm text-ink-muted">{interview.candidate_name} · {interview.job_title}</p>
        {error && <p role="alert" className="mt-3 rounded-lg bg-rose-50 p-3 text-sm text-rose-700">{error}</p>}
        {open && <form id={formID} onSubmit={submit} className="mt-4 grid gap-4">
          <label className="grid gap-1 text-xs font-bold text-ink">Round<input name="round_label" defaultValue={interview.round_label} maxLength={120} required className="min-h-11 rounded-xl border border-line px-3 text-sm" /></label>
          <label className="grid gap-1 text-xs font-bold text-ink">Date and time ({Intl.DateTimeFormat().resolvedOptions().timeZone})<input name="scheduled_at" type="datetime-local" defaultValue={localDateTime(interview.scheduled_at)} required className="min-h-11 rounded-xl border border-line px-3 text-sm" /></label>
          <label className="grid gap-1 text-xs font-bold text-ink">Duration (minutes)<input name="duration_minutes" type="number" min="10" max="480" defaultValue={interview.duration_minutes} required className="min-h-11 rounded-xl border border-line px-3 text-sm" /></label>
          <label className="grid gap-1 text-xs font-bold text-ink">Meeting link<input name="meeting_url" type="url" defaultValue={interview.meeting_url} required={!interview.format || interview.format === "video"} className="min-h-11 rounded-xl border border-line px-3 text-sm" /></label>
          <label className="grid gap-1 text-xs font-bold text-ink">Internal notes<textarea name="notes" defaultValue={interview.notes ?? ""} rows={3} className="rounded-xl border border-line px-3 py-2 text-sm" /></label>

        </form>}</RecruiterDrawer>
  </>;
}
