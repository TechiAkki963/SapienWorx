"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

import { apiRequest } from "@/lib/api";
import { EditableRecruiterJob } from "@/lib/recruiter";

export function DuplicateJobButton({ jobId }: { jobId: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function duplicate() {
    setBusy(true);
    setError("");
    try {
      const copy = await apiRequest<EditableRecruiterJob>(`/api/v1/recruiter/jobs/${jobId}/duplicate`, { method: "POST" });
      router.push(`/recruiter/jobs/${copy.id}/edit`);
      router.refresh();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not duplicate this job.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="grid gap-1">
      <button type="button" disabled={busy} onClick={duplicate} className="rounded-xl border border-line bg-white px-4 py-2.5 text-sm font-bold text-ink shadow-sm transition hover:border-indigo/30 hover:text-indigo disabled:opacity-60">
        {busy ? "Duplicating…" : "Duplicate job"}
      </button>
      {error && <span role="alert" className="max-w-48 text-xs font-semibold text-rose-700">{error}</span>}
    </div>
  );
}
