"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

import { apiRequest } from "@/lib/api";

export function TrustRiskActions({ flagID }: { flagID: string }) {
  const router = useRouter();
  const [note, setNote] = useState("");
  const [pending, setPending] = useState("");
  const [error, setError] = useState("");

  async function update(status: "reviewing" | "dismissed" | "escalated") {
    setPending(status);
    setError("");
    try {
      await apiRequest(`/api/v1/admin/trust/risk-flags/${flagID}`, {
        method: "PATCH",
        body: JSON.stringify({ status, note: note.trim() }),
      });
      setNote("");
      router.refresh();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Review could not be updated.");
    } finally {
      setPending("");
    }
  }

  return (
    <div className="mt-4 border-t border-slate-100 pt-4">
      <label className="grid gap-1.5 text-xs font-bold text-slate-700">
        Review note
        <textarea value={note} onChange={(event) => setNote(event.target.value)} maxLength={2000} placeholder="Record the evidence reviewed or the reason for escalation/dismissal." className="min-h-20 w-full resize-y rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-normal text-slate-800 outline-none focus:border-indigo-300 focus:ring-2 focus:ring-indigo-100" />
      </label>
      {error && <p role="alert" className="mt-2 rounded-lg bg-red-50 px-3 py-2 text-xs text-red-700">{error}</p>}
      <div className="mt-3 flex flex-wrap gap-2">
        <button type="button" disabled={Boolean(pending)} onClick={() => void update("reviewing")} className="min-h-10 rounded-lg border border-slate-200 bg-white px-3 text-xs font-bold text-slate-700 disabled:opacity-50">{pending === "reviewing" ? "Saving…" : "Mark reviewing"}</button>
        <button type="button" disabled={Boolean(pending)} onClick={() => void update("dismissed")} className="min-h-10 rounded-lg border border-slate-200 bg-white px-3 text-xs font-bold text-slate-700 disabled:opacity-50">{pending === "dismissed" ? "Saving…" : "Dismiss signal"}</button>
        <button type="button" disabled={Boolean(pending)} onClick={() => void update("escalated")} className="min-h-10 rounded-lg bg-indigo px-3 text-xs font-bold text-white disabled:opacity-50">{pending === "escalated" ? "Saving…" : "Escalate for investigation"}</button>
      </div>
    </div>
  );
}
