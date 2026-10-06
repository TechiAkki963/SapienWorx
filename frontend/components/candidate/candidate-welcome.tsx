"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";

import { LogoutButton } from "@/components/auth/logout-button";
import { Wordmark } from "@/components/brand/wordmark";
import { apiRequest } from "@/lib/api";

export function CandidateWelcome({
  firstName,
  returnTo,
}: {
  firstName: string;
  returnTo?: string;
}) {
  const router = useRouter();
  const cvAvailable =
    process.env.NEXT_PUBLIC_CV_PARSE_PREVIEW_ENABLED === "true";
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function choose(status: "manual_started" | "cv_started") {
    setBusy(true);
    setError("");
    try {
      await apiRequest("/api/v1/candidate/onboarding", {
        method: "PATCH",
        body: JSON.stringify({ status, return_to: returnTo }),
      });
      router.replace(
        `/candidate/onboarding${returnTo ? `?next=${encodeURIComponent(returnTo)}` : ""}`,
      );
      router.refresh();
    } catch {
      setError("We couldn't save your choice. Please try again.");
      setBusy(false);
    }
  }

  return (
    <main
      id="main-content"
      className="theme-surface candidate-welcome flex min-h-screen items-center justify-center bg-gradient-to-br from-indigo-soft/35 via-[#f8f9fd] to-mint/30 px-4 py-8 text-ink sm:px-6"
    >
      <div className="w-full max-w-4xl rounded-[2rem] border border-indigo/10 bg-white p-6 shadow-[0_24px_80px_rgba(31,42,91,0.10)] sm:p-10 lg:p-12">
        <div className="flex justify-center">
          <Wordmark />
        </div>
        <div className="mx-auto mt-9 max-w-2xl text-center">
          <p className="text-xs font-extrabold uppercase tracking-[0.2em] text-indigo">
            Welcome to SapienWorx
          </p>
          <h1 className="mt-3 font-serif text-4xl font-semibold tracking-tight text-navy sm:text-5xl">
            Welcome, {firstName || "there"}!
          </h1>
          <p className="mt-4 text-base leading-7 text-ink-muted">
            Your next career opportunity starts with your professional profile.
          </p>
          <p className="mt-5 text-sm font-semibold text-navy">
            How would you like to create yours?
          </p>
        </div>
        <div className="mt-8 grid gap-4 sm:grid-cols-2">
          <section className="flex flex-col rounded-2xl border border-indigo/15 bg-indigo-soft/20 p-6">
            <p className="text-xs font-bold uppercase tracking-wider text-indigo">
              Recommended · fastest setup
            </p>
            <h2 className="mt-2 text-2xl font-bold text-navy">Upload My CV</h2>
            <p className="mt-3 flex-1 text-sm leading-6 text-ink-muted">
              Let SapienWorx extract your professional information from your
              resume. You can review and edit everything before saving.
            </p>
            {!cvAvailable && (
              <p
                role="note"
                className="mt-3 rounded-lg bg-amber-50 p-3 text-xs font-semibold text-amber-900"
              >
                CV-assisted setup is temporarily unavailable while safe
                processing is being prepared.
              </p>
            )}
            <button
              type="button"
              disabled={busy || !cvAvailable}
              onClick={() => void choose("cv_started")}
              className="mt-6 min-h-11 rounded-xl bg-indigo px-4 text-sm font-bold text-white disabled:cursor-not-allowed disabled:opacity-50"
            >
              {cvAvailable ? "Continue with CV" : "CV setup unavailable"}
            </button>
          </section>
          <section className="flex flex-col rounded-2xl border border-indigo/15 bg-mint/20 p-6">
            <p className="text-xs font-bold uppercase tracking-wider text-indigo">
              At your pace
            </p>
            <h2 className="mt-2 text-2xl font-bold text-navy">
              Create Manually
            </h2>
            <p className="mt-3 flex-1 text-sm leading-6 text-ink-muted">
              Tell your professional story step by step. Add your experience,
              education and skills at your own pace.
            </p>
            <button
              type="button"
              disabled={busy}
              onClick={() => void choose("manual_started")}
              className="mt-6 min-h-11 rounded-xl border border-indigo/25 bg-white px-4 text-sm font-bold text-indigo disabled:opacity-50"
            >
              Create My Profile
            </button>
          </section>
        </div>
        {error && (
          <p
            role="alert"
            className="mt-5 rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700"
          >
            {error}
          </p>
        )}
        <p className="mt-7 text-center text-xs leading-5 text-ink-muted">
          You can update your profile or upload a new CV later.
        </p>
        <footer className="mt-5 flex flex-wrap items-center justify-center gap-4 border-t border-line pt-5 text-xs text-ink-muted">
          <Link href="/privacy" className="hover:text-indigo">
            Privacy
          </Link>
          <span aria-hidden="true">·</span>
          <LogoutButton />
        </footer>
      </div>
    </main>
  );
}
