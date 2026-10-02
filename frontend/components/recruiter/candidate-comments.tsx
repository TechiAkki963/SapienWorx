"use client";

import { useEffect, useRef, useState } from "react";
import { apiRequest } from "@/lib/api";

type Comment = { id: string; author_name: string; is_own: boolean; text: string; job_title?: string; created_at: string; updated_at: string; can_modify: boolean };
type CommentList = { items: Comment[]; page: number; total: number };

export function CandidateComments({ candidateID, jobID, applicationID, initialCount, tags = [] }: { candidateID: string; jobID?: string; applicationID?: string; initialCount?: number; tags?: string[] }) {
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
  const visibleTags = tags.slice(0, 3);
  const hiddenTagCount = Math.max(0, tags.length - visibleTags.length);

  useEffect(() => {
    if (open && dialog.current && !dialog.current.open) dialog.current.showModal();
  }, [open]);

  async function load(page = 1, filtered = jobOnly) {
    setError("");
    try {
      const query = new URLSearchParams({ page: String(page) });
      if (filtered && jobID) query.set("job_id", jobID);
      setResult(await apiRequest<CommentList>(`${path}?${query}`, { cache: "no-store" }));
    } catch { setError("Could not load recruiter notes."); }
  }

  async function post() {
    if (!draft.trim() || busy) return;
    setBusy(true); setError("");
    try {
      if (!requestID.current) requestID.current = crypto.randomUUID();
      await apiRequest(path, { method: "POST", body: JSON.stringify({ text: draft.trim(), job_id: jobID ?? "", application_id: applicationID ?? "", client_request_id: requestID.current }) });
      requestID.current = ""; setDraft(""); await load(1);
    } catch { setError("Could not add the note. Try again."); }
    finally { setBusy(false); }
  }

  async function modify(comment: Comment, method: "PATCH" | "DELETE") {
    if (busy) return;
    setBusy(true); setError("");
    try {
      await apiRequest(`${path}/${comment.id}`, { method, ...(method === "PATCH" ? { body: JSON.stringify({ text: editText.trim() }) } : {}) });
      setEditing(""); setDeleting(""); await load(result?.page ?? 1);
    } catch { setError("Could not change this note. Only your own recent notes can be changed."); }
    finally { setBusy(false); }
  }

  return <section className="min-w-0 rounded-2xl border border-line/70 bg-white p-4 sm:p-5" aria-label="Recruiter notes and tags">
    <div className="flex flex-wrap items-start justify-between gap-3">
      <div className="min-w-0">
        <div className="flex flex-wrap items-center gap-2">
          <h2 className="text-base font-bold text-navy">Recruiter&apos;s Notes</h2>
          <span className="rounded-full bg-slate-100 px-2 py-1 text-[10px] font-bold text-ink-muted">Internal</span>
        </div>
        <p className="mt-1 text-xs leading-5 text-ink-muted">Private team context. Tags stay internal and are not shown to the candidate.</p>
      </div>
      <button type="button" aria-label="Recruiter Notes" aria-expanded={open} onClick={() => { setOpen(true); if (!result) void load(); }} className="inline-flex min-h-9 shrink-0 items-center gap-1.5 rounded-lg border border-line bg-white px-3 text-xs font-bold text-indigo transition hover:bg-indigo-soft/35 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo/40">View notes<span className="rounded-full bg-slate-100 px-1.5 py-0.5 text-[10px] text-ink-muted">{result?.total ?? initialCount ?? 0}</span></button>
    </div>
    {visibleTags.length > 0 && <div className="mt-3 flex flex-wrap items-center gap-1.5 border-t border-line/60 pt-3" aria-label="Recruiter tags">
      {visibleTags.map((tag) => <span key={tag} className="inline-flex min-h-7 max-w-full items-center rounded-full border border-indigo/15 bg-indigo-soft/60 px-2.5 py-1 text-[11px] font-bold leading-none text-indigo"><span className="max-w-[12rem] truncate">{tag}</span></span>)}
      {hiddenTagCount > 0 && <span className="inline-flex min-h-7 items-center rounded-full border border-line bg-slate-50 px-2.5 py-1 text-[11px] font-bold leading-none text-ink-muted" aria-label={`${hiddenTagCount} more recruiter tags`}>+{hiddenTagCount}</span>}
    </div>}
    {open && <dialog ref={dialog} onClose={() => setOpen(false)} aria-label="Recruiter notes" className="m-auto w-[min(90vw,30rem)] max-h-[90vh] overflow-y-auto rounded-2xl border border-line bg-slate-50 p-4 text-ink shadow-2xl backdrop:bg-navy/50 max-sm:mb-0 max-sm:w-full max-sm:rounded-b-none"><div className="min-w-0"><div className="mb-2 flex items-center justify-between gap-2"><h3 className="font-bold text-navy">Recruiter&apos;s Notes</h3><button type="button" onClick={() => { dialog.current?.close(); setOpen(false); }} aria-label="Close recruiter notes" className="min-h-9 min-w-9 rounded-lg border border-line bg-white text-lg">×</button></div><p className="mb-2 text-xs leading-5 text-ink-muted">Visible to authorized recruiters in your organization. Avoid sensitive or discriminatory notes.</p>
      {jobID && <div className="mb-2 flex gap-1" role="group" aria-label="Note scope"><button type="button" onClick={() => { setJobOnly(false); void load(1, false); }} className={`min-h-9 rounded-lg px-2 text-xs font-bold ${!jobOnly ? "bg-indigo text-white" : "bg-white text-navy"}`}>All company notes</button><button type="button" onClick={() => { setJobOnly(true); void load(1, true); }} className={`min-h-9 rounded-lg px-2 text-xs font-bold ${jobOnly ? "bg-indigo text-white" : "bg-white text-navy"}`}>This job</button></div>}
      <div className="max-h-72 space-y-2 overflow-y-auto overscroll-contain" aria-label="Recruiter notes">{result?.items.map(comment => <article key={comment.id} className="min-w-0 rounded-lg border border-line bg-white p-2 text-xs"><div className="flex flex-wrap items-start justify-between gap-1"><strong className="text-navy">{comment.author_name}</strong><time className="text-ink-muted" dateTime={comment.created_at}>{new Intl.DateTimeFormat("en-IN", { dateStyle: "medium", timeStyle: "short", timeZone: "Asia/Kolkata" }).format(new Date(comment.created_at))}</time></div>{comment.job_title && <p className="mt-1 text-indigo">Job: {comment.job_title}</p>}{editing === comment.id ? <div className="mt-2 grid gap-2"><textarea value={editText} maxLength={2000} onChange={event => setEditText(event.target.value)} aria-label="Edit internal note" className="min-h-20 w-full rounded-lg border border-line p-2"/><div className="flex gap-2"><button type="button" disabled={busy || !editText.trim()} onClick={() => void modify(comment, "PATCH")} className="font-bold text-indigo">Save</button><button type="button" onClick={() => setEditing("")} className="text-ink-muted">Cancel</button></div></div> : <p className="mt-1 whitespace-pre-wrap break-words leading-5 text-ink">{comment.text}</p>}{comment.can_modify && editing !== comment.id && <div className="mt-2 flex flex-wrap gap-3">{deleting === comment.id ? <><span className="text-rose-700">Delete this note?</span><button type="button" disabled={busy} onClick={() => void modify(comment, "DELETE")} className="font-bold text-rose-700">Confirm delete</button><button type="button" onClick={() => setDeleting("")} className="text-ink-muted">Cancel</button></> : <><button type="button" onClick={() => { setEditing(comment.id); setEditText(comment.text); }} className="font-semibold text-indigo">Edit</button><button type="button" disabled={busy} onClick={() => setDeleting(comment.id)} className="font-semibold text-rose-700">Delete</button></>}</div>}</article>)}{result && !result.items.length && <p className="rounded-lg bg-white p-3 text-xs text-ink-muted">No notes yet.</p>}</div>
      {result && result.total > 10 && <div className="mt-2 flex items-center justify-between text-xs"><button type="button" disabled={result.page <= 1} onClick={() => void load(result.page - 1)} className="font-bold text-indigo disabled:opacity-40">Previous</button><span>Page {result.page}</span><button type="button" disabled={result.page * 10 >= result.total} onClick={() => void load(result.page + 1)} className="font-bold text-indigo disabled:opacity-40">Next</button></div>}
      <label className="mt-3 block text-xs font-bold text-navy">Add an internal note<textarea value={draft} onChange={event => { setDraft(event.target.value); requestID.current = ""; }} maxLength={2000} placeholder="Write an observation for your team…" className="mt-1 min-h-20 w-full rounded-lg border border-line bg-white p-2 text-sm font-normal text-ink"/></label><button type="button" disabled={busy || !draft.trim()} onClick={() => void post()} className="mt-2 min-h-10 w-full rounded-lg bg-indigo px-3 text-xs font-bold text-white disabled:opacity-50">{busy ? "Saving…" : "Add note"}</button>
      {error && <p role="alert" className="mt-2 text-xs text-rose-700">{error}</p>}
    </div></dialog>}
  </section>;
}
