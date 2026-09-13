"use client";

import { ChangeEvent, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";

import { Button } from "@/components/ui/button";
import { apiRequest } from "@/lib/api";
import { CandidateProfileDetails, CandidateProfileSummary } from "@/lib/candidate";

function experienceLabel(months: number) {
  const years = Math.floor(months / 12);
  const rest = months % 12;
  if (!years) return `${rest} month${rest === 1 ? "" : "s"}`;
  return `${years} yr${years === 1 ? "" : "s"}${rest ? ` ${rest} mo` : ""}`;
}

function initials(name: string) {
  return name.split(/\s+/).filter(Boolean).map((part) => part[0]).slice(0, 2).join("").toUpperCase() || "CP";
}

export function ProfileSummaryCard({ summary, extended, editing }: { summary: CandidateProfileSummary; extended: CandidateProfileDetails; editing: boolean }) {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [secondaryPhone, setSecondaryPhone] = useState(summary.secondary_phone ?? "");
  const [message, setMessage] = useState("");
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
        router.refresh();
      } catch (cause) {
        setMessage(cause instanceof Error ? cause.message : "Could not update profile photo.");
      } finally {
        setBusy(false);
        if (inputRef.current) inputRef.current.value = "";
      }
    };
    reader.readAsDataURL(file);
  }

  async function saveSecondaryPhone() {
    setBusy(true);
    setMessage("");
    try {
      await apiRequest("/api/v1/candidate/profile/details", {
        method: "PATCH",
        body: JSON.stringify({
          details: { ...(extended.details ?? {}), secondary_phone: secondaryPhone.trim() },
          current_salary_amount: extended.current_salary_amount ?? null,
          current_salary_currency: extended.current_salary_currency || "INR",
          expected_salary_amount: extended.expected_salary_amount ?? null,
          expected_salary_currency: extended.expected_salary_currency || "INR",
        }),
      });
      setMessage("Secondary mobile updated.");
      router.refresh();
    } catch (cause) {
      setMessage(cause instanceof Error ? cause.message : "Could not update secondary mobile.");
    } finally {
      setBusy(false);
    }
  }

  async function shareProfile() {
    if (!summary.profile_visible) {
      setMessage("Enable ‘Visible in sourcing’ while editing your profile before sharing it publicly.");
      return;
    }
    try {
      if (navigator.share) {
        await navigator.share({ title: `${summary.full_name} — SapienWorx profile`, url: shareURL });
      } else {
        await navigator.clipboard.writeText(shareURL);
        setMessage("Public profile link copied.");
      }
    } catch {
      // A user cancelling the native share sheet is not an error worth surfacing.
    }
  }

  return (
    <section className="rounded-[1.75rem] border border-line/80 bg-white p-5 shadow-sm sm:p-6">
      <div className="grid gap-6 xl:grid-cols-[auto_minmax(0,1.15fr)_minmax(17rem,.85fr)_auto] xl:items-center">
        <div className="relative h-24 w-24 shrink-0">
          {summary.photo_data_url ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={summary.photo_data_url} alt={`${summary.full_name} profile`} className="h-24 w-24 rounded-full border-4 border-indigo-soft object-cover shadow-sm" />
          ) : (
            <div className="flex h-24 w-24 items-center justify-center rounded-full bg-navy text-xl font-bold text-white shadow-sm">{initials(summary.full_name)}</div>
          )}
          <button type="button" disabled={busy} onClick={() => inputRef.current?.click()} className="absolute -bottom-1 -right-1 flex h-9 w-9 items-center justify-center rounded-full border-2 border-white bg-indigo text-base text-white shadow-card transition hover:scale-105" aria-label={summary.photo_data_url ? "Change profile photo" : "Upload profile photo"}>✎</button>
          <input ref={inputRef} className="sr-only" type="file" accept="image/jpeg,image/png,image/webp" onChange={uploadPhoto} />
        </div>

        <div className="min-w-0">
          <p className="text-[11px] font-extrabold uppercase tracking-[0.16em] text-indigo">Candidate profile</p>
          <h2 className="mt-1 text-2xl font-bold tracking-[-0.03em] text-navy">{summary.full_name}</h2>
          <p className="mt-1 text-sm text-ink-muted">{summary.headline || "Add your professional headline"}</p>
          <div className="mt-4 flex flex-wrap gap-2">
            <span className="rounded-full bg-indigo-soft px-3 py-1.5 text-xs font-bold text-indigo">{summary.profile_completion}% complete</span>
            <span className="rounded-full bg-canvas px-3 py-1.5 text-xs font-semibold text-ink-muted">{experienceLabel(summary.total_experience_months)} experience</span>
            {summary.current_location && <span className="rounded-full bg-canvas px-3 py-1.5 text-xs font-semibold text-ink-muted">⌖ {summary.current_location}</span>}
          </div>
          {summary.preferred_locations.length > 0 && <p className="mt-3 text-xs text-ink-muted"><span className="font-bold text-navy">Preferred:</span> {summary.preferred_locations.join(" · ")}</p>}
        </div>

        <div className="grid gap-3 rounded-2xl border border-line/70 bg-canvas/55 p-4 text-sm">
          <div><p className="text-[11px] font-bold uppercase tracking-wide text-ink-muted">Email</p><div className="mt-1 flex flex-wrap items-center gap-2"><span className="font-semibold text-navy">{summary.email}</span><span className={`rounded-full px-2 py-0.5 text-[10px] font-extrabold uppercase ${summary.email_verified ? "bg-mint text-emerald-800" : "bg-peach text-amber-800"}`}>{summary.email_verified ? "Verified" : "Not verified"}</span></div></div>
          <div><p className="text-[11px] font-bold uppercase tracking-wide text-ink-muted">Mobile numbers</p><p className="mt-1 font-semibold text-navy">{summary.primary_phone || "Primary mobile not available"}</p>{editing ? <div className="mt-2 flex gap-2"><input value={secondaryPhone} onChange={(event) => setSecondaryPhone(event.target.value)} placeholder="Secondary mobile" className="min-h-9 min-w-0 flex-1 rounded-lg border border-line bg-white px-2 text-xs outline-none focus:border-indigo/50" /><button type="button" onClick={saveSecondaryPhone} disabled={busy} className="rounded-lg border border-indigo/25 px-2 text-xs font-bold text-indigo">Save</button></div> : <p className="mt-1 text-xs text-ink-muted">{summary.secondary_phone || "Secondary mobile not added"}</p>}</div>
        </div>

        <div className="flex flex-wrap gap-2 xl:flex-col">
          <Button type="button" variant="secondary" onClick={() => window.print()}>Download PDF</Button>
          <Button type="button" variant="secondary" onClick={shareProfile}>Share profile</Button>
          <button type="button" onClick={() => inputRef.current?.click()} className="min-h-10 rounded-full border border-indigo/25 bg-white px-4 text-sm font-bold text-indigo hover:bg-indigo-soft">{summary.photo_data_url ? "Update photo" : "Upload photo"}</button>
        </div>
      </div>
      {message && <p role="status" className="mt-4 rounded-xl bg-indigo-soft/55 px-3 py-2 text-xs font-semibold text-navy">{message}</p>}
    </section>
  );
}
