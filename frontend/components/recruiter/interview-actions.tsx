"use client";
import Link from "next/link";
import {useEffect,useId,useRef,useState,type FormEvent} from "react";
import {useRouter} from "next/navigation";
import {RecruiterModal,RecruiterModalClose,recruiterInput,recruiterPrimary,recruiterSecondary} from "./workspace-ui";
import {interviewTimeISO,interviewLocalTime} from "@/lib/interview-time";
import {interviewZones} from "@/lib/interview-workspace";
import {apiRequest} from "@/lib/api";
import type {Interview} from "@/lib/recruiter";
type Action="reschedule"|"cancel"|"complete";
function OperationForm({interview,action,formID,onSaved,onBusy}:{interview:Interview;action:Action;formID:string;onSaved:()=>void;onBusy:(busy:boolean)=>void}) {
 const router=useRouter(),focus=useRef<HTMLInputElement>(null);
 const [error,setError]=useState(""),[busy,setBusy]=useState(false);
 const zone=interview.timezone||"Asia/Kolkata";
 useEffect(()=>focus.current?.focus(),[action]);
 async function submit(event:FormEvent<HTMLFormElement>){event.preventDefault();if(busy)return;const data=new FormData(event.currentTarget);setBusy(true);onBusy(true);setError("");try{
  const payload:Record<string,unknown>={action,expected_scheduled_at:interview.scheduled_at};
  if(action==="reschedule")Object.assign(payload,{scheduled_at:interviewTimeISO(String(data.get("scheduled_at")),String(data.get("timezone"))),timezone:String(data.get("timezone")),duration_minutes:Number(data.get("duration_minutes")),round_label:String(data.get("round_label")),meeting_url:String(data.get("meeting_url")||""),location:String(data.get("location")||""),notes:String(data.get("notes")||"")});
  await apiRequest(`/api/v1/recruiter/interviews/${interview.id}`,{method:"PATCH",body:JSON.stringify(payload)});onSaved();router.refresh();
 }catch(cause){setError(cause instanceof Error?cause.message:"Could not update this interview.")}finally{setBusy(false);onBusy(false)}}
 return <form id={formID} onSubmit={submit} className="grid gap-4">
  <p className="text-sm font-semibold text-navy">{interview.candidate_name} · {interview.job_title}</p>
  {error&&<p role="alert" className="text-sm text-rose-700">{error}</p>}
  <fieldset disabled={busy} className="grid min-w-0 gap-4">{action==="reschedule"?<>
   <label className="grid gap-1 text-sm">Round<input ref={focus} name="round_label" defaultValue={interview.round_label} required maxLength={120} className={recruiterInput}/></label>
   <div className="grid gap-4 sm:grid-cols-2"><label className="grid gap-1 text-sm">Timezone<select name="timezone" defaultValue={zone} className={recruiterInput}>{Array.from(new Set([zone,...interviewZones])).map(value=><option key={value}>{value}</option>)}</select></label><label className="grid gap-1 text-sm">Date and time<input name="scheduled_at" type="datetime-local" defaultValue={interviewLocalTime(interview.scheduled_at,zone)} required className={recruiterInput}/></label></div>
   <label className="grid gap-1 text-sm">Duration (minutes)<input name="duration_minutes" type="number" min={10} max={480} defaultValue={interview.duration_minutes} required className={recruiterInput}/></label>
   {(!interview.format||interview.format==="video")?<label className="grid gap-1 text-sm">Meeting link<input name="meeting_url" type="url" required defaultValue={interview.meeting_url} className={recruiterInput}/></label>:<label className="grid gap-1 text-sm">{interview.format==="phone"?"Call instructions":"Location"}<input name="location" required={interview.format==="in_person"} maxLength={500} defaultValue={interview.location||""} className={recruiterInput}/></label>}
   <label className="grid gap-1 text-sm">Internal notes<textarea name="notes" maxLength={4000} defaultValue={interview.notes||""} rows={3} className={recruiterInput}/></label>
  </>:<p className="text-sm leading-6">{action==="cancel"?"Cancel this interview? The candidate will be notified, and the history will retain the original schedule.":"Mark this interview completed? Panel feedback will remain available separately."}</p>}
 </fieldset></form>;
}
export function InterviewActions({interview,embedded=false,onBusy}:{interview:Interview;embedded?:boolean;onBusy?:(busy:boolean)=>void}) {
 const [mode,setMode]=useState<Action|"menu"|null>(null),[busy,setBusy]=useState(false),[notice,setNotice]=useState("");const formID=useId();
 const upcoming=interview.status==="scheduled"&&Date.parse(interview.scheduled_at)>=Date.now();
 function changedBusy(value:boolean){setBusy(value);onBusy?.(value)}
 const controls=<div className="flex flex-wrap gap-2">
  {upcoming&&interview.meeting_url&&<a href={interview.meeting_url} rel="noopener noreferrer" target="_blank" className={recruiterPrimary}>Join meeting ↗</a>}
  {interview.status==="scheduled"&&<button type="button" className={recruiterSecondary} onClick={()=>setMode(upcoming?"reschedule":"complete")}>{upcoming?"Reschedule":"Complete"}</button>}
  <button type="button" className={recruiterSecondary} aria-label={`More interview actions for ${interview.candidate_name}`} onClick={()=>setMode("menu")}>⋯</button>
 </div>;
 const content=mode==="menu"?<div className="grid gap-3"><p className="text-sm">{interview.job_title} · {interview.round_label}</p>
  {!embedded&&<Link href={`/recruiter/interviews?status=all&interview_id=${interview.id}`} className={recruiterSecondary}>View details & history</Link>}
  {interview.meeting_url&&<button className={recruiterSecondary} onClick={async()=>{try{await navigator.clipboard.writeText(interview.meeting_url);setNotice("Meeting link copied.")}catch{setNotice("Could not copy the meeting link.")}}}>Copy meeting link</button>}
  {notice&&<p role="status" className="text-sm">{notice}</p>}
  {interview.status==="scheduled"&&["reschedule","complete","cancel"].map(value=><button key={value} className={recruiterSecondary} onClick={()=>setMode(value as Action)}>{value==="reschedule"?"Reschedule":value==="complete"?"Complete interview":"Cancel interview"}</button>)}
 </div>:mode?<OperationForm key={mode} interview={interview} action={mode} formID={formID} onSaved={()=>setMode(null)} onBusy={changedBusy}/>:null;
 const submit=mode&&mode!=="menu"?<button type="submit" form={formID} disabled={busy} className={recruiterPrimary}>{busy?"Saving…":mode==="reschedule"?"Save new schedule":mode==="cancel"?"Cancel interview":"Complete interview"}</button>:null;
 if(embedded)return <section>{controls}{mode&&<div className="mt-4 rounded-xl border border-line p-4">{content}<div className="mt-4 flex flex-wrap justify-end gap-2"><button type="button" disabled={busy} className={recruiterSecondary} onClick={()=>setMode(null)}>Back to details</button>{submit}</div></div>}</section>;
 return <>{controls}<RecruiterModal open={Boolean(mode)} onClose={()=>setMode(null)} busy={busy} protectChanges={mode==="reschedule"} title={mode==="reschedule"?`Reschedule ${interview.candidate_name}`:`Interview with ${interview.candidate_name}`} footer={<><RecruiterModalClose disabled={busy}/>{submit}</>}>{content}</RecruiterModal></>;
}
