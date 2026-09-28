"use client";

import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { CandidateComments } from "@/components/recruiter/candidate-comments";
import { CandidateContact } from "@/components/recruiter/candidate-contact";
import { StatusMenu } from "@/components/recruiter/status-menu";
import { apiRequest } from "@/lib/api";
import { experience, Interview, PipelineRow, stages } from "@/lib/recruiter";

const provided = (value?: string | null) => value?.trim() || "Not provided";
const date = (value?: string) => value ? new Intl.DateTimeFormat("en-IN", { dateStyle: "medium", timeZone: "Asia/Kolkata" }).format(new Date(value)) : "Not provided";

function CardIcon({ name, className = "h-4 w-4" }: { name: "bookmark" | "eye" | "mail" | "building" | "briefcase" | "pin" | "calendar" | "clock" | "file" | "download"; className?: string }) {
  const paths = {
    bookmark: "M6 3h12v18l-6-4-6 4V3Z",
    eye: "M2 12s4-6 10-6 10 6 10 6-4 6-10 6S2 12 2 12Zm10-3a3 3 0 1 0 0 6 3 3 0 0 0 0-6Z",
    mail: "M3 5h18v14H3V5Zm0 1 9 7 9-7",
    building: "M4 21V4l8-2v19m0-14h8v14M2 21h20M7 7v2m0 3v2m0 3v2m8-9v2m3-2v2",
    briefcase: "M3 7h18v13H3V7Zm5 0V5a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2M3 12h18",
    pin: "M12 22s7-6 7-12a7 7 0 0 0-14 0c0 6 7 12 7 12Zm0-14a2 2 0 1 0 0 4 2 2 0 0 0 0-4Z",
    calendar: "M4 5h16v16H4V5Zm0 5h16M8 3v4m8-4v4",
    clock: "M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18Zm0 4v5l3 2",
    file: "M6 2h8l4 4v16H6V2Zm8 0v5h4M9 11h6m-6 4h6",
    download: "M12 3v12m-4-4 4 4 4-4M4 17v4h16v-4",
  };
  return <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" className={className}><path d={paths[name]} /></svg>;
}

function Detail({ title, value, hiddenOnMobile = false }: { title: string; value: string; hiddenOnMobile?: boolean }) {
  return <div className={`grid min-w-0 grid-cols-[minmax(6rem,0.9fr)_minmax(0,1fr)] gap-x-2 text-xs sm:grid-cols-1 sm:text-sm lg:grid-cols-[minmax(7rem,0.9fr)_minmax(0,1fr)] ${hiddenOnMobile ? "max-sm:hidden" : ""}`}><dt className="text-[#526990]">{title}</dt><dd className="min-w-0 break-words font-semibold text-navy">{value}</dd></div>;
}

