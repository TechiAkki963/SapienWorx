"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { FormEvent, useState } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { apiRequest } from "@/lib/api";

export function VerifyEmailForm() {
  const router = useRouter();
  const params = useSearchParams();
  const email = params.get("email") ?? "";
  const role = params.get("role") ?? "candidate";
  const [code, setCode] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [requesting, setRequesting] = useState(false);
  const [verifying, setVerifying] = useState(false);

  async function requestCode() {
    setRequesting(true);
    setError("");
    setMessage("");
    try {
      const result = await apiRequest<{ development_code?: string; delivery_configured?: boolean; already_verified?: boolean }>("/api/v1/auth/email/request", { method: "POST", body: JSON.stringify({ email }) });
      if (result.already_verified) {
        setMessage("Email already verified. You can continue to sign in.");
        return;
      }
      if (result.development_code) {
        setCode(result.development_code);
        setMessage(`Development email code: ${result.development_code}`);
      } else if (result.delivery_configured === false) {
        setMessage("Email verification is required, but production email delivery has not been configured yet. Connect an approved email provider before launch.");
      } else {
        setMessage("A verification code was sent to your email address.");
      }
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not request email verification.");
    } finally {
      setRequesting(false);
    }
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setVerifying(true);
    setError("");
    const data = new FormData(event.currentTarget);
    try {
      const result = await apiRequest<{ status: string }>("/api/v1/auth/email/verify", { method: "POST", body: JSON.stringify({ email, code: data.get("code") }) });
      if (role === "recruiter" && result.status !== "active") {
        setMessage("Email verified. Your recruiter account is now awaiting SapienWorx administrator approval before workspace access.");
        return;
      }
      router.replace(role === "recruiter" ? "/recruiter/login?verified=1" : "/login?verified=1");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Email verification failed.");
    } finally {
      setVerifying(false);
    }
  }

  return (
    <form className="grid gap-5" onSubmit={submit}>
      <div>
        <p className="text-sm font-semibold text-indigo">Step 2 of 2 · Verify email</p>
        <h2 className="mt-2 text-3xl font-semibold tracking-[-0.03em] text-ink">Confirm your email address</h2>
        <p className="mt-3 text-sm leading-6 text-ink-muted">Workspace access stays locked until <strong>{email || "your email"}</strong> is verified.</p>
      </div>
      {error && <p className="rounded-2xl bg-red-50 p-3 text-sm text-red-700" role="alert">{error}</p>}
      {message && <p className="rounded-2xl bg-blue-50 p-3 text-sm leading-6 text-ink" role="status">{message}</p>}
      <Button type="button" variant="secondary" size="lg" onClick={requestCode} disabled={requesting}>{requesting ? "Requesting…" : "Send verification code"}</Button>
      <Input label="Email verification code" name="code" value={code} onChange={(event) => setCode(event.target.value)} inputMode="numeric" pattern="[0-9]{6}" maxLength={6} autoComplete="one-time-code" required />
      <Button type="submit" size="lg" disabled={verifying}>{verifying ? "Verifying…" : "Verify email"}</Button>
    </form>
  );
}
