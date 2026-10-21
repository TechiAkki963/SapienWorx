"use client";

import Link from "next/link";
import { useEffect, useId, useState } from "react";
import { useRouter } from "next/navigation";
import { apiRequest } from "@/lib/api";
import { type RecruiterJob, type RecruiterTeamMember, type BulkJobActionResult, label } from "@/lib/recruiter";
import { CareerIcon } from "../candidate/career-icon";
import { JobShareMenu } from "./job-share-menu";
import { JobStatusControl } from "./job-status-control";
import { RecruiterModal, recruiterPrimary, recruiterSecondary, recruiterInput } from "./workspace-ui";

export function JobActions({ job, team, compact = false }: { job: RecruiterJob; team: RecruiterTeamMember[]; compact?: boolean }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [owner, setOwner] = useState("");
  const [sharing, setSharing] = useState<{status:string;visibility:string;updated_at:string;can_change_visibility:boolean}|null>(null);
  const [checking, setChecking] = useState(false), [permissionError,setPermissionError] = useState("");
  const [confirmPublic,setConfirmPublic] = useState(false), [notice,setNotice] = useState("");
  const reasonID=useId();
  useEffect(()=>{
    if(!open)return;
    const controller=new AbortController();setChecking(true);setPermissionError("");setSharing(null);setError("");
    void apiRequest<NonNullable<typeof sharing>>(`/api/v1/recruiter/jobs/${encodeURIComponent(job.id)}/visibility`,{signal:controller.signal}).then(state=>{if(!controller.signal.aborted)setSharing(state)}).catch(()=>{if(!controller.signal.aborted)setPermissionError("Job permissions could not be checked. Close and reopen job actions to try again.")}).finally(()=>{if(!controller.signal.aborted)setChecking(false)});
    return()=>controller.abort();
  },[open,job.id,job.status,job.visibility,job.updated_at]);
  const status=sharing?.status??job.status, visibility=sharing?.visibility??job.visibility;
  const shareEnabled=status==="active"&&visibility==="public";
  const shareReason=status==="draft"?"Publish this job publicly to enable sharing.":status==="archived"?"Archived jobs cannot be shared.":status!=="active"?`${label(status)} jobs cannot be shared. Review the job status before sharing.`:visibility!=="public"?"This job is private. Make it public to share it externally.":"";
  const updated = new Date(sharing?.updated_at??job.updated_at);
  const updatedLabel = Number.isNaN(updated.getTime()) ? "Unavailable" : new Intl.DateTimeFormat("en-GB", { dateStyle: "medium", timeStyle: "short", timeZone: "Asia/Kolkata" }).format(updated) + " IST";

  async function run(action: string) {
    if (busy) return;
    setBusy(true);
    setError("");
    try {
      if (action === "duplicate") {
        const result = await apiRequest<{ id: string }>(`/api/v1/recruiter/jobs/${job.id}/duplicate`, { method: "POST", body: JSON.stringify({}) });
        router.push(`/recruiter/jobs/${result.id}/edit`);
      } else if (action === "assign") {
        const result = await apiRequest<BulkJobActionResult>("/api/v1/recruiter/jobs/bulk", { method: "POST", body: JSON.stringify({ job_ids: [job.id], action: "reassign", assigned_recruiter_id: owner }) });
        if (result.failed_count) throw new Error("The job could not be reassigned under its organization rules.");
        router.refresh();
      }
      setOpen(false);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not update job.");
    } finally {
      setBusy(false);
    }
  }

  async function makePublic(){
    if(busy||!sharing||!sharing.can_change_visibility)return;
    setBusy(true);setError("");
    try{
      const state=await apiRequest<NonNullable<typeof sharing>>(`/api/v1/recruiter/jobs/${encodeURIComponent(job.id)}/visibility`,{method:"PATCH",body:JSON.stringify({visibility:"public",expected_visibility:sharing.visibility,expected_status:sharing.status,expected_updated_at:sharing.updated_at})});
      setSharing(state);setConfirmPublic(false);setNotice("Job is now public and ready to share.");router.refresh();
    }catch(cause){setError(cause instanceof Error?cause.message:"Unable to change job visibility. Try again.")}
    finally{setBusy(false)}
  }

  return <div className="flex flex-wrap gap-2">
    {!compact && <Link className={`${recruiterPrimary} whitespace-nowrap !px-2 !text-xs`} href={`/recruiter/jobs/${job.id}/applicants`}>View applicants</Link>}
    <button className={`${recruiterSecondary} ${compact ? "w-10 !px-0" : ""}`} aria-label={`More actions for ${job.title}`} onClick={() => {setNotice("");setOpen(true)}}>⋯</button>
    <RecruiterModal open={open} onClose={() => { if (!busy) setOpen(false); }} title={job.title} busy={busy} protectChanges={false} initialFocus="[data-modal-close]">
      <div className="grid min-w-0 gap-4">
        <div className="flex flex-wrap gap-2 text-xs font-semibold"><span className="rounded-full bg-indigo-soft px-3 py-1 text-ink">Status: {label(status)}</span><span className="rounded-full border border-line px-3 py-1 text-ink">Visibility: {label(visibility)}</span></div>
        <dl className="grid grid-cols-2 gap-3 border-b border-line pb-4 text-xs sm:grid-cols-3">
          <div><dt className="text-ink-muted">Job ID</dt><dd className="mt-1 text-ink">{job.job_reference}</dd></div>
          <div><dt className="text-ink-muted">Owner</dt><dd className="mt-1 text-ink">{job.owner_name || "Not specified"}</dd></div>
          <div className="col-span-2 sm:col-span-1"><dt className="text-ink-muted">Updated</dt><dd className="mt-1 text-ink">{Number.isNaN(updated.getTime()) ? updatedLabel : <time dateTime={sharing?.updated_at??job.updated_at}>{updatedLabel}</time>}</dd></div>
        </dl>
        <section aria-label="Job actions" className="grid gap-3"><div className="flex flex-wrap gap-x-5 gap-y-1"><Link className="inline-flex min-h-11 items-center text-sm font-semibold text-indigo" href={`/recruiter/jobs/${job.id}/edit`}>Edit job</Link><Link className="inline-flex min-h-11 items-center text-sm font-semibold text-indigo" href={`/recruiter/jobs/${job.id}/analytics`}>View analytics</Link><button className="inline-flex min-h-11 items-center text-sm font-semibold text-ink disabled:opacity-50" disabled={busy} onClick={() => void run("duplicate")}>Duplicate job as draft</button></div>
          <div className="rounded-xl border border-line p-3">{shareEnabled ? <JobShareMenu jobId={job.id} title={job.title} active/> : <button type="button" disabled aria-describedby={reasonID} className={`${recruiterSecondary} disabled:!opacity-100`}><CareerIcon name="share"/>Share job</button>}{shareReason&&<p id={reasonID} className="mt-2 text-sm leading-6 text-ink-muted">{shareReason}</p>}{checking&&<p role="status" className="mt-2 text-sm text-ink-muted">Checking job permissions…</p>}{permissionError&&<p role="alert" className="mt-2 text-sm text-ink">{permissionError}</p>}{status==="active"&&visibility==="private"&&sharing?.can_change_visibility&&<button type="button" className={`${recruiterPrimary} mt-3`} disabled={busy} onClick={()=>{setError("");setConfirmPublic(true)}}>Make job public</button>}{status==="draft"&&sharing?.can_change_visibility&&<Link href={`/recruiter/jobs/${job.id}/edit`} className="mt-2 inline-flex min-h-11 items-center text-sm font-semibold text-indigo">Review &amp; publish →</Link>}</div>
        </section>
        {notice&&<p role="status" className="text-sm font-semibold text-ink">{notice}</p>}
        <section aria-label="Recruiter assignment" className="grid gap-2 border-t border-line pt-4 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-end"><label className="grid gap-1 text-xs font-semibold text-ink-muted">Assign recruiter
          <select aria-label="Assign recruiter" disabled={busy} className={recruiterInput} value={owner} onChange={event => setOwner(event.target.value)}>
            <option value="">Choose company recruiter</option>
            {team.map(member => <option key={member.user_id} value={member.user_id}>{member.full_name}</option>)}
          </select>
        </label>
        <button className={`${recruiterSecondary} w-fit`} disabled={busy || !owner} onClick={() => void run("assign")}>Assign selected recruiter</button></section>
        <section aria-label="Job state controls" className="grid gap-2 border-t border-line pt-4"><h3 className="text-sm font-semibold text-navy">Job status <span className="font-normal text-ink-muted">· Current: {label(status)}</span></h3><JobStatusControl jobId={job.id} status={status} embedded/></section>
        {error && <p role="alert" className="text-sm text-rose-700">{error}</p>}
      </div>
    </RecruiterModal>
    <RecruiterModal open={confirmPublic} onClose={()=>setConfirmPublic(false)} title="Make this job public?" size="small" busy={busy} protectChanges={false} initialFocus="[data-cancel-public]" returnFocus="dialog[open] [data-job-share-trigger]" footer={<><button type="button" data-cancel-public className={recruiterSecondary} disabled={busy} onClick={()=>setConfirmPublic(false)}>Cancel</button><button type="button" className={recruiterPrimary} disabled={busy} onClick={()=>void makePublic()}>{busy?"Updating…":"Make public"}</button></>}><div className="grid gap-3 text-sm leading-6 text-ink"><p><strong>{job.title}</strong> will become visible on SapienWorx and can be shared externally.</p><p>Anyone with the public link may be able to view the job depending on platform visibility rules.</p>{error&&<p role="alert">{error}</p>}</div></RecruiterModal>
  </div>;
}
