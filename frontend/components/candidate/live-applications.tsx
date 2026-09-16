"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

import { Surface } from "@/components/ui/surface";
import { apiRequest } from "@/lib/api";
import { CandidateApplication, humanize, stageLabel } from "@/lib/candidate";

const terminalStages = new Set(["withdrawn", "rejected", "hired"]);

export function LiveApplications({ initialItems }: { initialItems: CandidateApplication[] }) {
  const [items, setItems] = useState(initialItems);
  const [lastSynced, setLastSynced] = useState<Date | null>(null);
  const [busyID, setBusyID] = useState<string | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;
    async function refresh() {
      try {
        const result = await apiRequest<{ items: CandidateApplication[] }>("/api/v1/candidate/applications");
        if (!cancelled) {
          setItems(result.items);
          setLastSynced(new Date());
        }
      } catch {
        // Keep the last known state visible when a background refresh fails.
      }
    }
    const timer = window.setInterval(refresh, 10000);
    return () => {
      cancelled = true;
      window.clearInterval(timer);
    };
  }, []);

  async function withdraw(applicationID: string) {
    setBusyID(applicationID);
    setError("");
    try {
      await apiRequest(`/api/v1/candidate/applications/${applicationID}/withdraw`, { method: "POST" });
      setItems((current) => current.map((item) => item.id === applicationID ? { ...item, stage: "withdrawn", updated_at: new Date().toISOString() } : item));
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not withdraw the application.");
    } finally {
      setBusyID(null);
    }
  }

  if (!items.length) {
    return <Surface className="mt-6 p-8 text-center" tone="mint"><h2 className="text-xl font-bold">Your tracker is ready.</h2><p className="mt-2 text-sm text-ink-muted">Apply to an active role and it will appear here immediately.</p></Surface>;
  }

  return (
    <div className="mt-6">
      <div className="mb-2 flex items-center justify-end gap-2 text-xs font-semibold text-ink-muted"><span className="h-2 w-2 rounded-full bg-emerald-500" />Live sync every 10 seconds{lastSynced ? ` · ${lastSynced.toLocaleTimeString("en-IN")}` : ""}</div>
      {error && <p role="alert" className="mb-3 rounded-xl border border-red-100 bg-red-50 px-3 py-2.5 text-sm font-semibold text-red-700">{error}</p>}
      <Surface className="overflow-x-auto">
        <table className="w-full min-w-[60rem] text-left text-sm">
          <thead className="border-b border-line/70 bg-indigo-soft/30 text-xs uppercase tracking-wide text-ink-muted"><tr><th className="px-5 py-4">Role</th><th className="px-5 py-4">Company</th><th className="px-5 py-4">Work mode</th><th className="px-5 py-4">Current stage</th><th className="px-5 py-4">Last change</th><th className="px-5 py-4">Applied</th><th className="px-5 py-4">Action</th></tr></thead>
          <tbody className="divide-y divide-line/60">{items.map((item) => {
            const canWithdraw = !terminalStages.has(item.stage);
            return <tr key={item.id} className="hover:bg-indigo-soft/20"><td className="px-5 py-4 font-bold"><Link className="hover:text-indigo hover:underline" href={`/candidate/jobs/${item.job_id}`}>{item.job_title}</Link></td><td className="px-5 py-4 text-ink-muted">{item.company_name}</td><td className="px-5 py-4 text-ink-muted">{humanize(item.work_mode)}</td><td className="px-5 py-4"><span className="rounded-full bg-indigo-soft/70 px-3 py-1 text-xs font-bold text-indigo">{stageLabel(item.stage)}</span></td><td className="px-5 py-4 text-ink-muted">{new Date(item.updated_at).toLocaleString("en-IN")}</td><td className="px-5 py-4 text-ink-muted">{new Date(item.applied_at).toLocaleDateString("en-IN")}</td><td className="px-5 py-4">{canWithdraw ? <button type="button" disabled={busyID === item.id} onClick={() => withdraw(item.id)} className="rounded-lg border border-red-200 px-3 py-1.5 text-xs font-bold text-red-700 transition hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-50">{busyID === item.id ? "Withdrawing…" : "Withdraw"}</button> : <span className="text-xs font-semibold text-ink-muted">—</span>}</td></tr>;
          })}</tbody>
        </table>
      </Surface>
    </div>
  );
}
