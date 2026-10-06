"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { apiRequest } from "@/lib/api";
import type { SessionUser } from "@/lib/auth-server";

let pendingRenewal: Promise<SessionUser> | null = null;
function renew() {
  if (!pendingRenewal)
    pendingRenewal = apiRequest<SessionUser>("/api/v1/auth/me").finally(() => {
      pendingRenewal = null;
    });
  return pendingRenewal;
}
export function CandidateSessionRenewal({ returnTo }: { returnTo: string }) {
  const router = useRouter();
  const [error, setError] = useState("");
  useEffect(() => {
    let active = true;
    renew()
      .then(() => {
        if (!active) return;
        const target = new URL(returnTo, window.location.origin);
        target.searchParams.set("_swxrenew", "1");
        router.replace(target.pathname + target.search + target.hash);
        router.refresh();
      })
      .catch((cause) => {
        if (active)
          setError(
            cause instanceof Error
              ? cause.message
              : "Your session could not be restored. Please sign in again.",
          );
      });
    return () => {
      active = false;
    };
  }, [returnTo, router]);
  return (
    <div className="mx-auto max-w-lg px-6 py-20">
      <h1 className="text-2xl font-bold">Reconnecting your workspace</h1>
      {error ? (
        <>
          <p role="alert" className="mt-4 text-sm text-ink-muted">
            {error}
          </p>
          <a
            href="/login"
            className="mt-6 inline-block font-semibold text-indigo"
          >
            Sign in again →
          </a>
        </>
      ) : (
        <p role="status" className="mt-4 text-sm text-ink-muted">
          Restoring your secure session…
        </p>
      )}
    </div>
  );
}
