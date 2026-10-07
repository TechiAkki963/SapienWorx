"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import { apiRequest } from "@/lib/api";
import type { MessagingThread } from "@/lib/messaging";
import { experience, label, type PipelineList, type RecruiterCandidateDetail } from "@/lib/recruiter";

export function RecruiterConversationContext({ thread }: { thread: MessagingThread }) {
  const [context,setContext] = useState<{ profile: RecruiterCandidateDetail; applications: PipelineList } | null>(null);
  const [error,setError] = useState("");
  useEffect(() => {
    const abort = new AbortController(); setContext(null); setError("");
    const id = encodeURIComponent(thread.candidate_id);
    Promise.all([
      apiRequest<RecruiterCandidateDetail>(`/api/v1/recruiter/candidates/${id}`, {signal:abort.signal}),
      apiRequest<PipelineList>(`/api/v1/recruiter/pipeline?candidate_id=${id}&limit=10${thread.job_id ? `&job_id=${encodeURIComponent(thread.job_id)}` : ""}`, {signal:abort.signal}),
    ]).then(([profile,applications]) => { if(!abort.signal.aborted)setContext({profile,applications}); }).catch(() => { if(!abort.signal.aborted)setError("Candidate context is unavailable. You can continue this authorized conversation."); });
    return () => abort.abort();
  }, [thread.candidate_id,thread.job_id]);
  return <section aria-label="Candidate conversation context" className="grid content-start gap-4 p-4">
    <div><h2 className="text-sm font-semibold text-navy">Candidate context</h2><p className="mt-3 break-words text-base font-semibold text-ink">{thread.counterparty_name}</p><p className="mt-1 text-xs leading-6 text-ink-muted">{thread.job_title || "Direct conversation"}</p></div>
    {error ? <p role="status" className="text-xs leading-6 text-ink-muted">{error}</p> : !context ? <p role="status" className="text-xs text-ink-muted">Loading authorized profile…</p> : <><p className="text-sm leading-6 text-ink-muted">{context.profile.headline}</p><p className="text-xs leading-6 text-ink-muted">{experience(context.profile.total_experience_months)} · {context.profile.current_city || "Location not provided"}</p><Link href={`/recruiter/candidates/${encodeURIComponent(thread.candidate_id)}${thread.job_id ? `?job_id=${encodeURIComponent(thread.job_id)}` : ""}`} className="min-h-11 content-center text-sm font-semibold text-indigo">View profile</Link><dl className="grid gap-3">{context.applications.items.map(application => <div key={application.application_id}><dt className="text-xs text-ink-muted">{application.job_title}</dt><dd className="mt-1 text-sm font-semibold text-ink">{label(application.stage)}</dd></div>)}</dl>{thread.job_id && <Link href={`/recruiter/interviews?job_id=${encodeURIComponent(thread.job_id)}`} className="min-h-11 content-center text-xs font-semibold text-indigo">View interviews for this job</Link>}</>}
  </section>;
}
