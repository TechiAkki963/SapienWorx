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

  async function copy(value?: string) {
    const number = value || current;
    if (!number) return;
    try {
      await navigator.clipboard.writeText(number);
      setMessage("Contact copied.");
    } catch {
      setMessage("Could not copy. Please use the visible number.");
    }
  }

  async function revealAndCopy() {
    const result = contact ?? await loadContact();
    const list = values(result);
    const number = list[selected] ?? list[0] ?? "";
    if (number) await copy(number);
  }

  if (!maskedContact && !contact) {
    return <span className="text-xs font-semibold text-ink-muted">Contact private</span>;
  }

  return (
    <div className={compact ? "min-w-0" : "rounded-xl border border-line bg-slate-50 p-2 text-sm"}>
      <button
        type="button"
        onClick={() => void reveal()}
        onDoubleClick={() => void revealAndCopy()}
        disabled={busy}
        title={contact ? "Double-click to copy" : "Single-click to reveal · double-click to reveal and copy"}
        aria-label={contact ? `Contact ${current}. Double-click to copy` : `Masked contact ${maskedContact}. Single-click to reveal; double-click to copy`}
        className={compact
          ? "inline-flex min-h-8 max-w-full items-center gap-1.5 rounded-lg border border-line/70 bg-white px-2.5 text-xs font-bold text-navy transition hover:border-indigo/25 hover:bg-indigo-soft/25 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo/35"
          : "mr-auto min-h-9 break-all rounded px-1 font-bold text-navy focus-visible:ring-2 focus-visible:ring-indigo"}
      >
        <svg aria-hidden="true" viewBox="0 0 24 24" className="h-3.5 w-3.5 shrink-0 fill-none stroke-current stroke-[1.8]">
          <path d="M6.5 3h3l1.2 4-1.8 1.5a15 15 0 0 0 6.6 6.6l1.5-1.8 4 1.2v3c0 1-.8 1.8-1.8 1.8C10 20.3 3.7 14 3.7 5.2 3.7 4 4.7 3h1.8Z" />
        </svg>
        <span className="truncate">{busy ? "Checking…" : contact ? current : maskedContact}</span>
      </button>

      {contact && numbers.length > 1 && !compact && (
        <div className="mt-1 flex gap-1">
          <button type="button" aria-label="Show primary contact" onClick={() => setSelected(0)} disabled={selected === 0} className="min-h-9 rounded border border-line bg-white px-2 text-xs font-semibold disabled:opacity-40">Primary</button>
          <button type="button" aria-label="Show alternate contact" onClick={() => setSelected(1)} disabled={selected === 1} className="min-h-9 rounded border border-line bg-white px-2 text-xs font-semibold disabled:opacity-40">Alternate</button>
        </div>
      )}

      {message && <p role="status" className={compact ? "mt-1 text-[10px] text-ink-muted" : "mt-1 text-xs text-ink-muted"}>{message}</p>}
    </div>
  );
}
