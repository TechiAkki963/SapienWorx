"use client";

import { useEffect, useRef, useState } from "react";
import { apiRequest } from "@/lib/api";

type Comment = { id: string; author_name: string; is_own: boolean; text: string; job_title?: string; created_at: string; updated_at: string; can_modify: boolean };
type CommentList = { items: Comment[]; page: number; total: number };

export function CandidateComments({ candidateID, jobID, applicationID, initialCount }: { candidateID: string; jobID?: string; applicationID?: string; initialCount?: number }) {
  const [open, setOpen] = useState(false);
  const [jobOnly, setJobOnly] = useState(false);
  const [result, setResult] = useState<CommentList | null>(null);
  const [draft, setDraft] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [editing, setEditing] = useState("");
  const [deleting, setDeleting] = useState("");
  const [editText, setEditText] = useState("");
  const requestID = useRef("");
  const dialog = useRef<HTMLDialogElement>(null);
  const path = `/api/v1/recruiter/candidates/${candidateID}/comments`;

  useEffect(() => {
    if (open && dialog.current && !dialog.current.open) dialog.current.showModal();
  }, [open]);

  async function load(page = 1, filtered = jobOnly) {
    setError("");
    try {
      const query = new URLSearchParams({ page: String(page) });
      if (filtered && jobID) query.set("job_id", jobID);
      setResult(await apiRequest<CommentList>(`${path}?${query}`, { cache: "no-store" }));
    } catch { setError("Could not load internal comments."); }
  }

  async function post() {
    if (!draft.trim() || busy) return;
    setBusy(true); setError("");
    try {
      if (!requestID.current) requestID.current = crypto.randomUUID();
      await apiRequest(path, { method: "POST", body: JSON.stringify({ text: draft.trim(), job_id: jobID ?? "", application_id: applicationID ?? "", client_request_id: requestID.current }) });
      requestID.current = ""; setDraft(""); await load(1);
    } catch { setError("Could not post the comment. Try again."); }
    finally { setBusy(false); }
  }

  async function modify(comment: Comment, method: "PATCH" | "DELETE") {
    if (busy) return;
    setBusy(true); setError("");
    try {
      await apiRequest(`${path}/${comment.id}`, { method, ...(method === "PATCH" ? { body: JSON.stringify({ text: editText.trim() }) } : {}) });
      setEditing(""); setDeleting(""); await load(result?.page ?? 1);
    } catch { setError("Could not change this comment. Only your own recent notes can be changed."); }
    finally { setBusy(false); }
  }

  return <section className="min-w-0 rounded-xl border border-line bg-slate-50/70 p-2">
    <button type="button" aria-expanded={open} onClick={() => { setOpen(!open); if (!open && !result) void load(); }} className="flex min-h-10 w-full items-center justify-between gap-1 rounded-lg px-1 text-left text-xs font-bold text-navy focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo/40"><span className="whitespace-nowrap">Recruiter Comments<span className="ml-1 rounded-full bg-white px-1.5 py-0.5 text-[11px] text-ink-muted">{result?.total ?? initialCount ?? 0}</span></span><span aria-hidden="true">{open ? "▴" : "▾"}</span></button>
    {open && <dialog ref={dialog} onClose={() => setOpen(false)} aria-label="Recruiter comments" className="m-auto w-[min(90vw,30rem)] max-h-[90vh] overflow-y-auto rounded-2xl border border-line bg-slate-50 p-4 text-ink shadow-2xl backdrop:bg-navy/50 max-sm:mb-0 max-sm:w-full max-sm:rounded-b-none"><div className="min-w-0"><div className="mb-2 flex items-center justify-between gap-2"><h3 className="font-bold text-navy">Recruiter Comments</h3><button type="button" onClick={() => { dialog.current?.close(); setOpen(false); }} aria-label="Close recruiter comments" className="min-h-9 min-w-9 rounded-lg border border-line bg-white text-lg">×</button></div><p className="mb-2 text-xs leading-5 text-ink-muted">Visible to authorized recruiters in your organization. Avoid sensitive or discriminatory notes.</p>
      {jobID && <div className="mb-2 flex gap-1" role="group" aria-label="Comment scope"><button type="button" onClick={() => { setJobOnly(false); void load(1, false); }} className={`min-h-9 rounded-lg px-2 text-xs font-bold ${!jobOnly ? "bg-indigo text-white" : "bg-white text-navy"}`}>All company notes</button><button type="button" onClick={() => { setJobOnly(true); void load(1, true); }} className={`min-h-9 rounded-lg px-2 text-xs font-bold ${jobOnly ? "bg-indigo text-white" : "bg-white text-navy"}`}>This job</button></div>}
      <div className="max-h-72 space-y-2 overflow-y-auto overscroll-contain" aria-label="Recruiter comments">{result?.items.map(comment => <article key={comment.id} className="min-w-0 rounded-lg border border-line bg-white p-2 text-xs"><div className="flex flex-wrap items-start justify-between gap-1"><strong className="text-navy">{comment.author_name}</strong><time className="text-ink-muted" dateTime={comment.created_at}>{new Intl.DateTimeFormat("en-IN", { dateStyle: "medium", timeStyle: "short", timeZone: "Asia/Kolkata" }).format(new Date(comment.created_at))}</time></div>{comment.job_title && <p className="mt-1 text-indigo">Job: {comment.job_title}</p>}{editing === comment.id ? <div className="mt-2 grid gap-2"><textarea value={editText} maxLength={2000} onChange={event => setEditText(event.target.value)} aria-label="Edit internal comment" className="min-h-20 w-full rounded-lg border border-line p-2"/><div className="flex gap-2"><button type="button" disabled={busy || !editText.trim()} onClick={() => void modify(comment, "PATCH")} className="font-bold text-indigo">Save</button><button type="button" onClick={() => setEditing("")} className="text-ink-muted">Cancel</button></div></div> : <p className="mt-1 whitespace-pre-wrap break-words leading-5 text-ink">{comment.text}</p>}{comment.can_modify && editing !== comment.id && <div className="mt-2 flex flex-wrap gap-3">{deleting === comment.id ? <><span className="text-rose-700">Delete this note?</span><button type="button" disabled={busy} onClick={() => void modify(comment, "DELETE")} className="font-bold text-rose-700">Confirm delete</button><button type="button" onClick={() => setDeleting("")} className="text-ink-muted">Cancel</button></> : <><button type="button" onClick={() => { setEditing(comment.id); setEditText(comment.text); }} className="font-semibold text-indigo">Edit</button><button type="button" disabled={busy} onClick={() => setDeleting(comment.id)} className="font-semibold text-rose-700">Delete</button></>}</div>}</article>)}{result && !result.items.length && <p className="rounded-lg bg-white p-3 text-xs text-ink-muted">No comments yet.</p>}</div>
      {result && result.total > 10 && <div className="mt-2 flex items-center justify-between text-xs"><button type="button" disabled={result.page <= 1} onClick={() => void load(result.page - 1)} className="font-bold text-indigo disabled:opacity-40">Previous</button><span>Page {result.page}</span><button type="button" disabled={result.page * 10 >= result.total} onClick={() => void load(result.page + 1)} className="font-bold text-indigo disabled:opacity-40">Next</button></div>}
      <label className="mt-3 block text-xs font-bold text-navy">Add an internal comment<textarea value={draft} onChange={event => { setDraft(event.target.value); requestID.current = ""; }} maxLength={2000} placeholder="Write an observation for your team…" className="mt-1 min-h-20 w-full rounded-lg border border-line bg-white p-2 text-sm font-normal text-ink"/></label><button type="button" disabled={busy || !draft.trim()} onClick={() => void post()} className="mt-2 min-h-10 w-full rounded-lg bg-indigo px-3 text-xs font-bold text-white disabled:opacity-50">{busy ? "Saving…" : "Post comment"}</button>
      {error && <p role="alert" className="mt-2 text-xs text-rose-700">{error}</p>}
    </div></dialog>}
  </section>;
}
