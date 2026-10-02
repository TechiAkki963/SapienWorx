"use client";

import { useRef, useState } from "react";

import { apiRequest } from "@/lib/api";

type Contact = { primary?: string; alternate?: string };

export function CandidateContact({
  candidateID,
  maskedPhone,
  compact = false,
}: {
  candidateID: string;
  maskedPhone?: string;
  compact?: boolean;
}) {
  const [contact, setContact] = useState<Contact | null>(null);
  const [selected, setSelected] = useState(0);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const clickTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const numbers = [contact?.primary, contact?.alternate].filter((number): number is string => !!number);
  const current = numbers[selected] ?? "";

  async function loadContact() {
    setBusy(true);
    setMessage("");
    try {
      const result = await apiRequest<Contact>(`/api/v1/recruiter/candidates/${candidateID}/contact`, { cache: "no-store" });
      setContact(result);
      setSelected(0);
      return result;
    } catch {
      setMessage("Contact is unavailable. The candidate may not have enabled sharing.");
      return null;
    } finally {
      setBusy(false);
    }
  }

  async function copy(number = current) {
    if (!number) return;
    try {
      await navigator.clipboard.writeText(number);
      setMessage("Number copied.");
    } catch {
      setMessage("Could not copy. Please use the visible number.");
    }
  }

  function onSingleClick() {
    if (clickTimer.current) clearTimeout(clickTimer.current);
    clickTimer.current = setTimeout(() => {
      clickTimer.current = null;
      if (!contact) void loadContact();
    }, 220);
  }

  async function onDoubleClick() {
    if (clickTimer.current) {
      clearTimeout(clickTimer.current);
      clickTimer.current = null;
    }
    if (current) {
      await copy(current);
      return;
    }
    const result = await loadContact();
    const number = result?.primary ?? result?.alternate ?? "";
    if (number) await copy(number);
  }

  if (compact) {
    const label = contact ? current : maskedPhone ? "••••••••••" : "Contact unavailable";
    return (
      <div className="min-w-0">
        <button
          type="button"
          onClick={onSingleClick}
          onDoubleClick={() => void onDoubleClick()}
          disabled={busy || (!contact && !maskedPhone)}
          aria-label={contact ? `Phone ${current}. Double click to copy` : "Hidden phone number. Click once to show. Double click to copy"}
          title={contact ? "Double-click to copy" : "Click once to show · double-click to copy"}
          className="inline-flex min-h-8 max-w-full items-center gap-1.5 rounded-lg border border-line/70 bg-white px-2.5 py-1 text-xs font-bold text-navy transition hover:border-indigo/30 hover:bg-indigo-soft/25 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo/35 disabled:cursor-not-allowed disabled:opacity-55"
        >
          <svg aria-hidden="true" viewBox="0 0 24 24" className="h-3.5 w-3.5 shrink-0 fill-none stroke-current stroke-[1.8]">
            <path d="M6.5 3h3l1.2 4-1.8 1.5a15 15 0 0 0 6.6 6.6l1.5-1.8 4 1.2v3c0 1-.8 1.8-1.8 1.8C10 20.3 3.7 14 3.7 5.2 3.7 4 4.7 3h1.8Z" />
          </svg>
          <span className="truncate">{busy ? "Checking…" : label}</span>
        </button>
        {message && <p role="status" className="mt-1 text-[10px] leading-4 text-ink-muted">{message}</p>}
      </div>
    );
  }

  if (!contact) return (
    <div className="min-w-0">
      <button type="button" onClick={() => void loadContact()} disabled={busy} aria-label="View Contact" className="flex min-h-11 w-full items-center gap-2 rounded-lg border border-[#e2eaf5] px-2 py-1.5 text-left text-xs font-bold text-navy hover:border-blue-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo/40">
        <span aria-hidden="true" className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-emerald-50 text-emerald-600">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="h-5 w-5"><path d="M6.5 3h3l1.2 4-1.8 1.5a15 15 0 0 0 6.6 6.6l1.5-1.8 4 1.2v3c0 1-.8 1.8-1.8 1.8C10 20.3 3.7 14 3.7 5.2 3.7 4 4.7 3h1.8Z" /></svg>
        </span>
        <span className="min-w-0 flex-1">{busy ? "Checking access…" : "View Contact"}<span className="block text-[10px] font-normal text-[#526990]">Available only with candidate consent</span></span>
        <span aria-hidden="true" className="text-lg font-normal text-[#526990]">⌄</span>
      </button>
      {message && <p role="status" className="mt-1 text-xs text-ink-muted">{message}</p>}
    </div>
  );

  return (
    <div className="rounded-xl border border-line bg-slate-50 p-2 text-sm">
      <p className="text-[10px] font-bold uppercase tracking-wider text-ink-muted">{selected === 0 ? "Primary contact" : "Alternate contact"}</p>
      <div className="mt-1 flex flex-wrap items-center gap-1">
        <button type="button" title="Double-click to copy" onDoubleClick={() => void copy()} className="mr-auto min-h-9 break-all rounded px-1 font-bold text-navy focus-visible:ring-2 focus-visible:ring-indigo">{current}</button>
        {numbers.length > 1 && (
          <div className="flex gap-1">
            <button type="button" aria-label="Show primary contact" onClick={() => setSelected(0)} disabled={selected === 0} className="min-h-9 min-w-9 rounded border border-line bg-white disabled:opacity-40">↑</button>
            <button type="button" aria-label="Show alternate contact" onClick={() => setSelected(1)} disabled={selected === 1} className="min-h-9 min-w-9 rounded border border-line bg-white disabled:opacity-40">↓</button>
          </div>
        )}
        <button type="button" onClick={() => void copy()} className="min-h-9 rounded border border-line bg-white px-2 font-semibold">Copy</button>
        <button type="button" onClick={() => { setContact(null); setMessage(""); }} className="min-h-9 rounded border border-line bg-white px-2 font-semibold">Hide</button>
      </div>
      {message && <p role="status" className="mt-1 text-xs text-ink-muted">{message}</p>}
    </div>
  );
}
