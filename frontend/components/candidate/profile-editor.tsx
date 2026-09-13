"use client";

import { useEffect, useRef, useState } from "react";

import { ProfileForm } from "@/components/candidate/profile-form";
import { CandidateProfile, CandidateProfileDetails } from "@/lib/candidate";

function formatDateTime(value?: string) {
  if (!value) return "Not recorded yet";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Not recorded yet";
  return new Intl.DateTimeFormat("en-IN", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(date);
}

export function ProfileEditor({ profile, extended }: { profile: CandidateProfile; extended: CandidateProfileDetails }) {
  const hasSavedDetails = Object.keys(extended.details ?? {}).length > 0;
  const [editing, setEditing] = useState(!hasSavedDetails);
  const wrapperRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const root = wrapperRef.current;
    if (!root) return;

    const observer = new MutationObserver(() => {
      if (root.textContent?.includes("Profile details saved.")) {
        setEditing(false);
      }
    });

    observer.observe(root, { childList: true, subtree: true, characterData: true });
    return () => observer.disconnect();
  }, []);

  return (
    <div className="grid gap-5" ref={wrapperRef}>
      <section className="rounded-[1.5rem] border border-line/80 bg-white p-5 shadow-sm sm:p-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-[11px] font-extrabold uppercase tracking-[0.16em] text-indigo">Profile activity</p>
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
          </div>

          <button
            type="button"
            onClick={() => setEditing((value) => !value)}
            className="inline-flex min-h-10 items-center justify-center gap-2 self-start rounded-full border border-indigo/25 bg-white px-4 text-sm font-bold text-indigo transition hover:bg-indigo-soft focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo/30 sm:self-center"
            aria-pressed={editing}
          >
            <span aria-hidden="true">✎</span>
            {editing ? "Cancel edit" : "Edit profile"}
          </button>
        </div>
        {!editing && <p className="mt-4 text-xs leading-5 text-ink-muted">Your saved profile is read-only. Select Edit profile to make changes.</p>}
      </section>

      <fieldset disabled={!editing} className={!editing ? "opacity-[0.92]" : undefined}>
        <ProfileForm profile={profile} extended={extended} />
      </fieldset>
    </div>
  );
}
