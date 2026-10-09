"use client";

import { FormEvent, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

import { OTPCodeInput } from "@/components/auth/otp-code-input";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { apiRequest } from "@/lib/api";

export function PasswordRecoveryForm({ navigation = {href:"/login",label:"sign in",signIn:"/login"}, accountEmail }: { navigation?: {href:string;label:string;signIn:string}; accountEmail?: string }) {
  const router = useRouter();
  const [email, setEmail] = useState(accountEmail || "");
  const [step, setStep] = useState<"request" | "reset">("request");
  const [code, setCode] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function request(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy) return;
    setBusy(true);
    setError("");
    const value = accountEmail || String(new FormData(event.currentTarget).get("email") ?? "").trim();
    try {
      await apiRequest("/api/v1/auth/password/forgot", { method: "POST", body: JSON.stringify({ email: value }) });
      setEmail(value);
      setMessage("If the account exists, a reset code will be sent to its registered email address.");
      setStep("reset");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Request failed.");
    } finally {
      setBusy(false);
    }
  }

  async function reset(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy || code.length !== 6) return;
    setBusy(true);
    setError("");
    const password = new FormData(event.currentTarget).get("password");
    try {
      await apiRequest("/api/v1/auth/password/reset", { method: "POST", body: JSON.stringify({ email, code, new_password: password }) });
      router.replace(`${navigation.signIn}?password_reset=1`);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Password reset failed.");
    } finally {
      setBusy(false);
    }
  }

  const back = <Link href={navigation.href} className="inline-flex min-h-11 items-center text-sm font-semibold text-indigo">← Back to {navigation.label}</Link>;
  const exit = <Link href={navigation.href} className="min-h-11 content-center text-center text-sm font-semibold text-indigo">Return to {navigation.label}</Link>;
  if (step === "request") return (
    <form className="grid gap-5" onSubmit={request}>
      {back}
      <div><p className="text-sm font-semibold text-indigo">Account recovery</p><h2 className="mt-2 text-3xl font-semibold text-ink">Reset your password</h2></div>
      {error && <p role="alert" className="rounded-2xl bg-red-50 p-3 text-sm text-red-700">{error}</p>}
      {accountEmail ? <div><p className="text-sm text-ink-muted">Reset password for</p><p className="mt-1 break-all text-sm font-semibold text-ink">{accountEmail}</p></div> : <Input label="Account email" name="email" type="email" autoComplete="email" required />}
      <Button size="lg" type="submit" disabled={busy}>{busy ? "Requesting…" : "Send reset code"}</Button>
      {exit}
    </form>
  );
  return (
    <form className="grid gap-5" onSubmit={reset}>
      {back}
      <div><p className="text-sm font-semibold text-indigo">Secure reset</p><h2 className="mt-2 text-3xl font-semibold text-ink">Choose a new password</h2><p role="status" className="mt-3 text-sm text-ink-muted">{message}</p></div>
      <OTPCodeInput label="Password reset code" value={code} onChange={setCode} disabled={busy} error={error} />
      <Input label="New password" name="password" type="password" autoComplete="new-password" minLength={12} required />
      <Button size="lg" type="submit" disabled={busy || code.length !== 6}>{busy ? "Resetting…" : "Reset password"}</Button>
      {exit}
    </form>
  );
}
