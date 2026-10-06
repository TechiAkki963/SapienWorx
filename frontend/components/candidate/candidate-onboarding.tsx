"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";

import { CVParsePreview } from "@/components/candidate/cv-parse-preview";
import { ProfileForm } from "@/components/candidate/profile-form";
import { apiRequest } from "@/lib/api";
import {
  CandidateOnboardingStatus,
  CandidateProfile,
  CandidateProfileDetails,
  candidateOnboardingStatus,
} from "@/lib/candidate";
import "@/components/candidate/profile-v2.css";

type Method = "cv" | "manual";

export function CandidateOnboarding({
  profile,
  extended,
  returnTo,
}: {
  profile: CandidateProfile;
  extended: CandidateProfileDetails;
  returnTo?: string;
}) {
  const router = useRouter();
  const cvAvailable =
    process.env.NEXT_PUBLIC_CV_PARSE_PREVIEW_ENABLED === "true";
  const initialMethod = extended.details?.onboarding_method;
  const [method, setMethod] = useState<Method | null>(
    (initialMethod === "cv" && cvAvailable) || initialMethod === "manual"
      ? (initialMethod as Method)
      : null,
  );
  const [status, setStatus] = useState<CandidateOnboardingStatus>(
    candidateOnboardingStatus(extended) ?? "not_started",
  );
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");

  async function saveProgress(nextStatus: CandidateOnboardingStatus) {
    await apiRequest<CandidateProfileDetails>("/api/v1/candidate/onboarding", {
      method: "PATCH",
      body: JSON.stringify({ status: nextStatus }),
    });
    setStatus(nextStatus);
  }

  async function choose(nextMethod: Method) {
    setBusy(true);
    setMessage("");
    try {
      await saveProgress(nextMethod === "cv" ? "cv_started" : "manual_started");
      setMethod(nextMethod);
      router.refresh();
    } catch {
      setMessage("Could not save your choice. Please try again.");
    } finally {
      setBusy(false);
    }
  }

  async function finish() {
    if (!method) return;
    setBusy(true);
    setMessage("");
    try {
      const [latestProfile, latestDetails] = await Promise.all([
        apiRequest<CandidateProfile>("/api/v1/candidate/profile"),
        apiRequest<CandidateProfileDetails>(
          "/api/v1/candidate/profile/details",
        ),
      ]);
      const details = latestDetails.details ?? {};
      const hasEvidence = ["employment", "education", "it_skills"].some(
        (key) =>
          Array.isArray(details[key]) && (details[key] as unknown[]).length > 0,
      );
      if (
        !latestProfile.full_name.trim() ||
        !(
          latestProfile.headline?.trim() ||
          String(details.current_designation ?? "").trim()
        ) ||
        !latestProfile.current_city?.trim() ||
        !hasEvidence
      ) {
        setMessage(
          "To mark your profile ready, add your name, professional title, current city, and at least one skill, qualification or role. Freshers do not need work history. You can still continue to the dashboard now.",
        );
        return;
      }
      await saveProgress("profile_ready");
      router.push(returnTo || "/candidate/profile");
      router.refresh();
    } catch {
      setMessage(
        "Could not confirm your profile. Your saved details are still available; please retry.",
      );
    } finally {
      setBusy(false);
    }
  }

  async function leaveForNow() {
    if (!method) return;
    setBusy(true);
    setMessage("");
    try {
      router.push("/candidate");
      router.refresh();
    } catch {
      setMessage("Could not save your progress. Please retry before leaving.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mx-auto grid max-w-5xl gap-5">
      <header className="rounded-[1.5rem] border border-indigo/15 bg-gradient-to-br from-white via-indigo-soft/30 to-mint/30 p-6 shadow-sm sm:p-8">
        <p className="text-[11px] font-extrabold uppercase tracking-[0.16em] text-indigo">
          Candidate onboarding
        </p>
        <h1 className="mt-2 font-serif text-3xl font-semibold tracking-tight text-navy sm:text-4xl">
          Build your professional profile
        </h1>
        <p className="mt-2 max-w-2xl text-sm leading-6 text-ink-muted">
          Your candidate portal is open. Continue at your pace; you can change
          how you build your profile without losing saved details.
        </p>
        {status !== "not_started" && (
          <p className="mt-3 text-xs font-semibold text-indigo">
            Progress: {status.replaceAll("_", " ")}. Your profile is saved as
            you go.
          </p>
        )}
      </header>

      <div
        className="grid gap-4 sm:grid-cols-2"
        aria-label="Switch profile creation method"
      >
        <section
          className={`rounded-2xl border p-5 shadow-sm ${method === "cv" ? "border-indigo bg-indigo-soft/35" : "border-line bg-white"}`}
        >
          <p className="text-xs font-extrabold uppercase tracking-wider text-indigo">
            Faster setup
          </p>
          <h2 className="mt-2 text-xl font-bold text-navy">Upload my CV</h2>
          <p className="mt-2 text-sm leading-6 text-ink-muted">
            {cvAvailable
              ? "Get suggestions from your CV, then review and correct them before saving. Nothing is published automatically."
              : "CV-assisted setup will open after safe document processing is ready. You can build the same profile manually now."}
          </p>
          <button
            type="button"
            disabled={busy || !cvAvailable}
            onClick={() => void choose("cv")}
            className="mt-4 min-h-11 rounded-xl bg-indigo px-4 text-sm font-bold text-white disabled:opacity-50"
          >
            {method === "cv"
              ? "Continue CV review"
              : cvAvailable
                ? "Switch to CV"
                : "CV setup unavailable"}
          </button>
        </section>
        <section
          className={`rounded-2xl border p-5 shadow-sm ${method === "manual" ? "border-indigo bg-indigo-soft/35" : "border-line bg-white"}`}
        >
          <p className="text-xs font-extrabold uppercase tracking-wider text-indigo">
            At your pace
          </p>
          <h2 className="mt-2 text-xl font-bold text-navy">Create manually</h2>
          <p className="mt-2 text-sm leading-6 text-ink-muted">
            Build your profile in four core steps. Optional details can be added
            later. You can add a CV without losing what you entered.
          </p>
          <button
            type="button"
            disabled={busy}
            onClick={() => void choose("manual")}
            className="mt-4 min-h-11 rounded-xl border border-indigo/25 bg-white px-4 text-sm font-bold text-indigo disabled:opacity-50"
          >
            {method === "manual" ? "Continue builder" : "Switch to manual"}
          </button>
        </section>
      </div>

      {message && (
        <p
          role="status"
          className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm font-semibold text-amber-900"
        >
          {message}
        </p>
      )}
      {method === "cv" && (
        <section
          className="grid gap-4"
          aria-label="CV-assisted profile creation"
        >
          <p className="text-sm leading-6 text-ink-muted">
            This local preview does not store your CV. It only suggests values
            for the same profile you edit manually. Scanned PDFs may take
            longer, and all suggestions need your review.
          </p>
          <CVParsePreview
            profile={profile}
            extended={extended}
            editing={false}
            onPreviewReady={() =>
              void saveProgress("review_required").catch(() =>
                setMessage(
                  "Could not save the review state. Your CV suggestions remain visible on this page.",
                ),
              )
            }
            onApplied={() =>
              void saveProgress("cv_started").catch(() =>
                setMessage(
                  "Profile changes were saved, but onboarding progress could not be updated.",
                ),
              )
            }
          />
          <div className="flex flex-wrap items-center gap-3">
            <button
              type="button"
              disabled={busy}
              onClick={() => void finish()}
              className="min-h-11 rounded-xl bg-indigo px-4 text-sm font-bold text-white disabled:opacity-50"
            >
              Confirm profile is ready
            </button>
            <button
              type="button"
              disabled={busy}
              onClick={() => void choose("manual")}
              className="text-sm font-bold text-indigo hover:underline"
            >
              CV not working? Continue manually →
            </button>
            <Link
              href="/candidate/profile"
              className="text-sm font-bold text-indigo hover:underline"
            >
              Review full profile →
            </Link>
          </div>
        </section>
      )}
      {method === "manual" && (
        <section aria-label="Guided profile builder">
          <ProfileForm
            profile={profile}
            extended={extended}
            guided
            onSaved={() => void finish()}
          />
        </section>
      )}
      {method && (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-line bg-white p-4 text-sm">
          <p className="text-ink-muted">
            You can leave and return later. Profile completion does not need to
            reach 100%.
          </p>
          <button
            type="button"
            disabled={busy}
            onClick={() => void leaveForNow()}
            className="min-h-10 font-bold text-indigo disabled:opacity-50"
          >
            Continue to dashboard for now →
          </button>
        </div>
      )}
      <p className="text-xs leading-5 text-ink-muted">
        Uploading a CV does not enable recruiter discovery, public profile
        sharing or unsolicited outreach. Control those separately in your{" "}
        <Link
          href="/candidate/profile"
          className="font-bold text-indigo underline"
        >
          profile privacy settings
        </Link>
        .
      </p>
    </div>
  );
}
