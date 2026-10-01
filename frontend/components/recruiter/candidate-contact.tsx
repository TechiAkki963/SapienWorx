"use client";

import { useRef, useState } from "react";
import { apiRequest } from "@/lib/api";

type Contact = { primary?: string; alternate?: string };

export function CandidateContact({
  candidateID,
  maskedContact,
  compact = false,
}: {
  candidateID: string;
  maskedContact?: string;
  compact?: boolean;
}) {
  const [contact, setContact] = useState<Contact | null>(null);
  const [selected, setSelected] = useState(0);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const pending = useRef<Promise<Contact | null> | null>(null);

  const values = (value: Contact | null) => [value?.primary, value?.alternate].filter((number): number is string => !!number);
  const numbers = values(contact);
  const current = numbers[selected] ?? "";

  async function loadContact() {
    if (contact) return contact;
    if (pending.current) return pending.current;
    setBusy(true);
    setMessage("");
    pending.current = apiRequest<Contact>(`/api/v1/recruiter/candidates/${candidateID}/contact`, { cache: "no-store" })
      .then((result) => {
        setContact(result);
        setSelected(0);
        return result;
      })
      .catch(() => {
        setMessage("Contact is unavailable. The candidate may not have enabled sharing.");
        return null;
      })
      .finally(() => {
        setBusy(false);
        pending.current = null;
      });
    return pending.current;
  }

  async function reveal() {
    await loadContact();
  }

  async function copyNumber(number: string, copiedMessage = "Contact copied.") {
    if (!number) return;
    try {
      await navigator.clipboard.writeText(number);
      setMessage(copiedMessage);
    } catch {
      setMessage("Could not copy. Please use the visible number.");
    }
  }

  async function revealAndCopy() {
    const result = contact ?? await loadContact();
    const list = values(result);
    const number = list[selected] ?? list[0] ?? "";
    if (number) await copyNumber(number);
  }

  if (!compact) {
    if (!contact) {
      return (
        <div className="min-w-0">
          <button type="button" onClick={() => void reveal()} disabled={busy} aria-label="View Contact" className="flex min-h-11 w-full items-center gap-2 rounded-lg border border-[#e2eaf5] px-2 py-1.5 text-left text-xs font-bold text-navy hover:border-blue-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo/40">
            <span aria-hidden="true" className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-emerald-50 text-emerald-600">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="h-5 w-5"><path d="M6.5 3h3l1.2 4-1.8 1.5a15 15 0 0 0 6.6 6.6l1.5-1.8 4 1.2v3c0 1-.8 1.8-1.8 1.8C10 20.3 3.7 14 3.7 5.2 3.7 4 4.7 3h1.8Z" /></svg>
            </span>
            <span className="min-w-0 flex-1">{busy ? "Checking access…" : "View Contact"}<span className="block text-[10px] font-normal text-[#526990]">Available only with candidate consent</span></span>
            <span aria-hidden="true" className="text-lg font-normal text-[#526990]">⌄</span>
          </button>
          {message && <p role="status" className="mt-1 text-xs text-ink-muted">{message}</p>}
        </div>
      );
    }

    return (
      <div className="rounded-xl border border-line bg-slate-50 p-2 text-sm">
        <p className="text-[10px] font-bold uppercase tracking-wider text-ink-muted">{selected === 0 ? "Primary contact" : "Alternate contact"}</p>
        <div className="mt-1 flex flex-wrap items-center gap-1">
          <button type="button" title="Double-click to copy" onDoubleClick={() => void copyNumber(current, "Number copied.")} className="mr-auto min-h-9 break-all rounded px-1 font-bold text-navy focus-visible:ring-2 focus-visible:ring-indigo">{current}</button>
          {numbers.length > 1 && <div className="flex gap-1"><button type="button" aria-label="Show primary contact" onClick={() => setSelected(0)} disabled={selected === 0} className="min-h-9 min-w-9 rounded border border-line bg-white disabled:opacity-40">↑</button><button type="button" aria-label="Show alternate contact" onClick={() => setSelected(1)} disabled={selected === 1} className="min-h-9 min-w-9 rounded border border-line bg-white disabled:opacity-40">↓</button></div>}
          <button type="button" onClick={() => void copyNumber(current, "Number copied.")} className="min-h-9 rounded border border-line bg-white px-2 font-semibold">Copy</button>
          <button type="button" onClick={() => { setContact(null); setSelected(0); setMessage(""); }} className="min-h-9 rounded border border-line bg-white px-2 font-semibold">Hide</button>
        </div>
        {message && <p role="status" className="mt-1 text-xs text-ink-muted">{message}</p>}
      </div>
    );
  }

  if (!maskedContact && !contact) {
    return <span className="text-xs font-semibold text-ink-muted">Contact private</span>;
  }

  return (
    <div className="min-w-0">
      <button
        type="button"
        onClick={(event) => {
          if (event.detail >= 2) void revealAndCopy();
          else void reveal();
        }}
        disabled={busy}
        title={contact ? "Double-click to copy" : "Single-click to reveal · double-click to reveal and copy"}
        aria-label={contact ? `Contact ${current}. Double-click to copy` : `Masked contact ${maskedContact}. Single-click to reveal; double-click to copy`}
        className="inline-flex min-h-8 max-w-full items-center gap-1.5 rounded-lg border border-line/70 bg-white px-2.5 text-xs font-bold text-navy transition hover:border-indigo/25 hover:bg-indigo-soft/25 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo/35"
      >
        <svg aria-hidden="true" viewBox="0 0 24 24" className="h-3.5 w-3.5 shrink-0 fill-none stroke-current stroke-[1.8]">
          <path d="M6.5 3h3l1.2 4-1.8 1.5a15 15 0 0 0 6.6 6.6l1.5-1.8 4 1.2v3c0 1-.8 1.8-1.8 1.8C10 20.3 3.7 14 3.7 5.2 3.7 4 4.7 3h1.8Z" />
        </svg>
        <span className="truncate">{busy ? "Checking…" : contact ? current : maskedContact}</span>
      </button>
      {message && <p role="status" className="mt-1 text-[10px] text-ink-muted">{message}</p>}
    </div>
  );
}
