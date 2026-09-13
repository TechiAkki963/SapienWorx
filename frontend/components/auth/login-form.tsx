"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { FormEvent, useState } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { apiRequest } from "@/lib/api";

type Role = "candidate" | "recruiter" | "master_admin";

export function LoginForm({ role }: { role: Role }) {
  const router = useRouter();
  const [error, setError] = useState("");
  const [pending, setPending] = useState(false);
  const destination = role === "candidate" ? "/candidate" : role === "recruiter" ? "/recruiter" : "/_admin";

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(""); setPending(true);
    const data = new FormData(event.currentTarget);
    try {
      await apiRequest("/api/v1/auth/login", { method: "POST", body: JSON.stringify({ email: data.get("email"), password: data.get("password"), role }) });
      router.replace(destination); router.refresh();
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Login failed."); }
    finally { setPending(false); }
  }

  return (
    <form className="grid gap-5" onSubmit={submit}>
      <div><p className="text-sm font-semibold text-indigo">Welcome back</p><h2 className="mt-2 text-3xl font-semibold tracking-[-0.03em] text-ink">Sign in to SapienWorx</h2></div>
      {error && <p className="rounded-2xl bg-red-50 p-3 text-sm text-red-700" role="alert">{error}</p>}
      <Input label={role === "recruiter" ? "Work email" : "Email"} name="email" type="email" autoComplete="email" required />
      <Input label="Password" name="password" type="password" autoComplete="current-password" required />
      <div className="flex items-center justify-between text-sm"><Link className="font-semibold text-indigo hover:underline" href="/forgot-password">Forgot password?</Link>{role !== "master_admin" && <Link className="text-ink-muted hover:text-ink" href={role === "recruiter" ? "/recruiter/signup" : "/signup"}>Create account</Link>}</div>
      <Button type="submit" size="lg" disabled={pending}>{pending ? "Signing in…" : "Sign in"}</Button>
    </form>
  );
}
