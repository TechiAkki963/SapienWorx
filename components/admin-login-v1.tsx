"use client";

import { useState } from "react";
import { apiClient } from "../lib/api-client";
import { Button, Logo, useHydrated } from "./ui";

type FieldErrors = { email?: string; password?: string };

export function AdminLoginV1() {
  const hydrated = useHydrated();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [transaction, setTransaction] = useState("");
  const [code, setCode] = useState("");
  const [error, setError] = useState("");
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const [working, setWorking] = useState(false);

  const request = async () => {
    const nextErrors: FieldErrors = {};
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) nextErrors.email = "Enter the approved Master Admin email address.";
    if (password.length < 8) nextErrors.password = "Enter your password (at least 8 characters).";
    setFieldErrors(nextErrors);
    if (Object.keys(nextErrors).length) {
      setError("Check the highlighted details before continuing.");
      return;
    }

    try {
      setWorking(true);
      setError("");
      const response = await apiClient<{ transactionId: string }>("/api/auth/request-otp", {
        method: "POST",
        body: JSON.stringify({ flow: "SIGN_IN", role: "SUPER_ADMIN", email: email.trim(), password }),
      });
      setTransaction(response.transactionId);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Secure verification could not be started.");
    } finally {
      setWorking(false);
    }
  };

  const verify = async () => {
    try {
      setWorking(true);
      setError("");
      const response = await apiClient<{ authenticated: boolean; redirectTo: string }>("/api/auth/verify-otp", {
        method: "POST",
        body: JSON.stringify({ transactionId: transaction, channel: "EMAIL", code }),
      });
      if (response.authenticated) window.location.assign(response.redirectTo);
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
      <p>Protected platform operations require password and email OTP verification. Administrative activity is audited.</p>
      {!hydrated ? <p role="status">Preparing secure form…</p> : transaction ? <form onSubmit={(event) => { event.preventDefault(); void verify(); }}>
        <label className="auth-field"><span>Email OTP</span><input aria-label="Email OTP" inputMode="numeric" maxLength={6} value={code} onChange={(event) => setCode(event.target.value.replace(/\D/g, "").slice(0, 6))} /></label>
        {error && <p className="workflow-error" role="alert">{error}</p>}
        <Button type="submit" disabled={code.length !== 6 || working}>{working ? "Verifying…" : "Verify and open Master Access"}</Button>
      </form> : <form onSubmit={(event) => { event.preventDefault(); void request(); }} noValidate>
        <label className="auth-field"><span>Master email</span><input aria-label="Master email" aria-invalid={Boolean(fieldErrors.email)} aria-describedby={fieldErrors.email ? "master-email-error" : undefined} type="email" autoComplete="username" value={email} onChange={(event) => { setEmail(event.target.value); setFieldErrors((current) => ({ ...current, email: undefined })); setError(""); }} />{fieldErrors.email && <small className="auth-field-error" id="master-email-error">{fieldErrors.email}</small>}</label>
        <label className="auth-field"><span>Password</span><input aria-label="Password" aria-invalid={Boolean(fieldErrors.password)} aria-describedby={fieldErrors.password ? "master-password-error" : undefined} type="password" autoComplete="current-password" value={password} onChange={(event) => { setPassword(event.target.value); setFieldErrors((current) => ({ ...current, password: undefined })); setError(""); }} />{fieldErrors.password && <small className="auth-field-error" id="master-password-error">{fieldErrors.password}</small>}</label>
        {error && <p className="workflow-error" role="alert">{error}</p>}
        <Button type="submit" disabled={working}>{working ? "Preparing secure verification…" : "Continue to OTP →"}</Button>
      </form>}
    </section>
  </main>;
}