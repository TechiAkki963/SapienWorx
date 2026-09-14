"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";

import { CVManager } from "@/components/candidate/cv-manager";
import { ProfileForm } from "@/components/candidate/profile-form";
import { ProfileSummaryCard } from "@/components/candidate/profile-summary-card";
import { CandidateProfile, CandidateProfileDetails, CandidateProfileSummary } from "@/lib/candidate";

function formatDateTime(value?: string) {
  if (!value) return "Not recorded yet";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Not recorded yet";
  return new Intl.DateTimeFormat("en-IN", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(date);
}

export function ProfileEditor({ profile, extended, summary }: { profile: CandidateProfile; extended: CandidateProfileDetails; summary: CandidateProfileSummary }) {
  const router = useRouter();
  const initiallySaved = Object.keys(extended.details ?? {}).length > 0;
  const [saved, setSaved] = useState(initiallySaved);
  const [editing, setEditing] = useState(!initiallySaved);
  const wrapperRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const root = wrapperRef.current;
    if (!root) return;

    const experienceInput = root.querySelector<HTMLInputElement>('input[name="total_experience_months"]');
    if (experienceInput) {
      experienceInput.readOnly = true;
      experienceInput.setAttribute("aria-readonly", "true");
      experienceInput.title = "Calculated automatically from employment history";
      experienceInput.classList.add("bg-canvas", "cursor-not-allowed");
    }

    const observer = new MutationObserver(() => {
      if (root.textContent?.includes("Profile details saved.")) {
        setSaved(true);
        setEditing(false);
        router.refresh();
      }
    });

    observer.observe(root, { childList: true, subtree: true, characterData: true });
    return () => observer.disconnect();
  }, [editing, router]);

  return (
    <div className="grid gap-5" ref={wrapperRef}>
      <ProfileSummaryCard summary={summary} extended={extended} editing={editing} />
      <CVManager currentFilename={extended.cv_original_filename} />

      <section className="rounded-[1.5rem] border border-line/80 bg-white p-5 shadow-sm sm:p-6 print:hidden">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <p className="text-[11px] font-extrabold uppercase tracking-[0.16em] text-indigo">Profile activity</p>
              <span className="rounded-full bg-indigo-soft px-2.5 py-1 text-[10px] font-extrabold uppercase tracking-[0.12em] text-indigo">System generated</span>
            </div>
            <div className="mt-3 flex flex-wrap gap-x-8 gap-y-3 text-sm">
              <div>
                <p className="text-xs font-semibold text-ink-muted">Last active</p>
                <p className="mt-1 font-bold text-navy">{formatDateTime(extended.last_active_at)}</p>
              </div>
              <div>
                <p className="text-xs font-semibold text-ink-muted">Profile updated</p>
                <p className="mt-1 font-bold text-navy">{formatDateTime(extended.profile_updated_at)}</p>
              </div>
            </div>
            <p className="mt-3 text-[11px] leading-5 text-ink-muted">These timestamps are generated automatically by SapienWorx and cannot be edited.</p>
          </div>

          {saved && (
            <button
              type="button"
              onClick={() => setEditing((value) => !value)}
              className="inline-flex min-h-10 items-center justify-center gap-2 self-start rounded-full border border-indigo/25 bg-white px-4 text-sm font-bold text-indigo transition hover:bg-indigo-soft focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo/30 sm:self-center"
              aria-pressed={editing}
            >
              <span aria-hidden="true">✎</span>
              {editing ? "Cancel edit" : "Edit profile"}
            </button>
          )}
        </div>
        {saved && !editing && <p className="mt-4 text-xs leading-5 text-ink-muted">Your saved profile is read-only. Select Edit profile to make changes.</p>}
      </section>

      <fieldset disabled={!editing} className={`${!editing ? "opacity-[0.92]" : ""} [&>form>section:first-of-type]:hidden print:opacity-100`}>
        <ProfileForm profile={profile} extended={extended} />
      </fieldset>
    </div>
  );
}
