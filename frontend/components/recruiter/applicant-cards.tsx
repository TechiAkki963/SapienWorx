"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";

import { StatusMenu } from "@/components/recruiter/status-menu";
import { apiRequest } from "@/lib/api";
import { experience, label, PipelineRow, stages } from "@/lib/recruiter";

function provided(value?: string | null) { return value?.trim() || "Not provided"; }
function date(value: string) { return new Intl.DateTimeFormat("en-IN", { dateStyle: "medium", timeZone: "Asia/Kolkata" }).format(new Date(value)); }
function relative(value: string | undefined, now: number) {
  if (!value) return "Not provided";
  const days = Math.max(0, Math.floor((now - new Date(value).getTime()) / 86400000));
  return days === 0 ? "Today" : days === 1 ? "1 day ago" : `${days} days ago`;
}

export function ApplicantCards({ rows, now }: { rows: PipelineRow[]; now: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState("");
  const [error, setError] = useState("");
  const nowTime = new Date(now).getTime();

  async function changeStage(row: PipelineRow, stage: string) {
    setBusy(row.application_id);
    setError("");
    try {
      await apiRequest(`/api/v1/recruiter/applications/${row.application_id}/stage`, { method: "PATCH", body: JSON.stringify({ stage }) });
      router.refresh();
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Could not change application stage."); }
    finally { setBusy(""); }
  }

  if (!rows.length) return <div className="rounded-2xl border border-dashed border-line bg-white p-8 text-center"><h2 className="font-bold text-navy">No applications match these filters</h2><p className="mt-1 text-sm text-ink-muted">Try another stage or wait for candidates to apply.</p></div>;

  return <div className="grid gap-3 2xl:grid-cols-2" aria-label="Applicant cards">
    {error && <p role="alert" className="rounded-xl border border-rose-200 bg-rose-50 p-3 text-sm text-rose-800 2xl:col-span-2">{error}</p>}
    {rows.map(row => {
      const profileHref = `/recruiter/candidates/${row.candidate_id}?job_id=${encodeURIComponent(row.job_id)}`;
      const initials = row.candidate_name.split(/\s+/).filter(Boolean).map(part => part[0]).slice(0, 2).join("").toUpperCase();
      return <article key={row.application_id} className="min-w-0 rounded-2xl border border-line/70 bg-white p-4 shadow-sm sm:p-5">
        <div className="flex flex-wrap items-start justify-between gap-3"><div className="flex min-w-0 items-center gap-3"><span aria-hidden="true" className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-indigo-soft font-extrabold text-indigo">{initials}</span><div className="min-w-0"><h2 className="text-base font-extrabold text-navy">{row.candidate_name}</h2><p className="text-sm font-semibold text-indigo">{provided(row.designation || row.headline)}</p><p className="mt-0.5 text-xs text-ink-muted">{provided(row.current_company)} · {row.experience_months > 0 ? `${experience(row.experience_months)} experience` : "Experience not provided"}</p></div></div><span className="rounded-full bg-indigo-soft/60 px-3 py-1 text-xs font-bold text-indigo">{label(row.stage)}</span></div>
        <dl className="mt-4 grid grid-cols-2 gap-x-4 gap-y-3 border-t border-line/70 pt-4 text-xs sm:grid-cols-3">
          <div><dt className="text-ink-muted">Applied for</dt><dd className="mt-0.5 font-semibold text-navy">{row.job_title}</dd></div>
          <div><dt className="text-ink-muted">Current company</dt><dd className="mt-0.5 font-semibold text-navy">{provided(row.current_company)}</dd></div>
          <div><dt className="text-ink-muted">Education</dt><dd className="mt-0.5 font-semibold text-navy">{provided(row.education)}</dd></div>
          <div><dt className="text-ink-muted">University</dt><dd className="mt-0.5 font-semibold text-navy">{provided(row.university)}</dd></div>
          <div><dt className="text-ink-muted">Current location</dt><dd className="mt-0.5 font-semibold text-navy">{provided(row.city)}</dd></div>
          <div><dt className="text-ink-muted">Preferred location</dt><dd className="mt-0.5 font-semibold text-navy">{provided(row.preferred_location)}</dd></div>
          <div><dt className="text-ink-muted">Last active</dt><dd className="mt-0.5 font-semibold text-navy">{relative(row.last_active_at, nowTime)}</dd></div>
          <div><dt className="text-ink-muted">Profile updated</dt><dd className="mt-0.5 font-semibold text-navy">{date(row.profile_updated_at)}</dd></div>
        </dl>
        <div className="mt-4 flex flex-wrap items-end gap-2 border-t border-line/70 pt-4">
          <label className="grid gap-1 text-xs font-semibold text-ink-muted">Application stage<StatusMenu value={row.stage} options={stages} disabled={busy === row.application_id} ariaLabel={`Stage for ${row.candidate_name} on ${row.job_title}`} onChange={stage => void changeStage(row, stage)} /></label>
          <Link href={profileHref} className="rounded-lg border border-line px-3 py-2 text-xs font-bold text-navy hover:border-indigo/40">View profile</Link>
          <Link href={`${profileHref}&compose=1`} className="rounded-lg bg-indigo px-3 py-2 text-xs font-bold text-white hover:bg-navy">Send InMail</Link>
          <Link href={`${profileHref}&compose=1&request_contact=1`} className="rounded-lg border border-line px-3 py-2 text-xs font-bold text-indigo hover:border-indigo/40">Request contact</Link>
        </div>
      </article>;
    })}
  </div>;
}
