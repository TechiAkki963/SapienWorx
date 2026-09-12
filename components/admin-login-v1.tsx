"use client";

import { useRef, useState } from "react";
import { apiClient } from "../lib/api-client";
import { Button, Logo, useHydrated } from "./ui";

type FieldErrors = { email?: string };

export function AdminLoginV1() {
  const hydrated = useHydrated();
  const [email, setEmail] = useState("");
  const [transaction, setTransaction] = useState("");
  const [digits, setDigits] = useState(["", "", "", "", "", ""]);
  const digitRefs = useRef<Array<HTMLInputElement | null>>([]);
  const [error, setError] = useState("");
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const [working, setWorking] = useState(false);
  const code = digits.join("");

  const request = async () => {
    const nextErrors: FieldErrors = {};
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) nextErrors.email = "Enter the approved Master Admin email address.";
    setFieldErrors(nextErrors);
    if (Object.keys(nextErrors).length) {
      setError("Check the highlighted email before continuing.");
      return;
    }

    try {
      setWorking(true);
      setError("");
      const response = await apiClient<{ transactionId: string }>("/api/auth/request-otp", {
        method: "POST",
        body: JSON.stringify({ flow: "SIGN_IN", role: "SUPER_ADMIN", email: email.trim() }),
      });
      setTransaction(response.transactionId);
      setDigits(["", "", "", "", "", ""]);
      window.setTimeout(() => digitRefs.current[0]?.focus(), 0);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Secure verification could not be started.");
    } finally {
      setWorking(false);
    }
  };

  const setDigit = (index: number, value: string) => {
    const digit = value.replace(/\D/g, "").slice(-1);
    setDigits((current) => current.map((item, itemIndex) => itemIndex === index ? digit : item));
    if (digit && index < 5) digitRefs.current[index + 1]?.focus();
  };

  const pasteDigits = (value: string) => {
    const next = value.replace(/\D/g, "").slice(0, 6).split("");
    if (!next.length) return;
    setDigits(Array.from({ length: 6 }, (_, index) => next[index] ?? ""));
    digitRefs.current[Math.min(next.length, 6) - 1]?.focus();
  };

  const verify = async () => {
    try {
      setWorking(true);
      setError("");
      const response = await apiClient<{ authenticated: boolean; redirectTo: string | null }>("/api/auth/verify-otp", {
        method: "POST",
        body: JSON.stringify({ transactionId: transaction, channel: "EMAIL", code }),
      });
      if (!response.authenticated || !response.redirectTo) throw new Error("Email verification is not complete.");
      window.location.assign(response.redirectTo);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Verification failed.");
    } finally {
      setWorking(false);
    }
  };

  return <main className="auth-page-admin-v1">
    <section className="admin-login-card" aria-busy={!hydrated}>
      <Logo />
      <span className="eyebrow">Super admin only</span>
      <h1>Master Access</h1>
      <p>Master Access uses verified administrator email plus a time-limited email OTP. Administrative activity is audited.</p>
      {!hydrated ? <p role="status">Preparing secure form…</p> : transaction ? <form onSubmit={(event) => { event.preventDefault(); void verify(); }}>
        <button className="back-link" type="button" onClick={() => { setTransaction(""); setDigits(["", "", "", "", "", ""]); setError(""); }}>← Use another email</button>
        <fieldset className="auth-otp-fieldset"><legend>Email verification code</legend><div className="auth-otp-digits" onPaste={(event) => { event.preventDefault(); pasteDigits(event.clipboardData.getData("text")); }}>{digits.map((digit, index) => <input key={index} ref={(element) => { digitRefs.current[index] = element; }} aria-label={`Verification digit ${index + 1}`} inputMode="numeric" autoComplete={index === 0 ? "one-time-code" : "off"} maxLength={1} value={digit} onChange={(event) => setDigit(index, event.target.value)} onKeyDown={(event) => { if (event.key === "Backspace" && !digits[index] && index > 0) digitRefs.current[index - 1]?.focus(); }} />)}</div><small>Enter the six-digit code sent to {email}.</small></fieldset>
        {error && <p className="workflow-error" role="alert">{error}</p>}
        <Button type="submit" disabled={code.length !== 6 || working}>{working ? "Verifying…" : "Verify and open Master Access"}</Button>
        <Button variant="secondary" onClick={() => void request()} disabled={working}>Resend code</Button>
      </form> : <form onSubmit={(event) => { event.preventDefault(); void request(); }} noValidate>
        <label className="auth-field"><span>Master email</span><input aria-label="Master email" aria-invalid={Boolean(fieldErrors.email)} aria-describedby={fieldErrors.email ? "master-email-error" : undefined} type="email" autoComplete="email" value={email} onChange={(event) => { setEmail(event.target.value); setFieldErrors((current) => ({ ...current, email: undefined })); setError(""); }} />{fieldErrors.email && <small className="auth-field-error" id="master-email-error">{fieldErrors.email}</small>}</label>
        {error && <p className="workflow-error" role="alert">{error}</p>}
        <Button type="submit" disabled={working || !email.trim()}>{working ? "Sending secure verification…" : "Send email code →"}</Button>
      </form>}
    </section>
  </main>;
}
