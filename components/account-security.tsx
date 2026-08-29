"use client";

import { useEffect, useState } from "react";
import { apiClient } from "../lib/api-client";
import { Button, SectionTitle } from "./ui";

type AccountSession = {
  id: string;
  deviceName: string;
  locationHint: string | null;
  trustedDevice: boolean;
  current: boolean;
  createdAt: string;
  lastSeenAt: string;
  sessionExpiresAt: string;
  trustedUntil: string | null;
};

const when = (value: string) => new Intl.DateTimeFormat("en-IN", { day: "numeric", month: "short", hour: "numeric", minute: "2-digit" }).format(new Date(value));

export function AccountSecurity({ candidate = false, loginPath = "/login" }: { candidate?: boolean; loginPath?: string }) {
  const [sessions, setSessions] = useState<AccountSession[]>([]);
  const [remainingRecoveryCodes, setRemainingRecoveryCodes] = useState<number | null>(null);
  const [recoveryCodes, setRecoveryCodes] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [working, setWorking] = useState("");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  const load = async () => {
    setLoading(true); setError("");
    try {
      const sessionResponse = await apiClient<AccountSession[]>("/api/account/security/sessions");
      setSessions(sessionResponse);
      if (candidate) {
        const recovery = await apiClient<{ remaining: number }>("/api/account/security/recovery-codes");
        setRemainingRecoveryCodes(recovery.remaining);
      }
    } catch (reason) { setError(reason instanceof Error ? reason.message : "We could not load account security."); }
    finally { setLoading(false); }
  };

  useEffect(() => { void load(); }, [candidate]);

  const revoke = async (session: AccountSession) => {
    if (!window.confirm(session.current
      ? "Sign out this current session now? You will need to verify your account again."
      : `Revoke ${session.deviceName}? That device will lose access immediately.`)) return;
    setWorking(session.id); setError(""); setNotice("");
    try {
      await apiClient<void>(`/api/account/security/sessions/${session.id}`, { method: "DELETE" });
      if (session.current) { window.location.assign(loginPath); return; }
      setSessions((values) => values.filter((value) => value.id !== session.id));
      setNotice("That device session has been signed out.");
    } catch (reason) { setError(reason instanceof Error ? reason.message : "We could not revoke that session."); }
    finally { setWorking(""); }
  };

  const revokeOthers = async () => {
    if (!window.confirm("Sign out every other device? Their trusted-device access will also be removed.")) return;
    setWorking("others"); setError(""); setNotice("");
    try {
      await apiClient<void>("/api/account/security/sessions/revoke-others", { method: "POST" });
      setSessions((values) => values.filter((value) => value.current));
      setNotice("Every other device has been signed out and its trusted-device access removed.");
    } catch (reason) { setError(reason instanceof Error ? reason.message : "We could not sign out the other devices."); }
    finally { setWorking(""); }
  };

  const generateRecoveryCodes = async () => {
    setWorking("recovery"); setError(""); setNotice("");
    try {
      const response = await apiClient<{ codes: string[]; remaining: number }>("/api/account/security/recovery-codes", { method: "POST" });
      setRecoveryCodes(response.codes); setRemainingRecoveryCodes(response.remaining);
      setNotice("New recovery codes created. Your previous codes no longer work.");
    } catch (reason) { setError(reason instanceof Error ? reason.message : "We could not create recovery codes."); }
    finally { setWorking(""); }
  };

  const copyCodes = async () => {
    await navigator.clipboard.writeText(recoveryCodes.join("\n"));
    setNotice("Recovery codes copied. Store them somewhere private and separate from this device.");
  };

  return <section className="panel account-security-panel">
    <div className="account-security-heading"><SectionTitle eyebrow="Account protection" title="Devices and sessions"/><Button variant="secondary" onClick={() => void revokeOthers()} disabled={working === "others" || sessions.filter((session) => !session.current).length === 0}>Sign out other devices</Button></div>
    <p className="settings-intro">Review where your account is signed in. Revoking a trusted device also restores full verification on its next candidate login.</p>
    {loading && <p role="status">Loading signed-in devices…</p>}
    {error && <p className="candidate-privacy-error" role="alert">{error}</p>}
    {notice && <p className="candidate-privacy-notice" role="status">{notice}</p>}
    {!loading && sessions.length === 0 && <p>No active sessions were found. Sign in again to refresh account protection.</p>}
    <div className="account-session-list">{sessions.map((session) => <article key={session.id} className={session.current ? "account-session current" : "account-session"}><span aria-hidden="true">{session.deviceName.includes("Windows") ? "▣" : "◫"}</span><div><strong>{session.deviceName} {session.current && <b>Current session</b>}</strong><small>{session.locationHint || "Network unavailable"} · Last active {when(session.lastSeenAt)}</small><p>{session.trustedDevice && session.trustedUntil ? `Trusted for adaptive verification until ${when(session.trustedUntil)}` : "Full verification required on the next sign-in."}</p></div><button type="button" disabled={working === session.id} onClick={() => void revoke(session)}>{working === session.id ? "Signing out…" : session.current ? "Sign out here" : "Revoke"}</button></article>)}</div>
    {candidate && <div className="recovery-code-manager"><div><span className="eyebrow">Phone-loss recovery</span><h3>One-time recovery codes</h3><p>{remainingRecoveryCodes === null ? "Checking recovery codes…" : `${remainingRecoveryCodes} unused code${remainingRecoveryCodes === 1 ? "" : "s"} available.`} Each code replaces the mobile OTP once, after your email code is verified.</p></div><Button variant="secondary" onClick={() => void generateRecoveryCodes()} disabled={working === "recovery"}>{working === "recovery" ? "Creating codes…" : recoveryCodes.length ? "Replace recovery codes" : "Generate recovery codes"}</Button>{recoveryCodes.length > 0 && <div className="recovery-code-sheet" role="status"><strong>Save these now — they are shown only once</strong><div>{recoveryCodes.map((code) => <code key={code}>{code}</code>)}</div><button type="button" onClick={() => void copyCodes()}>Copy all codes</button></div>}</div>}
  </section>;
}
