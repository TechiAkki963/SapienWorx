"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";

import { apiRequest } from "@/lib/api";

function ActionButton({ children, className = "", disabled = false }: { children: React.ReactNode; className?: string; disabled?: boolean }) {
  return <button type="submit" disabled={disabled} className={`rounded-lg px-3 py-2 text-xs font-bold transition disabled:cursor-not-allowed disabled:opacity-50 ${className}`}>{children}</button>;
}

export function VerificationActions({ verificationID }: { verificationID: string }) {
  const router = useRouter();
  const [pending, setPending] = useState<"approve" | "reject" | "">("");
  const [error, setError] = useState("");

  async function run(decision: "approve" | "reject") {
    const notes = window.prompt(decision === "approve" ? "Optional approval note" : "Reason for rejection");
    if (decision === "reject" && (!notes || notes.trim().length < 5)) return;
    setPending(decision);
    setError("");
    try {
      await apiRequest(`/api/v1/admin/company-verifications/${verificationID}/${decision}`, { method: "POST", body: JSON.stringify({ notes: notes ?? "" }) });
      router.refresh();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Action failed.");
    } finally {
      setPending("");
    }
  }

  return <div className="flex flex-wrap items-center gap-2"><button onClick={() => run("approve")} disabled={!!pending} className="rounded-lg bg-emerald-600 px-3 py-2 text-xs font-bold text-white transition hover:bg-emerald-700 disabled:opacity-50">{pending === "approve" ? "Approving…" : "Approve"}</button><button onClick={() => run("reject")} disabled={!!pending} className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs font-bold text-red-700 transition hover:bg-red-100 disabled:opacity-50">{pending === "reject" ? "Rejecting…" : "Reject"}</button>{error && <span className="text-xs text-red-600">{error}</span>}</div>;
}

export function VerificationDocumentButton({ verificationID, available }: { verificationID: string; available: boolean }) {
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");

  async function openDocument() {
    setPending(true);
    setError("");
    try {
      const response = await apiRequest<{ url: string }>(`/api/v1/admin/company-verifications/${verificationID}/document`);
      window.open(response.url, "_blank", "noopener,noreferrer");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Document unavailable.");
    } finally {
      setPending(false);
    }
  }

  if (!available) return <span className="text-xs text-slate-400">No document</span>;
  return <div className="grid gap-1"><button type="button" onClick={openDocument} disabled={pending} className="rounded-lg border border-indigo-200 bg-indigo-50 px-3 py-2 text-xs font-bold text-indigo-700 transition hover:bg-indigo-100 disabled:opacity-50">{pending ? "Opening…" : "View document"}</button>{error && <span className="max-w-40 text-[10px] text-red-600">{error}</span>}</div>;
}

export function UserModerationActions({ userID, disabled = false }: { userID: string; disabled?: boolean }) {
  const router = useRouter();
  const [busy, setBusy] = useState("");
  const [error, setError] = useState("");

  async function moderate(action: "suspend" | "force-password-reset") {
    const reason = window.prompt(action === "suspend" ? "Reason for suspension" : "Reason for forced password reset");
    if (!reason || reason.trim().length < 5) return;
    setBusy(action);
    setError("");
    try {
      await apiRequest(`/api/v1/admin/users/${userID}/${action}`, { method: "POST", body: JSON.stringify({ reason }) });
      router.refresh();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Moderation failed.");
    } finally {
      setBusy("");
    }
  }

  return <div className="flex flex-wrap items-center gap-2"><button disabled={disabled || !!busy} onClick={() => moderate("suspend")} className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs font-bold text-amber-800 hover:bg-amber-100 disabled:opacity-40">{busy === "suspend" ? "Suspending…" : "Suspend"}</button><button disabled={disabled || !!busy} onClick={() => moderate("force-password-reset")} className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-bold text-slate-700 hover:bg-slate-50 disabled:opacity-40">{busy === "force-password-reset" ? "Resetting…" : "Force reset"}</button>{error && <span className="text-xs text-red-600">{error}</span>}</div>;
}

export function JobTakedownButton({ jobID, disabled = false }: { jobID: string; disabled?: boolean }) {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState("");

  async function run() {
    const reason = window.prompt("Reason for job takedown");
    if (!reason || reason.trim().length < 5) return;
    setPending(true);
    setMessage("");
    try {
      await apiRequest(`/api/v1/admin/jobs/${jobID}/takedown`, { method: "POST", body: JSON.stringify({ reason }) });
      router.refresh();
    } catch (cause) {
      setMessage(cause instanceof Error ? cause.message : "Takedown failed.");
    } finally {
      setPending(false);
    }
  }

  return <div className="grid gap-1"><button type="button" disabled={disabled || pending} onClick={run} className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs font-bold text-red-700 hover:bg-red-100 disabled:opacity-40">{pending ? "Taking down…" : "Takedown"}</button>{message && <span className="max-w-44 text-[10px] text-red-600">{message}</span>}</div>;
}

export function BudgetSettingsForm({ warningCount, criticalCount }: { warningCount: number; criticalCount: number }) {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState("");

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    const warning = Number(data.get("warning_count"));
    const critical = Number(data.get("critical_count"));
    if (!Number.isFinite(warning) || !Number.isFinite(critical) || warning < 0 || critical <= warning) {
      setMessage("Critical threshold must be greater than warning threshold.");
      return;
    }
    setPending(true);
    setMessage("");
    try {
      await apiRequest("/api/v1/admin/budget-settings", { method: "PATCH", body: JSON.stringify({ sns_sms_warning_count: warning, sns_sms_critical_count: critical }) });
      setMessage("Budget guardrails updated.");
      router.refresh();
    } catch (cause) {
      setMessage(cause instanceof Error ? cause.message : "Could not update settings.");
    } finally {
      setPending(false);
    }
  }

  return <form onSubmit={submit} className="grid gap-3 sm:grid-cols-[1fr_1fr_auto]"><label className="grid gap-1 text-xs font-bold text-slate-600">Warning threshold<input name="warning_count" type="number" min="0" defaultValue={warningCount} className="h-10 rounded-xl border border-slate-200 bg-white px-3 text-sm font-medium text-slate-900 outline-none focus:border-indigo-300 focus:ring-3 focus:ring-indigo-100"/></label><label className="grid gap-1 text-xs font-bold text-slate-600">Critical threshold<input name="critical_count" type="number" min="1" defaultValue={criticalCount} className="h-10 rounded-xl border border-slate-200 bg-white px-3 text-sm font-medium text-slate-900 outline-none focus:border-indigo-300 focus:ring-3 focus:ring-indigo-100"/></label><div className="flex items-end"><ActionButton disabled={pending} className="h-10 bg-[#4656cf] text-white hover:bg-[#3948bd]">{pending ? "Saving…" : "Save guardrails"}</ActionButton></div>{message && <p className="sm:col-span-3 text-xs text-slate-600">{message}</p>}</form>;
}
