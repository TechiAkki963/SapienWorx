"use client";

import Link from "next/link";
import { useEffect, useState, type FormEvent } from "react";

import { apiRequest } from "@/lib/api";
import { adminRoleLabel, type AdminAccess } from "@/lib/admin-access";

type Enrollment = { secret: string; expires_at: string };

export function AdminSecurityForm({ access }: { access: AdminAccess }) {
  const [password, setPassword] = useState("");
  const [code, setCode] = useState("");
  const [enrollment, setEnrollment] = useState<Enrollment | null>(null);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  const [confirmed, setConfirmed] = useState(false);
  useEffect(() => {
    if (!enrollment) return;
    const timer = window.setTimeout(() => { setEnrollment(null); setCode(""); setPassword(""); setError("Setup expired. Start a new authenticator setup."); }, Math.max(0, Date.parse(enrollment.expires_at) - Date.now()));
    return () => window.clearTimeout(timer);
  }, [enrollment]);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPending(true); setError("");
    try {
      if (!access.mfa_enrolled && !enrollment) {
        setEnrollment(await apiRequest<Enrollment>("/api/v1/admin/security/mfa/enroll", { method: "POST", body: JSON.stringify({ password }) }));
      } else {
        await apiRequest("/api/v1/admin/security/mfa/verify", { method: "POST", body: JSON.stringify({ password, code }) });
        setEnrollment(null); setCode(""); setConfirmed(true);
      }
    } catch (cause) {
      setCode(""); setError(cause instanceof Error ? cause.message : "Verification could not be completed.");
    } finally { setPassword(""); setPending(false); }
  }

  const codeRequired = access.mfa_enrolled || Boolean(enrollment);
  return <section className="order-1 min-w-0 rounded-3xl border border-line bg-white p-6 shadow-[0_16px_50px_rgba(55,65,140,0.08)] sm:p-8 lg:order-2">
    <p className="text-xs font-bold uppercase tracking-wider text-indigo">Administrative security</p>
    <h2 className="mt-3 text-2xl font-bold tracking-tight text-ink">{!access.enabled ? "Not activated yet" : !access.assigned ? "Role approval required" : confirmed ? "Authenticator confirmed" : codeRequired ? "Confirm your authenticator" : "Set up your authenticator"}</h2>
    {!access.enabled ? <><p className="mt-3 text-sm leading-6 text-ink-muted">The new security gate is disabled in this environment. Existing administrator access has not been changed.</p><Link href="/swx-command-centre/access" className="mt-5 inline-flex rounded-xl bg-indigo px-4 py-3 text-sm font-bold text-white">Review access design</Link></> : !access.assigned ? <p className="mt-3 text-sm leading-6 text-ink-muted">No approved administrative role is assigned to this account. Ask your authorized operator to review the assignment. Password login alone does not grant operational access.</p> : confirmed ? <><p role="status" className="mt-3 text-sm leading-6 text-ink-muted">Your current session is confirmed. Permissions are checked again for every operation.</p><Link href="/swx-command-centre/access" className="mt-5 inline-flex rounded-xl bg-indigo px-4 py-3 text-sm font-bold text-white">Continue to command centre</Link></> : <>
      <div className="mt-4 rounded-xl bg-lavender/40 px-4 py-3 text-sm"><span className="text-ink-muted">Approved role</span><p className="mt-1 font-bold text-ink">{adminRoleLabel(access.admin_role)}</p></div>
      {access.mfa_verified && <p className="mt-4 text-xs leading-6 text-ink-muted">This session is already confirmed. Use a fresh code here to re-confirm before a sensitive action.</p>}
      {enrollment && <div className="mt-5 rounded-2xl border border-mint bg-mint/20 p-4"><h3 className="text-sm font-bold text-ink">Add a time-based account</h3><p className="mt-2 text-xs leading-6 text-ink-muted">In your authenticator, choose manual setup, name the account SapienWorx, and enter this key. Use time-based codes (six digits, SHA-1, 30 seconds). Keep this key private; setup expires in ten minutes.</p><p aria-label="Authenticator setup key" className="mt-3 select-all break-all rounded-xl border border-line bg-white p-3 font-mono text-sm font-semibold text-ink">{enrollment.secret}</p><p className="mt-2 text-xs text-ink-muted">Re-enter your password below, then confirm the code shown by your authenticator.</p></div>}
      <form onSubmit={submit} className="mt-5 grid gap-4">
        <label className="grid gap-2 text-sm font-bold text-ink" htmlFor="admin-confirm-password">Current password<input id="admin-confirm-password" type="password" autoComplete="current-password" value={password} onChange={(event) => setPassword(event.target.value)} required maxLength={1024} disabled={pending} className="min-h-11 w-full min-w-0 rounded-xl border border-line px-3 text-sm font-normal focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo" /></label>
        {codeRequired && <label className="grid gap-2 text-sm font-bold text-ink" htmlFor="admin-confirm-code">Authenticator code<input id="admin-confirm-code" type="text" inputMode="numeric" autoComplete="one-time-code" pattern="[0-9]{6}" minLength={6} maxLength={6} value={code} onChange={(event) => setCode(event.target.value.replace(/\D/g, ""))} required disabled={pending} placeholder="Six-digit code" className="min-h-11 w-full min-w-0 rounded-xl border border-line px-3 text-sm font-normal tracking-widest focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo" /></label>}
        {error && <p role="alert" aria-label="Authenticator verification error" className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm leading-6 text-red-800">{error}</p>}
        <button disabled={pending} className="min-h-11 rounded-xl bg-indigo px-4 py-3 text-sm font-bold text-white transition hover:bg-indigo/90 disabled:opacity-60">{pending ? "Checking…" : codeRequired ? "Confirm access" : "Start authenticator setup"}</button>
      </form><p className="mt-4 text-xs leading-6 text-ink-muted">Never share a password, setup key or authenticator code in support chats. Verification is rate-limited and audited without recording these values.</p>
    </>}
  </section>;
}
