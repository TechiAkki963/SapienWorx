"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { apiRequest } from "@/lib/api";

export function PasswordRecoveryForm() {
  const router = useRouter(); const [email, setEmail] = useState(""); const [step, setStep] = useState<"request"|"reset">("request"); const [message, setMessage] = useState(""); const [error, setError] = useState("");
  async function request(event: FormEvent<HTMLFormElement>) { event.preventDefault(); setError(""); const data = new FormData(event.currentTarget); const value = String(data.get("email") ?? ""); try { const result = await apiRequest<{ development_otp?: string }>("/api/v1/auth/password/forgot", { method:"POST", body:JSON.stringify({email:value}) }); setEmail(value); setMessage(result.development_otp ? `Development OTP: ${result.development_otp}` : "If the account exists, a reset code has been sent to its verified mobile number."); setStep("reset"); } catch (cause) { setError(cause instanceof Error ? cause.message : "Request failed."); } }
  async function reset(event: FormEvent<HTMLFormElement>) { event.preventDefault(); setError(""); const data = new FormData(event.currentTarget); try { await apiRequest("/api/v1/auth/password/reset", { method:"POST", body:JSON.stringify({email,code:data.get("code"),new_password:data.get("password")}) }); router.replace("/login"); } catch (cause) { setError(cause instanceof Error ? cause.message : "Password reset failed."); } }
  return step === "request" ? <form className="grid gap-5" onSubmit={request}><div><p className="text-sm font-semibold text-indigo">Account recovery</p><h2 className="mt-2 text-3xl font-semibold text-ink">Reset your password</h2></div>{error && <p className="rounded-2xl bg-red-50 p-3 text-sm text-red-700">{error}</p>}<Input label="Account email" name="email" type="email" required /><Button size="lg" type="submit">Send reset code</Button></form> : <form className="grid gap-5" onSubmit={reset}><div><p className="text-sm font-semibold text-indigo">Secure reset</p><h2 className="mt-2 text-3xl font-semibold text-ink">Choose a new password</h2><p className="mt-3 text-sm text-ink-muted">{message}</p></div>{error && <p className="rounded-2xl bg-red-50 p-3 text-sm text-red-700">{error}</p>}<Input label="Reset code" name="code" inputMode="numeric" maxLength={6} required /><Input label="New password" name="password" type="password" minLength={12} required /><Button size="lg" type="submit">Reset password</Button></form>;
}
