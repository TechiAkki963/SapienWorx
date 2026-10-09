"use client";
import { useState } from "react";
import { apiRequest } from "@/lib/api";
import type { CompanyMember, CompanyWorkspace } from "@/lib/company";
import { ScheduleInterviewForm } from "@/components/recruiter/schedule-interview-form";
import { recruiterInput, recruiterPrimary } from "@/components/recruiter/workspace-ui";
type Application = {
    id: string;
    candidate_id: string;
    name: string;
    headline: string;
    stage: string;
    applied_at: string;
};
type Interview = {
    id: string;
    application_id: string;
    scheduled_at: string;
    status: string;
    round: string;
    meeting_url: string;
};
type Work = {
    applications: Application[];
    interviews: Interview[];
};
export function ScopedHiring({ member, jobs }: {
    member: CompanyMember;
    jobs: CompanyWorkspace["jobs"];
}) {
    const [job, setJob] = useState<CompanyWorkspace["jobs"][number] | null>(null), [work, setWork] = useState<Work>({ applications: [], interviews: [] }), [busy, setBusy] = useState(false), [error, setError] = useState(""), [notice, setNotice] = useState("");
    const manage = member.role !== "collaborator";
    async function load(id: string) { setWork(await apiRequest<Work>(`/api/v1/company/jobs/${id}/hiring`)); }
    async function act(action: () => Promise<unknown>, refresh = true) { setBusy(true); setError(""); setNotice(""); try {
        await action();
        if (job && refresh)
            await load(job.id);
        setNotice("Hiring work updated.");
    }
    catch (e) {
        setError(e instanceof Error ? e.message : "Hiring work is unavailable.");
    }
    finally {
        setBusy(false);
    } }
    return <section className="space-y-5"><h1 className="text-3xl font-semibold text-navy">Your assigned hiring work</h1><p className="text-sm leading-6 text-ink-muted">Open a job to review applicants and interviews within your approved scope.</p>{error && <p role="alert" className="text-sm swx-company-error">{error}</p>}{notice && <p role="status" className="text-sm swx-company-success">{notice}</p>}<div className="overflow-x-auto rounded-xl border border-line bg-white"><table className="w-full text-left text-sm"><thead className="border-b border-line"><tr>{["Job", "Department", "Location", "Status", "Applications"].map(t => <th key={t} className="p-4 font-medium text-ink-muted">{t}</th>)}</tr></thead><tbody>{jobs.map(j => <tr key={j.id} className="border-b border-line"><td className="p-4"><button disabled={busy} aria-expanded={job?.id === j.id} className="min-h-11 text-left font-semibold text-indigo" onClick={() => void act(async () => { await load(j.id); setJob(j); }, false)}>{j.title}</button></td><td className="p-4">{j.department || "—"}</td><td className="p-4">{j.city || "—"}</td><td className="p-4">{j.status}</td><td className="p-4">{j.applications}</td></tr>)}</tbody></table>{!jobs.length && <p className="p-6 text-sm text-ink-muted">No jobs are assigned yet. Ask your Company Admin to review your access.</p>}</div>{job && <section className="rounded-xl border border-line bg-white p-5"><header className="flex flex-wrap items-center justify-between gap-3"><h2 className="text-xl font-semibold">{job.title}</h2>{manage && <ScheduleInterviewForm applications={work.applications.map(a => ({ application_id: a.id, candidate_name: a.name, job_title: job.title }))} endpoint={`/api/v1/company/jobs/${job.id}/interviews`} onScheduled={() => load(job.id)}/>}</header><h3 className="mt-6 font-semibold">Applications</h3><p className="mt-2 text-sm text-ink-muted">The most recent 200 applications and interviews. Private review identities are excluded.</p><ul className="mt-3 divide-y divide-line">{work.applications.map(a => <li key={a.id} className="py-4"><p className="font-semibold">{a.name}</p><p className="mt-1 text-sm text-ink-muted">{a.headline} · {a.stage.replaceAll("_", " ")}</p>{manage && <label className="mt-3 grid max-w-sm gap-2 text-sm">Application stage for {a.name}<select className={recruiterInput} value={a.stage} disabled={busy} onChange={e => void act(() => apiRequest(`/api/v1/recruiter/applications/${a.id}/stage`, { method: "PATCH", body: JSON.stringify({ stage: e.target.value }) }))}>{["new_application", "screening", "shortlisted", "technical_interview", "hr_round", "final_interview", "offer", "hired", "rejected", "withdrawn"].map(s => <option key={s} value={s}>{s.replaceAll("_", " ")}</option>)}</select></label>}</li>)}{!work.applications.length && <li className="py-4 text-sm text-ink-muted">No applications for this job yet.</li>}</ul><h3 className="mt-6 font-semibold">Interviews</h3><ul className="mt-3 divide-y divide-line">{work.interviews.map(i => <li key={i.id} className="py-4"><p className="font-medium">{work.applications.find(a => a.id === i.application_id)?.name ?? "Applicant"} · {i.round || "Interview"}</p><p className="mt-1 text-sm text-ink-muted">{new Date(i.scheduled_at).toLocaleString()} · {i.status}</p>{/^https?:\/\//.test(i.meeting_url) && <a href={i.meeting_url} target="_blank" rel="noopener noreferrer" className="mt-2 inline-block min-h-11 content-center text-sm text-indigo">Open manually supplied meeting link</a>}<details className="mt-3"><summary className="min-h-11 cursor-pointer content-center text-sm font-semibold text-indigo">My panel feedback</summary><form className="mt-3 grid max-w-lg gap-3" onSubmit={e => { e.preventDefault(); const f = new FormData(e.currentTarget); void act(() => apiRequest(`/api/v1/recruiter/interviews/${i.id}/feedback`, { method: "PUT", body: JSON.stringify({ rating: Number(f.get("rating")), recommendation: f.get("recommendation"), notes: f.get("notes") }) })); }}><p className="text-sm text-ink-muted">Available only to assigned panel members after the interview.</p><label className="grid gap-2 text-sm">Rating<select name="rating" className={recruiterInput}>{[1, 2, 3, 4, 5].map(n => <option key={n}>{n}</option>)}</select></label><label className="grid gap-2 text-sm">Recommendation<select name="recommendation" className={recruiterInput}>{["advance", "hold", "do_not_advance"].map(s => <option key={s} value={s}>{s.replaceAll("_", " ")}</option>)}</select></label><label className="grid gap-2 text-sm">Interview notes<textarea name="notes" required maxLength={4000} className={`${recruiterInput} min-h-24 py-3`}/></label><button disabled={busy} className={recruiterPrimary}>Save my feedback</button></form></details></li>)}{!work.interviews.length && <li className="py-4 text-sm text-ink-muted">No interviews scheduled.</li>}</ul></section>}</section>;
}
