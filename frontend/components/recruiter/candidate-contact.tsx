"use client";

import { useState } from "react";
import { apiRequest } from "@/lib/api";

type Contact = { primary?: string; alternate?: string };

export function CandidateContact({ candidateID }: { candidateID: string }) {
  const [contact, setContact] = useState<Contact | null>(null);
  const [selected, setSelected] = useState(0);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const numbers = [contact?.primary, contact?.alternate].filter((number): number is string => !!number);
  const current = numbers[selected] ?? "";

  async function reveal() {
    setBusy(true); setMessage("");
    try {
      const result = await apiRequest<Contact>(`/api/v1/recruiter/candidates/${candidateID}/contact`, { cache: "no-store" });
      setContact(result); setSelected(0);
    } catch {
      setMessage("Contact is unavailable. The candidate may not have enabled sharing.");
    } finally { setBusy(false); }
  }

  async function copy() {
    if (!current) return;
    try { await navigator.clipboard.writeText(current); setMessage("Number copied."); }
    catch { setMessage("Could not copy. Please use the visible number."); }
  }

  if (!contact) return <div className="min-w-0"><button type="button" onClick={() => void reveal()} disabled={busy} aria-label="View Contact" className="flex min-h-11 w-full items-center gap-2 rounded-lg border border-[#e2eaf5] px-2 py-1.5 text-left text-xs font-bold text-navy hover:border-blue-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo/40"><span aria-hidden="true" className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-emerald-50 text-emerald-600"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="h-5 w-5"><path d="M6.5 3h3l1.2 4-1.8 1.5a15 15 0 0 0 6.6 6.6l1.5-1.8 4 1.2v3c0 1-.8 1.8-1.8 1.8C10 20.3 3.7 14 3.7 5.2 3.7 4 4.7 3h1.8Z" /></svg></span><span className="min-w-0 flex-1">{busy ? "Checking access…" : "View Contact"}<span className="block text-[10px] font-normal text-[#526990]">Available only with candidate consent</span></span><span aria-hidden="true" className="text-lg font-normal text-[#526990]">⌄</span></button>{message && <p role="status" className="mt-1 text-xs text-ink-muted">{message}</p>}</div>;

  return <div className="rounded-xl border border-line bg-slate-50 p-2 text-sm">
    <p className="text-[10px] font-bold uppercase tracking-wider text-ink-muted">{selected === 0 ? "Primary contact" : "Alternate contact"}</p>
    <div className="mt-1 flex flex-wrap items-center gap-1">
      <button type="button" title="Double-click to copy" onDoubleClick={() => void copy()} className="mr-auto min-h-9 break-all rounded px-1 font-bold text-navy focus-visible:ring-2 focus-visible:ring-indigo">{current}</button>
      {numbers.length > 1 && <div className="flex gap-1"><button type="button" aria-label="Show primary contact" onClick={() => setSelected(0)} disabled={selected === 0} className="min-h-9 min-w-9 rounded border border-line bg-white disabled:opacity-40">↑</button><button type="button" aria-label="Show alternate contact" onClick={() => setSelected(1)} disabled={selected === 1} className="min-h-9 min-w-9 rounded border border-line bg-white disabled:opacity-40">↓</button></div>}
      <button type="button" onClick={() => void copy()} className="min-h-9 rounded border border-line bg-white px-2 font-semibold">Copy</button>
      <button type="button" onClick={() => { setContact(null); setMessage(""); }} className="min-h-9 rounded border border-line bg-white px-2 font-semibold">Hide</button>
    </div>
    {message && <p role="status" className="mt-1 text-xs text-ink-muted">{message}</p>}
  </div>;
}