function CVControls({ row }: { row: PipelineRow }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  async function open(mode: "view" | "download") {
    setBusy(true); setError("");
    try { const response = await apiRequest<{ download: { url: string } }>(`/api/v1/recruiter/candidates/${row.candidate_id}/cv${mode === "view" ? "?mode=view" : ""}`); window.open(response.download.url, "_blank", "noopener,noreferrer"); }
    catch { setError("Private CV unavailable."); }
    finally { setBusy(false); }
  }
  return <div className="flex min-w-0 flex-wrap items-center gap-2"><span className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-blue-50 text-blue-600"><CardIcon name="file" className="h-5 w-5" /></span><div className="min-w-0 flex-1"><p className="text-[11px] text-[#526990]">CV / Resume</p><p className="truncate font-semibold text-navy" title={row.cv_filename}>{row.cv_filename || "No resume uploaded"}</p></div>{row.cv_filename && <div className="flex flex-wrap gap-2"><button type="button" onClick={() => void open("view")} disabled={busy} className="inline-flex min-h-9 items-center gap-1 rounded-lg border border-blue-200 px-2 font-bold text-blue-700"><CardIcon name="eye" />View</button><button type="button" onClick={() => void open("download")} disabled={busy} className="inline-flex min-h-9 items-center gap-1 rounded-lg border border-blue-200 px-2 font-bold text-blue-700"><CardIcon name="download" />Download</button></div>}{error && <p role="alert" className="w-full text-rose-700">{error}</p>}</div>;
}

export function ApplicantCardWorkspace({ rows, now }: { rows: PipelineRow[]; now: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState("");
  const [error, setError] = useState("");
  const [selected, setSelected] = useState<string[]>([]);
  const [savedState, setSavedState] = useState<Record<string, boolean>>({});
  const nowTime = new Date(now).getTime();
  async function changeStage(row: PipelineRow, stage: string) {
    setBusy(row.application_id); setError("");
    try { await apiRequest(`/api/v1/recruiter/applications/${row.application_id}/stage`, { method: "PATCH", body: JSON.stringify({ stage }) }); router.refresh(); }
    catch { setError("Could not change application stage."); }
    finally { setBusy(""); }
  }
  async function toggleSave(row: PipelineRow) {
    setBusy(row.application_id); setError("");
    const saved = savedState[row.candidate_id] ?? row.saved;
    try { await apiRequest(`/api/v1/recruiter/talent-pool/${row.candidate_id}`, saved ? { method: "DELETE" } : { method: "PUT", body: JSON.stringify({ tags: [] }) }); setSavedState(current => ({ ...current, [row.candidate_id]: !saved })); }
    catch { setError("Could not update saved profiles."); }
    finally { setBusy(""); }
  }
  async function saveSelected() {
    const candidates = [...new Set(rows.filter(row => selected.includes(row.application_id) && !(savedState[row.candidate_id] ?? row.saved)).map(row => row.candidate_id))];
    if (!candidates.length) { setError("Selected profiles are already saved."); return; }
    setBusy("bulk"); setError("");
    const results = await Promise.allSettled(candidates.map(candidateID => apiRequest(`/api/v1/recruiter/talent-pool/${candidateID}`, { method: "PUT", body: JSON.stringify({ tags: [] }) })));
    const successful = candidates.filter((_, index) => results[index].status === "fulfilled");
    setSavedState(current => ({ ...current, ...Object.fromEntries(successful.map(candidateID => [candidateID, true])) }));
    if (successful.length !== candidates.length) setError(`${candidates.length - successful.length} profile(s) could not be saved.`);
    setBusy("");
  }

  if (!rows.length) return <div className="rounded-2xl border border-dashed border-line bg-white p-8 text-center"><h2 className="font-bold text-navy">No applications match these filters</h2><p className="mt-1 text-sm text-ink-muted">Adjust or clear filters to see other applicants for your jobs.</p></div>;
  return <div className="grid min-w-0 gap-3" aria-label="Applicant cards">
    {error && <p role="alert" className="rounded-xl border border-rose-200 bg-rose-50 p-3 text-sm text-rose-800">{error}</p>}
    <div className="flex flex-wrap items-center gap-3"><label className="flex items-center gap-2 text-xs font-semibold text-ink-muted"><input type="checkbox" aria-label="Select all visible applicants" checked={selected.length === rows.length} onChange={event => setSelected(event.target.checked ? rows.map(row => row.application_id) : [])} className="h-4 w-4 accent-indigo"/>Select visible applicants ({selected.length})</label><button type="button" onClick={() => void saveSelected()} disabled={!selected.length || !!busy} className="min-h-9 rounded-lg border border-line bg-white px-3 text-xs font-bold text-indigo disabled:opacity-40">Save selected profiles</button></div>
    {rows.map(row => {
      const profileHref = `/recruiter/candidates/${row.candidate_id}?job_id=${encodeURIComponent(row.job_id)}`;
      const initials = row.candidate_name.split(/\s+/).filter(Boolean).map(part => part[0]).slice(0,2).join("").toUpperCase();
      const skills = row.key_skills.split(",").map(skill => skill.trim()).filter(Boolean);
      const saved = savedState[row.candidate_id] ?? row.saved;
      const days = row.last_active_at ? Math.max(0, Math.floor((nowTime-new Date(row.last_active_at).getTime())/86400000)) : null;
      return <article key={row.application_id} className="min-w-0 rounded-2xl border border-[#e2eaf5] bg-white p-3 shadow-[0_8px_24px_rgba(24,51,96,0.06)] sm:p-5">
        <header className="flex min-w-0 items-start gap-2.5 sm:gap-4"><input type="checkbox" checked={selected.includes(row.application_id)} onChange={event => setSelected(current => event.target.checked ? [...current,row.application_id] : current.filter(id => id !== row.application_id))} aria-label={`Select ${row.candidate_name} for bulk actions`} className="mt-4 h-4 w-4 shrink-0 accent-indigo sm:mt-6"/><span aria-hidden="true" className="relative grid h-14 w-14 shrink-0 place-items-center overflow-hidden rounded-full bg-indigo-soft font-sans text-lg font-bold text-indigo sm:h-20 sm:w-20 sm:text-2xl xl:h-24 xl:w-24">{row.photo_data_url ? <Image src={row.photo_data_url} alt="" fill sizes="(max-width: 640px) 56px, (max-width: 1280px) 80px, 96px" unoptimized className="object-cover"/> : initials}</span><div className="min-w-0 flex-1"><div className="flex flex-wrap items-center gap-x-3 gap-y-1"><h2 className="break-words text-base font-extrabold text-navy sm:text-xl xl:text-2xl">{row.candidate_name}</h2><StatusMenu value={row.stage} options={stages} disabled={busy === row.application_id} ariaLabel={`Stage for ${row.candidate_name} on ${row.job_title}`} onChange={stage => void changeStage(row,stage)}/></div><p className="mt-0.5 break-words text-xs font-medium text-[#526990] sm:text-sm">{provided(row.designation || row.headline)}{row.designation && row.headline && row.headline !== row.designation && <> <span className="px-1.5 text-[#a1afc8]">|</span>{row.headline}</>}</p><p className="mt-2 hidden flex-wrap gap-x-4 gap-y-1 text-xs text-[#526990] sm:flex"><span className="inline-flex items-center gap-1"><CardIcon name="briefcase" />{row.experience_months > 0 ? experience(row.experience_months) : "Experience not provided"}</span><span className="inline-flex items-center gap-1"><CardIcon name="building" />{provided(row.current_company)}</span><span className="inline-flex items-center gap-1"><CardIcon name="pin" />{provided(row.city)}</span></p></div><button type="button" onClick={() => void toggleSave(row)} disabled={busy === row.application_id} aria-pressed={saved} aria-label={saved ? "Saved · Unsave" : "Save Profile"} className={`inline-flex min-h-9 shrink-0 items-center gap-2 rounded-lg border px-2 text-xs font-bold sm:px-3 ${saved ? "border-emerald-300 bg-emerald-50 text-emerald-800" : "border-blue-300 text-blue-700 hover:bg-blue-50"}`}><CardIcon name="bookmark" /><span className="hidden sm:inline">{saved ? "Saved · Unsave" : "Save Profile"}</span></button></header>
        <div className="mt-3 flex flex-wrap gap-x-3 gap-y-1 border-t border-[#e2eaf5] pt-2 text-[11px] text-[#526990] sm:hidden"><span className="inline-flex items-center gap-1"><CardIcon name="briefcase" />{row.experience_months > 0 ? experience(row.experience_months) : "Experience not provided"}</span><span className="inline-flex items-center gap-1"><CardIcon name="building" />{provided(row.current_company)}</span><span className="inline-flex items-center gap-1"><CardIcon name="pin" />{provided(row.city)}</span></div>
        <div className="mt-4 grid min-w-0 gap-4 border-t border-[#e2eaf5] pt-4 lg:grid-cols-[minmax(0,1fr)_minmax(13rem,17rem)] lg:border-t-0 lg:pt-0"><dl className="grid min-w-0 gap-x-5 gap-y-2.5 text-xs sm:grid-cols-2 lg:border-t lg:border-[#e2eaf5] lg:pt-4">
          <Detail title="Current company" value={provided(row.current_company)} /><Detail title="Experience" value={row.experience_months > 0 ? experience(row.experience_months) : "Not provided"} hiddenOnMobile />
          <Detail title="Previous company" value={provided(row.previous_company)} hiddenOnMobile /><Detail title="Preferred locations" value={provided(row.preferred_location)} />
          <Detail title="Education" value={provided(row.education)} /><div className="grid min-w-0 gap-1"><dt className="text-[#526990]">Key skills</dt><dd className="flex min-w-0 flex-wrap gap-1">{skills.length ? <>{skills.slice(0,5).map((skill,index) => <span key={`${skill}-${index}`} className="rounded-full bg-blue-50 px-2 py-0.5 font-semibold text-blue-700">{skill}</span>)}{skills.length > 5 && <span title={skills.slice(5).join(", ")} className="rounded-full border border-blue-100 px-2 py-0.5 font-semibold text-blue-700">+{skills.length - 5}</span>}</> : <span className="font-semibold text-navy">Not provided</span>}</dd></div>
          <Detail title="University" value={provided(row.university)} hiddenOnMobile />{skills.length > 5 && <Detail title="May also know" value={skills.slice(5).join(", ")} hiddenOnMobile />}
          <div className="text-xs sm:col-span-2"><span className="text-[#526990]">Applied for </span><span className="font-semibold text-navy">{row.job_title}</span><span className="ml-2 font-semibold text-indigo">{row.job_reference}</span></div>
        </dl><div className="grid min-w-0 content-start gap-2 border-t border-[#e2eaf5] pt-4 sm:grid-cols-3 lg:grid-cols-1 lg:border-l lg:border-t-0 lg:pl-4 lg:pt-0"><Link href={profileHref} className="inline-flex min-h-11 items-center justify-center gap-2 rounded-lg bg-[#0960f6] px-3 text-sm font-bold text-white hover:bg-blue-700"><CardIcon name="eye" className="h-5 w-5" />View Profile</Link><Link href={`${profileHref}&compose=1`} className="inline-flex min-h-11 items-center justify-center gap-2 rounded-lg border border-blue-300 px-3 text-sm font-bold text-blue-700 hover:bg-blue-50"><CardIcon name="mail" className="h-5 w-5" />Send InMail</Link><CandidateContact candidateID={row.candidate_id}/><div className="sm:col-start-3 lg:col-start-auto"><CandidateComments candidateID={row.candidate_id} jobID={row.job_id} applicationID={row.application_id} initialCount={row.comment_count}/></div></div></div>
        <footer className="mt-4 grid min-w-0 gap-3 border-t border-[#e2eaf5] pt-3 text-xs sm:grid-cols-[minmax(0,1.5fr)_minmax(0,0.8fr)_minmax(0,0.7fr)] sm:items-center"><CVControls row={row}/><div className="flex min-w-0 items-center gap-2 border-t border-[#e2eaf5] pt-2 sm:border-l sm:border-t-0 sm:pl-4 sm:pt-0"><span className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-blue-50 text-blue-600"><CardIcon name="calendar" className="h-5 w-5" /></span><div><p className="text-[11px] text-[#526990]">Profile updated</p><p className="font-semibold text-navy">{date(row.profile_updated_at)}</p></div></div><div className="flex min-w-0 items-center gap-2 sm:border-l sm:border-[#e2eaf5] sm:pl-4"><span className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-blue-50 text-blue-600"><CardIcon name="clock" className="h-5 w-5" /></span><div><p className="text-[11px] text-[#526990]">Last active</p><p className="font-semibold text-navy">{days === null ? "Not provided" : days === 0 ? "Today" : days === 1 ? "1 day ago" : `${days} days ago`}</p></div></div></footer>
      </article>;
    })}
  </div>;
}

/** The dashboard reuses the applicant card's identity, stage and actions in a denser form. */
export function CompactApplicantCards({ rows }: { rows: PipelineRow[] }) {
  if (!rows.length) return <p className="rounded-2xl border border-dashed border-line bg-white p-6 text-sm text-ink-muted">No recent applications yet.</p>;
  return <div aria-label="Recent applicant cards" className="grid min-w-0 gap-3 xl:grid-cols-2">
    {rows.map((row) => {
      const profileHref = `/recruiter/candidates/${row.candidate_id}?job_id=${encodeURIComponent(row.job_id)}`;
      const initials = row.candidate_name.split(/\s+/).filter(Boolean).map((part) => part[0]).slice(0, 2).join("").toUpperCase();
      return <article key={row.application_id} className="min-w-0 rounded-2xl border border-[#e2eaf5] bg-white p-4 shadow-[0_4px_16px_rgba(24,51,96,0.04)]">
        <div className="flex min-w-0 items-start gap-3">
          <span aria-hidden="true" className="relative grid h-12 w-12 shrink-0 place-items-center overflow-hidden rounded-full bg-indigo-soft font-sans text-base font-bold text-indigo">{row.photo_data_url ? <Image src={row.photo_data_url} alt="" fill sizes="48px" unoptimized className="object-cover"/> : initials}</span>
          <div className="min-w-0 flex-1"><h3 className="truncate text-base font-extrabold text-navy">{row.candidate_name}</h3><p className="truncate text-sm text-[#526990]">{provided(row.designation || row.headline)}</p></div>
          <span className="shrink-0 rounded-full bg-indigo-soft/70 px-2 py-1 text-xs font-bold text-indigo">{row.stage.replaceAll("_", " ")}</span>
        </div>
        <p className="mt-3 truncate border-t border-[#e2eaf5] pt-3 text-sm text-[#526990]"><span className="font-semibold text-navy">{row.job_title}</span>{row.job_reference && <> · {row.job_reference}</>}</p>
        <div className="mt-3 flex flex-wrap gap-2"><Link href={profileHref} className="inline-flex min-h-9 items-center rounded-lg bg-[#0960f6] px-3 text-xs font-bold text-white hover:bg-blue-700">View profile</Link><Link href={`${profileHref}&compose=1`} className="inline-flex min-h-9 items-center rounded-lg border border-blue-300 px-3 text-xs font-bold text-blue-700 hover:bg-blue-50">Send InMail</Link><Link href={`/recruiter/jobs/${row.job_id}/applicants`} className="inline-flex min-h-9 items-center rounded-lg border border-line px-3 text-xs font-bold text-navy hover:border-indigo/40">Job applicants</Link></div>
      </article>;
    })}
  </div>;
}

export function InterviewCandidateCard({ interview }: { interview: Interview }) {
  const initials = interview.candidate_name.split(/\s+/).filter(Boolean).map((part) => part[0]).slice(0, 2).join("").toUpperCase();
  const profileHref = `/recruiter/candidates/${interview.candidate_id}?job_id=${encodeURIComponent(interview.job_id)}`;
  return <div className="flex min-w-0 flex-wrap items-center gap-3">
    <span aria-hidden="true" className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-indigo-soft font-sans text-sm font-bold text-indigo">{initials}</span>
    <div className="min-w-0 flex-1"><p className="truncate text-sm font-bold text-navy">{interview.candidate_name}</p><p className="truncate text-xs text-[#526990]">{interview.candidate_headline || interview.job_title}</p></div>
    <div className="flex flex-wrap gap-x-3 gap-y-1 text-xs font-bold"><Link href={profileHref} className="text-indigo hover:underline">Candidate 360</Link><Link href={`${profileHref}&compose=1`} className="text-indigo hover:underline">InMail</Link></div>
  </div>;
}
