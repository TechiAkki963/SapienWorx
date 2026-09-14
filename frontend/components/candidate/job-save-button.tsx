"use client";

import { useState } from "react";

import { apiRequest } from "@/lib/api";

export function JobSaveButton({ jobId, initialSaved = false }: { jobId: string; initialSaved?: boolean }) {
  const [saved, setSaved] = useState(initialSaved);
  const [busy, setBusy] = useState(false);

  async function toggle() {
    if (busy) return;
    setBusy(true);
    try {
      await apiRequest(`/api/v1/candidate/saved-jobs/${jobId}`, { method: saved ? "DELETE" : "PUT" });
      setSaved((value) => !value);
    } finally {
      setBusy(false);
    }
  }

  return (
    <button
      type="button"
      onClick={toggle}
      disabled={busy}
      aria-pressed={saved}
      aria-label={saved ? "Remove from saved jobs" : "Save job"}
      className="relative z-10 inline-flex items-center gap-1.5 rounded-lg px-2 py-1.5 text-xs font-bold text-ink-muted transition hover:bg-blue-50 hover:text-indigo disabled:opacity-60"
    >
      <svg aria-hidden="true" viewBox="0 0 24 24" className={`h-4 w-4 stroke-current stroke-[1.8] ${saved ? "fill-indigo text-indigo" : "fill-none"}`}>
        <path d="M6.5 4.5h11v15l-5.5-3.6-5.5 3.6z" />
      </svg>
      {busy ? "Saving…" : saved ? "Saved" : "Save"}
    </button>
  );
}
