"use client";

import { useState } from "react";

import { apiRequest } from "@/lib/api";

export function SaveProfileButton({ candidateID, initialSaved, compact = false }: { candidateID: string; initialSaved: boolean; compact?: boolean }) {
  const [saved, setSaved] = useState(initialSaved);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function toggle() {
    if (busy) return;
    setBusy(true);
    setError("");
    try {
      if (saved) {
        await apiRequest(`/api/v1/recruiter/talent-pool/${candidateID}`, { method: "DELETE" });
        setSaved(false);
      } else {
        await apiRequest(`/api/v1/recruiter/talent-pool/${candidateID}`, {
          method: "PUT",
          body: JSON.stringify({ tags: [] }),
        });
        setSaved(true);
      }
    } catch {
      setError("Could not update saved profiles.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="grid gap-1">
      <button
        type="button"
        aria-pressed={saved}
        aria-label={saved ? "Remove from saved profiles" : "Save candidate profile"}
        title={saved ? "Saved profile" : "Save profile"}
        disabled={busy}
        onClick={() => void toggle()}
        className={`inline-flex min-h-10 items-center justify-center gap-2 rounded-xl border px-3 text-sm font-bold transition ${compact ? "max-sm:w-10 max-sm:px-0" : ""} focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo/35 focus-visible:ring-offset-2 disabled:cursor-wait disabled:opacity-60 ${saved ? "border-indigo/25 bg-indigo-soft/60 text-indigo" : "border-line bg-white text-navy hover:border-indigo/25 hover:bg-indigo-soft/30"}`}
      >
        <svg aria-hidden="true" viewBox="0 0 24 24" className={`h-[17px] w-[17px] stroke-current stroke-[1.9] ${saved ? "fill-current" : "fill-none"}`}>
          <path d="M7 4.5h10a1 1 0 0 1 1 1v15l-6-3.6-6 3.6v-15a1 1 0 0 1 1-1Z" />
        </svg>
        <span className={compact ? "max-sm:sr-only" : ""}>{busy ? "Saving…" : saved ? "Saved" : "Save"}</span>
      </button>
      {error && <p role="alert" className="text-[11px] font-semibold text-rose-700">{error}</p>}
    </div>
  );
}
