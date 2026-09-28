"use client";

import { useRef, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { apiRequest, APIRequestError } from "@/lib/api";
import { useAdminPermission } from "@/components/admin/admin-access-provider";
import type { AdminUser } from "@/lib/admin";

type Action = "suspend" | "reactivate" | "force-password-reset" | "revoke-sessions";
const labels: Record<Action, string> = { suspend: "Suspend", reactivate: "Reactivate", "force-password-reset": "Force reset", "revoke-sessions": "Revoke sessions" };

export function AccountLifecycleActions({ user }: { user: AdminUser }) {
  const allowed = useAdminPermission("users.moderate");
  const router = useRouter();
  const [action, setAction] = useState<Action | null>(null);
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const opener = useRef<HTMLButtonElement | null>(null);
  const protectedAccount = user.role === "master_admin" || user.is_active === false;
  const canReactivate = user.status === "suspended" && Boolean(user.email_verified_at) && (user.role !== "recruiter" || user.recruiter_verification === "verified");
  function start(value: Action, button: HTMLButtonElement) { opener.current = button; setAction(value); setReason(""); setMessage(""); setError(""); }
  function cancel() { setAction(null); setReason(""); setError(""); opener.current?.focus(); }
  async function submit(event: FormEvent) {
    event.preventDefault(); if (!action || busy) return;
    if ([...reason.trim()].length < 5 || [...reason.trim()].length > 1000) { setError("Enter a justification of 5–1,000 characters."); return; }
    setBusy(true); setError("");
    try {
      await apiRequest(`/api/v1/admin/users/${user.id}/${action}`, { method: "POST", body: JSON.stringify({ reason: reason.trim() }) });
      setMessage(`${labels[action]} completed. Existing sessions were revoked; the change was audited.`);
      setAction(null); setReason(""); router.refresh();
    } catch (cause) {
      setError(cause instanceof APIRequestError && cause.status === 403 ? "Permission or recent authenticator confirmation is required. Confirm access in Security before retrying." : cause instanceof Error ? cause.message : "Action could not be completed. Refresh the account before retrying.");
    } finally { setBusy(false); }
  }
  const summary=<Link className="inline-flex min-h-10 items-center text-xs font-bold text-indigo-600" href={`/swx-command-centre/users/${user.id}`}>View account summary →</Link>;
  if (!allowed) return <div>{summary}<p className="text-xs text-slate-500">Read-only access</p></div>;
  if (protectedAccount) return <div>{summary}<p className="text-xs text-slate-500">Protected account — no actions here</p></div>;
  return <div className="max-w-sm space-y-2" role="group" aria-label={`Account actions for ${user.name || user.id}`}>
    {summary}
    <div className="flex flex-wrap gap-2">
      {(user.status === "active" || user.status === "pending_verification") && <button type="button" disabled={busy} onClick={(event) => start("suspend", event.currentTarget)} className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs font-bold text-amber-800 disabled:opacity-50">Suspend</button>}
      {user.status === "suspended" && <button type="button" disabled={busy || !canReactivate} onClick={(event) => start("reactivate", event.currentTarget)} className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs font-bold text-emerald-800 disabled:opacity-50">Reactivate</button>}
      {(["force-password-reset", "revoke-sessions"] as const).map((value) => <button key={value} type="button" disabled={busy} onClick={(event) => start(value, event.currentTarget)} className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-bold text-slate-700 disabled:opacity-50">{labels[value]}</button>)}
    </div>
    {user.status === "disabled" && <p className="text-xs text-slate-500">Disabled accounts require a separate review; reactivation is unavailable.</p>}
    {user.status === "suspended" && !canReactivate && <p className="text-xs text-slate-500">Email and recruiter verification must be satisfied before reactivation.</p>}
    {action && <form onSubmit={submit} className="space-y-3 rounded-xl border border-indigo-100 bg-indigo-50/50 p-3" aria-label={`Confirm ${labels[action]}`}>
      <p className="text-sm font-bold text-slate-900">{labels[action]} {user.name || "this account"}?</p>
      <p className="text-xs leading-5 text-slate-600">All existing sessions will be revoked. {action === "reactivate" ? "Email verification and recruiter approval are not bypassed. Required password resets remain required." : "No password or verification code will be issued."}</p>
      <label className="grid gap-1 text-xs font-bold text-slate-700">Justification<textarea autoFocus value={reason} onChange={(event) => setReason(event.target.value)} required minLength={5} maxLength={1000} rows={3} disabled={busy} className="w-full min-w-0 resize-y rounded-lg border border-slate-200 bg-white p-2 text-sm font-normal outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100" /></label>
      <p className="text-xs text-slate-500">Use a case reference; do not include passwords, codes or sensitive documents.</p>
      <div className="flex flex-wrap gap-2"><button type="submit" disabled={busy} className="rounded-lg bg-indigo-600 px-3 py-2 text-xs font-bold text-white disabled:opacity-50">{busy ? "Applying…" : `Confirm ${labels[action]}`}</button><button type="button" disabled={busy} onClick={cancel} className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-bold text-slate-700">Cancel</button></div>
    </form>}
    {error && <p role="alert" aria-label="Account action failed" className="text-xs leading-5 text-red-700">{error} <button type="button" onClick={() => router.refresh()} className="underline">Refresh account</button></p>}
    {message && <p role="status" className="text-xs leading-5 text-emerald-800">{message}</p>}
  </div>;
}
