"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { FormEvent, useState } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { apiRequest, APIRequestError } from "@/lib/api";

type Role = "candidate" | "recruiter" | "master_admin";

export function LoginForm({ role, nextPath }: { role: Role; nextPath?: string }) {
  const router = useRouter();
  const [error, setError] = useState("");
  const [pending, setPending] = useState(false);
  const [attemptedEmail, setAttemptedEmail] = useState("");
  const [verificationNeeded, setVerificationNeeded] = useState(false);
  const destination = role === "candidate" ? nextPath ?? "/candidate" : role === "recruiter" ? "/recruiter" : "/swx-command-centre/overview";

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setVerificationNeeded(false);
    setPending(true);
    const data = new FormData(event.currentTarget);
    const email = String(data.get("email") ?? "");
    setAttemptedEmail(email);
    try {
      await apiRequest("/api/v1/auth/login", {
        method: "POST",
        body: JSON.stringify({ email, password: data.get("password"), role }),
      });
      router.replace(destination);
      router.refresh();
    } catch (cause) {
      if (cause instanceof APIRequestError) {
        switch (cause.code) {
          case "invalid_credentials":
            setError("Email or password is incorrect.");
            break;
          case "email_unverified":
            setVerificationNeeded(true);
            setError("Registration email verification is incomplete.");
            break;
          case "recruiter_approval_pending":
            setError("Your email is verified. Your recruiter account is awaiting administrator approval.");
            break;
          case "account_unavailable":
            setError("Account access is unavailable. Contact SapienWorx support if you believe this is an error.");
            break;
          default:
            setError("Sign-in could not be completed. Please try again.");
        }
      } else {
        setError("Sign-in could not be completed. Please try again.");
      }
    } finally {
      setPending(false);
    }
  }

  const verificationHref = `/verify-email?${new URLSearchParams({ email: attemptedEmail, role }).toString()}`;

  return (
    <form className="grid gap-5" onSubmit={submit}>
      <div>
        <p className="text-sm font-semibold text-indigo">{role === "master_admin" ? "Restricted session" : "Welcome back"}</p>
        <h2 className="mt-2 text-3xl font-semibold tracking-[-0.03em] text-ink">{role === "master_admin" ? "Enter the command centre" : "Sign in to SapienWorx"}</h2>
        <p className="mt-2 text-sm leading-6 text-ink-muted">{role === "master_admin" ? "Access is limited to directly provisioned Master Admin accounts." : "Workspace access requires a verified registered email address."}</p>
      </div>
      {error && (
        <div className="rounded-2xl bg-red-50 p-3 text-sm text-red-700" role="alert">
          <p>{error}</p>
          {role !== "master_admin" && verificationNeeded && attemptedEmail && <Link href={verificationHref} className="mt-2 inline-block font-bold text-indigo hover:underline">Verify email address →</Link>}
        </div>
      )}
      <Input label={role === "recruiter" ? "Work email" : "Email"} name="email" type="email" autoComplete="email" required />
      <Input label="Password" name="password" type="password" autoComplete="current-password" required />
      <div className="flex items-center justify-between text-sm">
        {role === "master_admin" ? <span className="text-xs text-ink-muted">No self-registration is available.</span> : <Link className="font-semibold text-indigo hover:underline" href="/forgot-password">Forgot password?</Link>}
        {role !== "master_admin" && <Link className="text-ink-muted hover:text-ink" href={role === "recruiter" ? "/recruiter/signup" : "/signup"}>Create account</Link>}
      </div>
      <Button type="submit" size="lg" disabled={pending}>{pending ? "Signing in…" : role === "master_admin" ? "Enter command centre" : "Sign in"}</Button>
    </form>
  );
}
