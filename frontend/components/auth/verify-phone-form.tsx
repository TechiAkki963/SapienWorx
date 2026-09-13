"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { FormEvent, useState } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { apiRequest } from "@/lib/api";

export function VerifyPhoneForm() {
  const router = useRouter(); const params = useSearchParams();
  const email = params.get("email") ?? ""; const role = params.get("role") ?? "candidate"; const devOTP = params.get("dev_otp");
  const [error, setError] = useState(""); const [message, setMessage] = useState(""); const [pending, setPending] = useState(false);
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setPending(true); setError("");
    const data = new FormData(event.currentTarget);
    try {
      const result = await apiRequest<{ status: string }>("/api/v1/auth/otp/verify", { method: "POST", body: JSON.stringify({ email, code: data.get("code"), purpose: "phone_verification" }) });
      if (result.status === "pending_admin_verification") { setMessage("Phone verified. Your recruiter account is now awaiting SapienWorx administrator approval."); }
      else { router.replace(role === "recruiter" ? "/recruiter/login" : "/login"); }
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Verification failed."); }
    finally { setPending(false); }
  }
  async function resend() {
    setError(""); setMessage("");
    try { const result = await apiRequest<{ development_otp?: string }>("/api/v1/auth/otp/resend", { method: "POST", body: JSON.stringify({ email }) }); setMessage(result.development_otp ? `Development OTP: ${result.development_otp}` : "A new code has been requested."); }
    catch (cause) { setError(cause instanceof Error ? cause.message : "Could not resend code."); }
  }
  return (
    <form className="grid gap-5" onSubmit={submit}>
      <div><p className="text-sm font-semibold text-indigo">Verify mobile</p><h2 className="mt-2 text-3xl font-semibold tracking-[-0.03em] text-ink">Enter your 6-digit code</h2><p className="mt-3 text-sm leading-6 text-ink-muted">We sent the verification code to the mobile number linked with <strong>{email || "your account"}</strong>.</p></div>
      {devOTP && <p className="rounded-2xl bg-amber-50 p-3 text-sm text-amber-800">Development OTP: <strong>{devOTP}</strong></p>}
      {error && <p className="rounded-2xl bg-red-50 p-3 text-sm text-red-700" role="alert">{error}</p>}
      {message && <p className="rounded-2xl bg-mint/60 p-3 text-sm text-ink">{message}</p>}
      <Input label="Verification code" name="code" inputMode="numeric" pattern="[0-9]{6}" maxLength={6} autoComplete="one-time-code" required />
      <Button type="submit" size="lg" disabled={pending}>{pending ? "Verifying…" : "Verify mobile"}</Button>
      <button className="text-sm font-semibold text-indigo hover:underline" type="button" onClick={resend}>Resend code</button>
    </form>
  );
}
