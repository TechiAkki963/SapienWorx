"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { FormEvent, useEffect, useState } from "react";

import { Button } from "@/components/ui/button";
import { OTPCodeInput } from "@/components/auth/otp-code-input";
import { apiRequest } from "@/lib/api";

export function VerifyEmailForm() {
  const router = useRouter();
  const params = useSearchParams();
  const email = params.get("email") ?? "";
  const role = params.get("role") ?? "candidate";
  const [code, setCode] = useState("");
  const [message, setMessage] = useState("If your email is awaiting verification, check your inbox for the code.");
  const [cooldown, setCooldown] = useState(0);

  useEffect(() => {
    if (cooldown <= 0) return;
    const timer = window.setTimeout(() => setCooldown((value) => Math.max(0, value - 1)), 1000);
    return () => window.clearTimeout(timer);
  }, [cooldown]);
  const [error, setError] = useState("");
  const [requesting, setRequesting] = useState(false);
  const [verifying, setVerifying] = useState(false);

  async function requestCode() {
    if (requesting || verifying || cooldown > 0) return;
    setRequesting(true);
    setError("");
    setMessage("");
    try {
      await apiRequest("/api/v1/auth/email/request", { method: "POST", body: JSON.stringify({ email }) });
      setMessage("If verification is still required, a code will be sent when permitted by the resend limit.");
      setCooldown(60);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not request email verification.");
    } finally {
      setRequesting(false);
    }
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (verifying || code.length !== 6) return;
    setVerifying(true);
    setError("");
    try {
      const result = await apiRequest<{ status: string }>("/api/v1/auth/email/verify", { method: "POST", body: JSON.stringify({ email, code }) });
      if (role === "recruiter" && result.status !== "active") {
        setMessage("Email verified. Your recruiter account is awaiting SapienWorx administrator approval before workspace access.");
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
        <p className="text-sm font-semibold text-indigo">Email verification · Required</p>
        <h2 className="mt-2 text-3xl font-semibold tracking-[-0.03em] text-ink">Confirm your email address</h2>
        <p className="mt-3 text-sm leading-6 text-ink-muted">Workspace access stays locked until <strong>{email || "your email"}</strong> is verified.</p>
      </div>
      {message && <p className="rounded-2xl bg-blue-50 p-3 text-sm leading-6 text-ink" role="status">{message}</p>}
      <OTPCodeInput label="Email verification code" value={code} onChange={setCode} disabled={verifying} error={error} />
      <div className="grid gap-2 sm:grid-cols-2">
        <Button type="submit" size="lg" disabled={verifying || code.length !== 6}>{verifying ? "Verifying…" : "Verify email"}</Button>
        <Button type="button" variant="secondary" size="lg" onClick={requestCode} disabled={requesting || verifying || cooldown > 0}>{requesting ? "Requesting…" : cooldown > 0 ? `Resend in ${cooldown}s` : "Send new code"}</Button>
      </div>
    </form>
  );
}
