"use client";

import { useEffect, useState } from "react";
import { apiClient } from "../lib/api-client";
import { Button } from "./ui";

type Invitation = { displayName: string; email: string; role: string; expiresAt: string };
type ActivationStart = { activationId: string; email: string; expiresInMinutes: number };

const pretty = (value: string) => value.replaceAll("_", " ").replace(/\b\w/g, (character) => character.toUpperCase());

export function MasterAdminActivation({ token }: { token: string }) {
  const [invitation, setInvitation] = useState<Invitation | null>(null);
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [activation, setActivation] = useState<ActivationStart | null>(null);
  const [code, setCode] = useState("");
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [complete, setComplete] = useState(false);

  useEffect(() => {
    if (!token) { setError("This administrator invitation link is incomplete."); setLoading(false); return; }
    void apiClient<Invitation>(`/api/auth/admin-activation?token=${encodeURIComponent(token)}`)
      .then(setInvitation)
      .catch((reason) => setError(reason instanceof Error ? reason.message : "This administrator invitation is unavailable."))
      .finally(() => setLoading(false));
  }, [token]);

  const begin = async () => {
    if (password.length < 8) { setError("Choose a password of at least 8 characters."); return; }
    if (password !== confirmPassword) { setError("The passwords do not match."); return; }
    try {
      setBusy(true); setError("");
      setActivation(await apiClient<ActivationStart>("/api/auth/admin-activation/start", {
        method: "POST", body: JSON.stringify({ token, password }),
      }));
      setPassword(""); setConfirmPassword("");
    } catch (reason) { setError(reason instanceof Error ? reason.message : "Activation could not be started."); }
    finally { setBusy(false); }
  };

  const verify = async () => {
    if (!activation || code.length !== 6) return;
    try {
      setBusy(true); setError("");
      const result = await apiClient<{ activated: boolean; redirectTo: string }>("/api/auth/admin-activation/verify", {
        method: "POST", body: JSON.stringify({ activationId: activation.activationId, code }),
      });
      if (result.activated) setComplete(true);
    } catch (reason) { setError(reason instanceof Error ? reason.message : "The verification code could not be confirmed."); }
    finally { setBusy(false); }
  };

  return <main className="auth-page auth-page-admin"><section className="auth-layout"><div className="auth-aside"><span className="auth-aside-kicker">Sapienworx control plane</span><h1>Master <em>Access</em></h1><p>Administrator access is activated through a single-use invitation, password setup, and email verification.</p></div><section className="auth-card">
    <span className="eyebrow">Administrator activation</span>
    {loading ? <><h1>Checking invitation</h1><p className="auth-copy">Validating this single-use activation link…</p></> : complete ? <><h1>Access activated</h1><p className="auth-copy">Your administrator account is ready. Sign in with your new password; Master Access will still require email OTP verification.</p><Button href="/admin/login">Continue to Master Access →</Button></> : invitation ? <><h1>Set up Master Access</h1><p className="auth-copy">{invitation.displayName} · {invitation.email} · {pretty(invitation.role)}. This invitation expires {new Date(invitation.expiresAt).toLocaleString("en-IN")}.</p>{activation ? <div className="auth-form"><p className="auth-microcopy">A six-digit verification code was sent to {activation.email}. It expires in {activation.expiresInMinutes} minutes.</p><label className="auth-field"><span>Email verification code</span><input aria-label="Administrator activation OTP" inputMode="numeric" autoComplete="one-time-code" maxLength={6} value={code} onChange={(event) => setCode(event.target.value.replace(/\D/g, "").slice(0, 6))} /></label><Button disabled={busy || code.length !== 6} onClick={() => void verify()}>{busy ? "Verifying…" : "Verify and activate"}</Button></div> : <div className="auth-form"><label className="auth-field"><span>Create password</span><input type="password" autoComplete="new-password" value={password} onChange={(event) => setPassword(event.target.value)} /></label><label className="auth-field"><span>Confirm password</span><input type="password" autoComplete="new-password" value={confirmPassword} onChange={(event) => setConfirmPassword(event.target.value)} /></label><p className="auth-microcopy">Your password is never written to the invitation record. During verification, only a short-lived password hash is retained.</p><Button disabled={busy || !password || !confirmPassword} onClick={() => void begin()}>{busy ? "Preparing verification…" : "Continue to email verification →"}</Button></div>}</> : <><h1>Invitation unavailable</h1><p className="auth-copy">This link may have expired, been revoked, already been used, or be invalid. Ask a Master Access Owner to issue a new invitation.</p></>}
    {error && <p className="consent-error" role="alert">{error}</p>}
  </section></section></main>;
}
