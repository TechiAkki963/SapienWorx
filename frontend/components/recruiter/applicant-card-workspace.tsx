"use client";
import {AddToPool} from "./add-to-pool";
import {BulkInMailDrawer} from "./bulk-inmail-drawer";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState, type ReactNode } from "react";
import { CandidateComments } from "@/components/recruiter/candidate-comments";
import { CandidateContact } from "@/components/recruiter/candidate-contact";
import { StatusMenu } from "@/components/recruiter/status-menu";
import { apiRequest } from "@/lib/api";
import { RecruiterDataTable, RecruiterDrawer, WorkspaceState, recruiterPrimary, recruiterSecondary } from "./workspace-ui";
import { experience, label, Interview, PipelineRow, stages } from "@/lib/recruiter";
const provided = (value?: string | null) => value?.trim() || "Not provided";
const date = (value?: string) => value ? new Intl.DateTimeFormat("en-IN", { dateStyle: "medium", timeZone: "Asia/Kolkata" }).format(new Date(value)) : "Not provided";
function CardIcon({ name, className = "h-4 w-4" }: { name: "bookmark" | "eye" | "mail" | "building" | "briefcase" | "pin" | "calendar" | "clock" | "file" | "download" | "chevron"; className?: string }) {
  const paths = {
    bookmark: "M6 3h12v18l-6-4-6 4V3Z",
    eye: "M2 12s4-6 10-6 10 6 10 6-4 6-10 6S2 12 2 12Zm10-3a3 3 0 1 0 0 6 3 3 0 0 0 0-6Z",
    mail: "M3 5h18v14H3V5Zm0 1 9 7 9-7",
    building: "M4 21V4l8-2v19m0-14h8v14M2 21h20",
    briefcase: "M3 7h18v13H3V7Zm5 0V5a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2M3 12h18",
    pin: "M12 22s7-6 7-12a7 7 0 0 0-14 0c0 6 7 12 7 12Zm0-14a2 2 0 1 0 0 4 2 2 0 0 0 0-4Z",
    calendar: "M4 5h16v16H4V5Zm0 5h16M8 3v4m8-4v4",
    clock: "M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18Zm0 4v5l3 2",
    file: "M6 2h8l4 4v16H6V2Zm8 0v5h4M9 11h6m-6 4h6",
    download: "M12 3v12m-4-4 4 4 4-4M4 17v4h16v-4",
    chevron: "m7 10 5 5 5-5",
  };
  return <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" className={className}><path d={paths[name]} /></svg>;
}
function Signal({ icon, children }: { icon: "briefcase" | "building" | "pin" | "clock"; children: ReactNode }) {
  return <span className="inline-flex min-w-0 items-center gap-1.5 text-xs text-ink-muted"><CardIcon name={icon} className="h-3.5 w-3.5 shrink-0" /><span className="truncate">{children}</span></span>;
}
function CVControls({ row }: { row: PipelineRow }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  async function open(mode: "view" | "download") {
    setBusy(true); setError("");
    try {
      const response = await apiRequest<{ download: { url: string } }>(`/api/v1/recruiter/candidates/${row.candidate_id}/cv${mode === "view" ? "?mode=view" : ""}`);
      window.open(response.download.url, "_blank", "noopener,noreferrer");
    } catch {
      setError("Private CV unavailable.");
    } finally {
      setBusy(false);
    }
  }
  return <div className="grid gap-2 rounded-xl border border-line/70 bg-slate-50/45 p-3">
    <div className="flex min-w-0 items-center gap-2"><span className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-blue-50 text-blue-600"><CardIcon name="file" /></span><div className="min-w-0"><p className="text-[13px] font-bold uppercase tracking-[0.08em] text-ink-muted">CV / Resume</p><p className="truncate text-xs font-semibold text-navy" title={row.cv_filename}>{row.cv_filename || "No resume uploaded"}</p></div></div>
    {row.cv_filename && <div className="grid grid-cols-2 gap-2"><button type="button" onClick={() => void open("view")} disabled={busy} className="inline-flex min-h-9 items-center justify-center gap-1 rounded-lg border border-blue-200 bg-white px-2 text-xs font-bold text-blue-700"><CardIcon name="eye" />View</button><button type="button" onClick={() => void open("download")} disabled={busy} className="inline-flex min-h-9 items-center justify-center gap-1 rounded-lg border border-blue-200 bg-white px-2 text-xs font-bold text-blue-700"><CardIcon name="download" />Download</button></div>}
    {error && <p role="alert" className="text-xs text-rose-700">{error}</p>}
  </div>;
}
export function ApplicantCardWorkspace({ rows, now, jobScoped = false }: { rows: PipelineRow[]; now: string; jobScoped?: boolean }) {
  const router = useRouter();
  const [busy, setBusy] = useState("");
  const [error, setError] = useState("");
  const [bulkStage,setBulkStage]=useState("");
  const [selected, setSelected] = useState<string[]>([]);
  const [savedState, setSavedState] = useState<Record<string, boolean>>({});

  const [detailID, setDetailID] = useState<string | null>(null);
  const detail = rows.find(row => row.application_id === detailID) ?? null;
  useEffect(() => {
    setSelected(current => current.filter(id => rows.some(row => row.application_id === id)));
  }, [rows]);
  async function changeStage(row: PipelineRow, stage: string) {
    if(stage==="rejected"&&!window.confirm(`Reject ${row.candidate_name} for ${row.job_title}?`))return;
    setBusy(row.application_id); setError("");
    try {
      await apiRequest(`/api/v1/recruiter/applications/${row.application_id}/stage`, { method: "PATCH", body: JSON.stringify({ stage }) });
      router.refresh();
    } catch {
      setError("Could not change application stage.");
    } finally {
      setBusy("");
    }
  }
  async function toggleSave(row: PipelineRow) {
    setBusy(row.application_id); setError("");
    const saved = savedState[row.candidate_id] ?? row.saved;
    try {
      await apiRequest(`/api/v1/recruiter/talent-pool/${row.candidate_id}`, saved ? { method: "DELETE" } : { method: "PUT", body: JSON.stringify({ tags: [] }) });
      setSavedState(current => ({ ...current, [row.candidate_id]: !saved }));
    } catch {
      setError("Could not update saved profiles.");
    } finally {
      setBusy("");
    }
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
  async function moveSelected(){if(!bulkStage||!selected.length||busy)return;if(!window.confirm(`Move ${selected.length} selected applications to ${label(bulkStage)}? Each application is checked against its hiring rules.`))return;setBusy("bulk");setError("");const ids=[...selected];const results=await Promise.allSettled(ids.map(id=>apiRequest(`/api/v1/recruiter/applications/${id}/stage`,{method:"PATCH",body:JSON.stringify({stage:bulkStage})})));const failed=ids.filter((_,i)=>results[i].status==="rejected");setSelected(failed);setBulkStage("");setBusy("");if(failed.length)setError(`${ids.length-failed.length} of ${ids.length} moved. Failed selections retained.`);router.refresh()}
  if (!rows.length) return <WorkspaceState title="No applications match these filters" description="Adjust or clear filters to see other applicants for your jobs." />;
  const profileHref = (row: PipelineRow) => `/recruiter/candidates/${row.candidate_id}?job_id=${encodeURIComponent(row.job_id)}`;
  const summary = (row: PipelineRow) => <div className="flex min-w-0 items-start gap-3"><input type="checkbox" aria-label={`Select ${row.candidate_name} for bulk actions`} checked={selected.includes(row.application_id)} onChange={event=>setSelected(current=>event.target.checked?[...current,row.application_id]:current.filter(id=>id!==row.application_id))} className="mt-3 h-4 w-4 shrink-0 accent-indigo" /><span aria-hidden="true" className="mt-1 grid h-9 w-9 shrink-0 place-items-center rounded-full bg-indigo-soft text-xs font-semibold text-indigo">{row.candidate_name.split(/\s+/).filter(Boolean).map(part=>/^\d+$/.test(part)?String(Number(part)):part[0]).slice(0,2).join("").toUpperCase()}</span><div className="min-w-0"><Link className="inline-flex min-h-11 items-center text-left font-semibold text-navy hover:text-indigo" href={profileHref(row)}>{row.candidate_name}</Link><p className="text-xs leading-5 text-ink-muted">{provided(row.designation || row.headline)}</p><p className="text-xs leading-5 text-ink-muted">{provided(row.current_company)}</p>{row.source&&<p className="mt-1 text-xs text-ink-muted">{["platform","direct"].includes(row.source)?"Direct application":label(row.source)}{row.referrer_name&&<span className="block">Referred by {row.referrer_name}</span>}</p>}</div></div>;
  const stageControl=(row: PipelineRow)=><StatusMenu value={row.stage} options={stages} disabled={!!busy} ariaLabel={`Stage for ${row.candidate_name} on ${row.job_title}`} onChange={stage=>void changeStage(row,stage)} />;
  const actions=(row: PipelineRow)=><div className="flex flex-wrap gap-2"><Link className={`${recruiterSecondary} whitespace-nowrap !px-2 !text-xs`} href={profileHref(row)}>View candidate</Link><details><summary aria-label={`More actions for ${row.candidate_name}`} className="min-h-11 min-w-11 cursor-pointer list-none content-center text-center text-lg font-semibold text-ink">⋯</summary><div className="grid gap-2 border border-line bg-white p-2"><button className={recruiterSecondary} onClick={()=>setDetailID(row.application_id)}>Notes, CV & application details</button><Link className={recruiterSecondary} href={`${profileHref(row)}&compose=1`}>Message</Link><button disabled={!!busy} aria-pressed={savedState[row.candidate_id] ?? row.saved} aria-label={(savedState[row.candidate_id] ?? row.saved)?"Saved · Unsave":"Save Profile"} className={recruiterSecondary} onClick={()=>void toggleSave(row)}>{(savedState[row.candidate_id] ?? row.saved)?"Unsave":"Save profile"}</button></div></details></div>;
  return <div className="grid min-w-0 gap-3" aria-label="Applicant workspace">
    {error && <p role="alert" className="rounded-lg border border-rose-200 p-3 text-sm text-rose-700">{error}</p>}
    <div className="flex flex-wrap items-center justify-between gap-3 border-b border-line pb-3"><label className="flex min-h-11 items-center gap-2 text-sm text-ink"><input type="checkbox" aria-label="Select all visible applicants" checked={rows.every(row=>selected.includes(row.application_id))} onChange={event=>setSelected(event.target.checked?rows.map(row=>row.application_id):[])} className="h-4 w-4 accent-indigo" />Select visible ({selected.length})</label>{selected.length>0&&<div className="flex flex-wrap items-center gap-2"><span className="text-xs font-semibold text-ink">{selected.length} selected</span><label className="sr-only" htmlFor="bulk-application-stage">Move to stage</label><select id="bulk-application-stage" value={bulkStage} onChange={e=>setBulkStage(e.target.value)} className="min-h-11 rounded-lg border border-line bg-white px-2 text-xs"><option value="">Move to stage…</option>{stages.map(stage=><option key={stage} value={stage}>{label(stage)}</option>)}</select><button className={recruiterSecondary} disabled={!!busy||!bulkStage} onClick={()=>void moveSelected()}>Move selected</button><AddToPool candidateIDs={rows.filter(row=>selected.includes(row.application_id)).map(row=>row.candidate_id)} onSaved={ids=>setSelected(current=>current.filter(id=>!rows.some(row=>row.application_id===id&&ids.includes(row.candidate_id))))}/><button className={recruiterSecondary} disabled={!!busy} onClick={()=>void saveSelected()}>Save for future roles</button><button className={recruiterSecondary} disabled={!!busy} onClick={()=>window.dispatchEvent(new CustomEvent("sapienworx:open-bulk-inmail",{detail:{candidateIDs:[...new Set(rows.filter(row=>selected.includes(row.application_id)).map(row=>row.candidate_id))]}}))}>Message selected</button></div>}</div>
    <RecruiterDataTable label="Hiring pipeline" rows={rows} rowKey={row=>row.application_id} columns={[
      {key:"candidate",title:"Candidate",width:"25%",render:summary},
      ...(!jobScoped ? [{key:"role",title:"Job / role",width:"23%",render:(row: PipelineRow)=><div><p className="font-medium text-navy">{row.job_title}</p><p className="mt-1 text-xs text-ink-muted">{row.job_reference}</p><p className="mt-2 text-xs text-ink-muted">Applied {date(row.applied_at)}</p><p className="mt-1 text-xs text-ink-muted">Updated {date(row.updated_at)}</p></div>}] : []),
      {key:"signals",title:"Experience / location",width:"17%",secondary:true,render:row=><div className="grid gap-1 text-xs text-ink-muted"><p>{experience(row.experience_months)}</p><p>{provided(row.city)}</p><p>{row.notice_period_days==null?"Notice not provided":row.notice_period_days===0?"Immediate":`${row.notice_period_days} days notice`}</p></div>},
      {key:"stage",title:"Stage",width:"16%",render:stageControl},
      {key:"actions",title:"Actions",width:"19%",render:actions},
    ]} mobileRow={row=><>{summary(row)}<p className="my-3 text-sm text-ink-muted">{row.job_title}</p><p className="mb-3 text-xs text-ink-muted">{experience(row.experience_months)} · {provided(row.city)} · Applied {date(row.applied_at)}</p>{stageControl(row)}<div className="mt-3 border-t border-line pt-2">{actions(row)}</div></>} />
    <BulkInMailDrawer onSent={()=>setSelected([])} initialTemplates={[]} initialJobs={[]} />
    <RecruiterDrawer open={!!detail} onClose={()=>setDetailID(null)} title="Application details" wide footer={detail&&<><Link className={recruiterSecondary} href={`${profileHref(detail)}&compose=1`}>Message</Link><Link className={recruiterPrimary} href={profileHref(detail)}>View Candidate 360</Link></>}>
      {detail&&<div className="grid gap-5"><div><h3 className="text-xl font-semibold text-navy">{detail.candidate_name}</h3><p className="mt-1 text-sm text-ink-muted">{detail.job_title} · {detail.job_reference}</p><div className="mt-3">{stageControl(detail)}</div></div><section><h3 className="mb-2 text-sm font-semibold text-navy">Recruiter notes</h3><CandidateComments candidateID={detail.candidate_id} jobID={detail.job_id} applicationID={detail.application_id} initialCount={detail.comment_count} /></section><section><h3 className="text-sm font-semibold text-navy">Profile summary</h3><dl className="mt-3 grid grid-cols-2 gap-4 text-sm">{[["Designation",detail.designation||detail.headline],["Experience",experience(detail.experience_months)],["Company",detail.current_company],["Previous company",detail.previous_company],["Location",detail.city],["Preferred locations",detail.preferred_location],["Education",detail.education],["University",detail.university],["Updated",date(detail.profile_updated_at)],["Last active",date(detail.last_active_at)]].map(([name,value])=><div key={name}><dt className="text-xs text-ink-muted">{name}</dt><dd className="mt-1 break-words text-ink">{provided(value)}</dd></div>)}</dl><div className="mt-4 flex flex-wrap gap-2">{detail.key_skills.split(",").filter(Boolean).map((skill,index)=><span key={index} className="swx-skill-chip rounded-full bg-mint/40 px-2 py-1 text-xs text-emerald-900">{skill}</span>)}</div></section><section><h3 className="mb-2 text-sm font-semibold text-navy">Attachments & consented contact</h3><CVControls row={detail} /><div className="mt-3"><CandidateContact candidateID={detail.candidate_id} /></div></section><section><h3 className="text-sm font-semibold text-navy">Screening & activity</h3><p className="mt-2 text-sm leading-6 text-ink-muted">Open Candidate 360 for the candidate’s authorized professional history, job-specific match and audited hiring activity.</p></section>{error&&<p role="alert" className="text-sm text-rose-700">{error}</p>}</div>}
    </RecruiterDrawer>
  </div>;
}
export function CompactApplicantCards({ rows }: { rows: PipelineRow[] }) {
  if (!rows.length) return <p className="rounded-2xl border border-dashed border-line bg-white p-6 text-sm text-ink-muted">No recent applications yet.</p>;
  return <div aria-label="Recent applicant cards" className="grid min-w-0 gap-3 xl:grid-cols-2">
    {rows.map((row) => {
      const profileHref = `/recruiter/candidates/${row.candidate_id}?job_id=${encodeURIComponent(row.job_id)}`;
      const initials = row.candidate_name.split(/\s+/).filter(Boolean).map((part) => part[0]).slice(0, 2).join("").toUpperCase();
      return <article key={row.application_id} className="min-w-0 rounded-2xl border border-line/70 bg-white p-4 shadow-[0_4px_16px_rgba(24,51,96,0.04)]">
        <div className="flex min-w-0 items-start gap-3"><span aria-hidden="true" className="relative grid h-12 w-12 shrink-0 place-items-center overflow-hidden rounded-full bg-indigo-soft text-base font-bold text-indigo">{row.photo_data_url ? <Image src={row.photo_data_url} alt="" fill sizes="48px" unoptimized className="object-cover" /> : initials}</span><div className="min-w-0 flex-1"><h3 className="truncate text-base font-extrabold text-navy">{row.candidate_name}</h3><p className="truncate text-sm text-ink-muted">{provided(row.designation || row.headline)}</p></div><span className="shrink-0 rounded-full bg-indigo-soft/70 px-2 py-1 text-xs font-bold text-indigo">{row.stage.replaceAll("_", " ")}</span></div>
        <p className="mt-3 truncate border-t border-line/70 pt-3 text-sm text-ink-muted"><span className="font-semibold text-navy">{row.job_title}</span>{row.job_reference && <> · {row.job_reference}</>}</p>
        <div className="mt-3 flex flex-wrap gap-2"><Link href={profileHref} className="inline-flex min-h-9 items-center rounded-lg bg-indigo px-3 text-xs font-bold text-white hover:bg-navy">View profile</Link><Link href={`${profileHref}&compose=1`} className="inline-flex min-h-9 items-center rounded-lg border border-line px-3 text-xs font-bold text-indigo hover:border-indigo/30">Send InMail</Link><Link href={`/recruiter/jobs/${row.job_id}/applicants`} className="inline-flex min-h-9 items-center rounded-lg border border-line px-3 text-xs font-bold text-navy hover:border-indigo/40">Job applicants</Link></div>
      </article>;
    })}
  </div>;
}
export function InterviewCandidateCard({ interview }: { interview: Interview }) {
  const initials = interview.candidate_name.split(/\s+/).filter(Boolean).map((part) => /^\d+$/.test(part) ? String(Number(part)) : part[0]).slice(0, 2).join("").toUpperCase();
  const profileHref = `/recruiter/candidates/${interview.candidate_id}?job_id=${encodeURIComponent(interview.job_id)}`;
  return <div className="flex min-w-0 flex-wrap items-center gap-3"><span aria-hidden="true" className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-indigo-soft text-sm font-bold text-indigo">{initials}</span><div className="min-w-0 flex-1"><Link href={profileHref} className="inline-flex min-h-11 items-center text-sm font-bold text-navy hover:text-indigo">{interview.candidate_name}</Link><p className="truncate text-xs text-ink-muted">{interview.candidate_headline || interview.job_title}</p></div><div className="flex flex-wrap gap-x-3 gap-y-1 text-xs font-bold"><Link href={`${profileHref}&compose=1`} aria-label={`Message ${interview.candidate_name}`} className="inline-flex min-h-11 min-w-11 items-center justify-center rounded-lg border border-line text-indigo hover:bg-indigo-soft">✉</Link></div></div>;
}
