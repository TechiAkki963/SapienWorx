"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { FormEvent, useState } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { apiRequest } from "@/lib/api";

export function SignupForm({ recruiter = false }: { recruiter?: boolean }) {
  const router = useRouter();
  const [error, setError] = useState("");
  const [pending, setPending] = useState(false);
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setError(""); setPending(true);
    const data = new FormData(event.currentTarget);
    const payload = { full_name: data.get("full_name"), email: data.get("email"), phone: data.get("phone"), password: data.get("password"), ...(recruiter ? { company_name: data.get("company_name"), designation: data.get("designation") } : {}) };
    try {
      const result = await apiRequest<{ email: string; development_otp?: string }>(recruiter ? "/api/v1/auth/recruiter/register" : "/api/v1/auth/candidate/register", { method: "POST", body: JSON.stringify(payload) });
      const query = new URLSearchParams({ email: result.email, role: recruiter ? "recruiter" : "candidate" });
      if (result.development_otp) query.set("dev_otp", result.development_otp);
      router.push(`/verify-phone?${query.toString()}`);
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Account creation failed."); }
    finally { setPending(false); }
  }
  return (
    <form className="grid gap-4" onSubmit={submit}>
      <div><p className="text-sm font-semibold text-indigo">{recruiter ? "Recruiter workspace" : "Candidate account"}</p><h2 className="mt-2 text-3xl font-semibold tracking-[-0.03em] text-ink">Create your account</h2></div>
      {error && <p className="rounded-2xl bg-red-50 p-3 text-sm text-red-700" role="alert">{error}</p>}
      <Input label="Full name" name="full_name" autoComplete="name" required />
      {recruiter && <><Input label="Company name" name="company_name" required /><Input label="Designation" name="designation" /></>}
      <Input label={recruiter ? "Official work email" : "Email"} name="email" type="email" autoComplete="email" hint={recruiter ? "Public email providers such as Gmail or Yahoo are not accepted." : undefined} required />
      <Input label="Mobile number" name="phone" type="tel" autoComplete="tel" placeholder="+919876543210" hint="Use international E.164 format." required />
      <Input label="Password" name="password" type="password" autoComplete="new-password" hint="Minimum 12 characters." minLength={12} required />
      <Button type="submit" size="lg" disabled={pending}>{pending ? "Creating account…" : "Create account"}</Button>
      <p className="text-center text-sm text-ink-muted">Already registered? <Link className="font-semibold text-indigo hover:underline" href={recruiter ? "/recruiter/login" : "/login"}>Sign in</Link></p>
    </form>
  );
}
