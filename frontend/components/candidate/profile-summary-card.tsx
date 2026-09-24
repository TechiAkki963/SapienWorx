"use client";

import { ChangeEvent, useMemo, useRef, useState } from "react";
import Link from "next/link";

import { Button } from "@/components/ui/button";
import { apiRequest } from "@/lib/api";
import { CandidateProfileSummary } from "@/lib/candidate";

function experienceLabel(months: number) {
  const years = Math.floor(months / 12);
  const rest = months % 12;
  if (!years) return `${rest} month${rest === 1 ? "" : "s"}`;
  return `${years} yr${years === 1 ? "" : "s"}${rest ? ` ${rest} mo` : ""}`;
}

function initials(name: string) {
  return name.split(/\s+/).filter(Boolean).map((part) => part[0]).slice(0, 2).join("").toUpperCase() || "CP";
}

export function ProfileSummaryCard({ summary, onEdit }: { summary: CandidateProfileSummary; onEdit: () => void }) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const preferredLocations = summary.preferred_locations ?? [];
  const sharePath = `/profile/${summary.share_token}`;
  const shareURL = useMemo(() => typeof window === "undefined" ? sharePath : `${window.location.origin}${sharePath}`, [sharePath]);

  async function uploadPhoto(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;
    if (!["image/jpeg", "image/png", "image/webp"].includes(file.type)) {
      setMessage("Use a JPEG, PNG or WebP image.");
      return;
    }
    if (file.size > 2 * 1024 * 1024) {
      setMessage("Profile photo must be 2 MB or smaller.");
      return;
    }
    setBusy(true);
    setMessage("");
    const reader = new FileReader();
    reader.onload = async () => {
      try {
        await apiRequest("/api/v1/candidate/profile/photo", { method: "PATCH", body: JSON.stringify({ data_url: String(reader.result ?? "") }) });
        setMessage("Profile photo updated.");
        window.location.reload();
      } catch (cause) {
        setMessage(cause instanceof Error ? cause.message : "Could not update profile photo.");
      } finally {
        setBusy(false);
        if (inputRef.current) inputRef.current.value = "";
      }
    };
    reader.readAsDataURL(file);
  }

  async function shareProfile() {
    if (!summary.profile_visible) {
      setMessage("Turn on the shareable profile link in Profile visibility before sharing.");
      return;
    }
    try {
      if (navigator.share) {
        await navigator.share({ title: `${summary.full_name} — SapienWorx profile`, url: shareURL });
      } else {
        await navigator.clipboard.writeText(shareURL);
        setMessage("Profile link copied.");
      }
    } catch {
      // A user cancelling the native share sheet is not an error worth surfacing.
    }
  }

  return (
    <section className="rounded-[1.5rem] border border-line/80 bg-white p-5 shadow-sm sm:p-6" aria-labelledby="candidate-identity-title">
      <div className="flex flex-col gap-5 sm:flex-row sm:items-center">
        <div className="relative h-20 w-20 shrink-0">
          {summary.photo_data_url ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={summary.photo_data_url} alt={`${summary.full_name} profile`} className="h-20 w-20 rounded-full border-4 border-indigo-soft object-cover shadow-sm" />
          ) : (
            <div className="flex h-20 w-20 items-center justify-center rounded-full bg-navy text-xl font-bold text-white shadow-sm" aria-hidden="true">{initials(summary.full_name)}</div>
          )}
          <button type="button" disabled={busy} onClick={() => inputRef.current?.click()} className="absolute -bottom-1 -right-1 grid h-9 w-9 place-items-center rounded-full border-2 border-white bg-indigo text-base text-white shadow-card transition hover:bg-blue-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo/50" aria-label={summary.photo_data_url ? "Change profile photo" : "Upload profile photo"}>✎</button>
          <input ref={inputRef} className="sr-only" type="file" accept="image/jpeg,image/png,image/webp" onChange={uploadPhoto} />
        </div>

        <div className="min-w-0 flex-1">
          <p className="text-[10px] font-extrabold uppercase tracking-[0.16em] text-indigo">Your professional identity</p>
          <h2 id="candidate-identity-title" className="mt-1 font-serif text-2xl font-semibold tracking-[-0.035em] text-navy sm:text-[1.8rem]">{summary.full_name}</h2>
          <p className="mt-1 text-sm text-ink-muted">{summary.headline || "Add your professional headline"}</p>
          <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-2 text-xs font-semibold text-ink-muted">
            {summary.current_location && <span>{summary.current_location}</span>}
            <span>{experienceLabel(summary.total_experience_months)} experience</span>
            <span className={`inline-flex items-center gap-1.5 ${summary.profile_visible ? "text-emerald-700" : "text-ink-muted"}`}><span className={`h-2 w-2 rounded-full ${summary.profile_visible ? "bg-emerald-500" : "bg-slate-300"}`} aria-hidden="true" />Shareable link {summary.profile_visible ? "on" : "private"}</span>
          </div>
          {preferredLocations.length > 0 && <p className="mt-2 text-xs text-ink-muted"><span className="font-semibold text-navy">Open to:</span> {preferredLocations.join(" · ")}</p>}
        </div>

        <div className="flex flex-wrap gap-2 sm:justify-end">
          <Button type="button" onClick={onEdit}>Edit profile</Button>
          <Button type="button" variant="secondary" onClick={() => window.print()}>Save as PDF</Button>
          {summary.profile_visible && <Link href={sharePath} target="_blank" rel="noreferrer" className="inline-flex min-h-10 items-center justify-center rounded-full border border-line bg-white px-4 text-sm font-semibold text-navy transition hover:bg-canvas focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo/40">Preview</Link>}
          <Button type="button" variant="secondary" onClick={shareProfile} disabled={!summary.profile_visible}>Share link</Button>
        </div>
      </div>
      <div className="mt-5 grid gap-3 border-t border-line/70 pt-4 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center">
        <div>
          <p className="text-sm font-bold text-navy">{summary.profile_completion}% complete</p>
          <p className="mt-1 text-xs leading-5 text-ink-muted">A clear, current profile helps people understand the work you want to do.</p>
          <div className="mt-3 h-2 overflow-hidden rounded-full bg-slate-100" role="progressbar" aria-label="Profile completeness" aria-valuemin={0} aria-valuemax={100} aria-valuenow={summary.profile_completion}>
            <div className="h-full rounded-full bg-gradient-to-r from-indigo to-blue-500 transition-[width] duration-500" style={{ width: `${Math.max(0, Math.min(summary.profile_completion, 100))}%` }} />
          </div>
        </div>
        <p className="rounded-xl bg-indigo-soft/45 px-3 py-2 text-xs text-indigo sm:max-w-56"><span className="font-bold">Your information stays yours.</span> You choose whether to turn on the shareable profile link.</p>
      </div>
      {message && <p role="status" className="mt-4 rounded-xl bg-indigo-soft/55 px-3 py-2 text-xs font-semibold text-navy">{message}</p>}
    </section>
  );
}
