"use client";

import Link from "next/link";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { apiRequest } from "@/lib/api";
import { type RecruiterJob, type RecruiterTeamMember, type BulkJobActionResult, jobStatusTransitions, label } from "@/lib/recruiter";
import { JobShareMenu } from "./job-share-menu";
import { RecruiterDrawer, recruiterPrimary, recruiterSecondary, recruiterInput } from "./workspace-ui";

export function JobActions({ job, team, compact = false }: { job: RecruiterJob; team: RecruiterTeamMember[]; compact?: boolean }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [owner, setOwner] = useState("");
  const updated = new Date(job.updated_at);
  const updatedLabel = Number.isNaN(updated.getTime()) ? "Unavailable" : new Intl.DateTimeFormat("en-GB", { dateStyle: "medium", timeStyle: "short", timeZone: "Asia/Kolkata" }).format(updated) + " IST";

  async function run(action: string) {
    if (busy) return;
    if (["closed", "archived"].includes(action) && !window.confirm(`${label(action)} this job? New applications will stop. Existing applications remain available.`)) return;
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
      } else {
        await apiRequest(`/api/v1/recruiter/jobs/${job.id}/status`, { method: "PATCH", body: JSON.stringify({ status: action }) });
        router.refresh();
      }
      setOpen(false);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not update job.");
    } finally {
      setBusy(false);
    }
  }

  return <div className="flex flex-wrap gap-2">
    {!compact && <Link className={`${recruiterPrimary} whitespace-nowrap !px-2 !text-xs`} href={`/recruiter/jobs/${job.id}/applicants`}>View applicants</Link>}
    <button className={`${recruiterSecondary} ${compact ? "w-10 !px-0" : ""}`} aria-label={`More actions for ${job.title}`} onClick={() => setOpen(true)}>⋯</button>
    <RecruiterDrawer open={open} onClose={() => { if (!busy) setOpen(false); }} title={job.title}>
      <div className="grid gap-3">
        <dl className="grid gap-2 border-b border-line pb-4 text-xs">
          <div><dt className="text-ink-muted">Job ID</dt><dd className="mt-1 text-ink">{job.job_reference}</dd></div>
          <div><dt className="text-ink-muted">Owner</dt><dd className="mt-1 text-ink">{job.owner_name || "Not specified"}</dd></div>
          <div><dt className="text-ink-muted">Updated</dt><dd className="mt-1 text-ink">{Number.isNaN(updated.getTime()) ? updatedLabel : <time dateTime={job.updated_at}>{updatedLabel}</time>}</dd></div>
        </dl>
        <Link className={recruiterSecondary} href={`/recruiter/jobs/${job.id}/edit`}>Edit job</Link>
        <Link className={recruiterSecondary} href={`/recruiter/jobs/${job.id}/analytics`}>View analytics</Link>
        {job.status === "active" && job.visibility === "public" ? <>
          <Link href={`/jobs/${job.id}`} target="_blank" rel="noopener noreferrer" className={recruiterSecondary}>Preview public listing</Link>
          <JobShareMenu jobId={job.id} title={job.title} active />
        </> : <p className="text-xs text-ink-muted">Public sharing is available after publishing a public job.</p>}
        <button className={recruiterSecondary} disabled={busy} onClick={() => void run("duplicate")}>Duplicate job as draft</button>
        <label className="grid gap-1 text-xs font-semibold text-ink-muted">Assign recruiter
          <select aria-label="Assign recruiter" className={recruiterInput} value={owner} onChange={event => setOwner(event.target.value)}>
            <option value="">Choose company recruiter</option>
            {team.map(member => <option key={member.user_id} value={member.user_id}>{member.full_name}</option>)}
          </select>
        </label>
        <button className={recruiterSecondary} disabled={busy || !owner} onClick={() => void run("assign")}>Assign selected recruiter</button>
        {(jobStatusTransitions[job.status] || []).filter(value => value !== job.status).map(value => <button disabled={busy} key={value} className={recruiterSecondary} onClick={() => void run(value)}>{label(value)} job</button>)}
        {error && <p role="alert" className="text-sm text-rose-700">{error}</p>}
      </div>
    </RecruiterDrawer>
  </div>;
}
