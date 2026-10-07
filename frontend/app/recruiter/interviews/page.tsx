import { AutoFilterForm } from "@/components/recruiter/auto-filter-form";
import Link from "next/link";
import { JobContext } from "@/components/recruiter/job-context";
import { ownedRecruiterJob } from "@/lib/recruiter-job-server";

import { InterviewCandidateCard } from "@/components/recruiter/applicant-card-workspace";
import { InterviewCalendar } from "@/components/recruiter/interview-calendar";
import { RecruiterProductHeader } from "@/components/recruiter/recruiter-product-header";
import { RecruiterShell } from "@/components/recruiter/recruiter-shell";
import { ScheduleInterviewForm } from "@/components/recruiter/schedule-interview-form";
import { InterviewActions } from "@/components/recruiter/interview-actions";
import { StatusPill } from "@/components/recruiter/status-menu";
import { requireRole } from "@/lib/auth-server";
import { Interview, InterviewChangeEvent, PipelineList } from "@/lib/recruiter";
import { recruiterAPI } from "@/lib/recruiter-server";

export const dynamic = "force-dynamic";

export default async function InterviewsPage({ searchParams }: { searchParams: Promise<{ interview_id?: string; status?: string; view?: string; mode?: string; date?: string; job_id?: string; q?: string; from?: string; to?: string }> }) {
  await requireRole("recruiter");
  const { interview_id, status, view, mode, date, job_id, q, from, to } = await searchParams;
  const job = job_id ? await ownedRecruiterJob(job_id) : null;
  const jobQuery = job_id ? `job_id=${encodeURIComponent(job_id)}` : "";
  const href = (params:Record<string,string>={}) => { const query=new URLSearchParams({...status?{status}:{},...q?{q}:{},...from?{from}:{},...to?{to}:{},...params}); if(job_id)query.set("job_id",job_id); return `/recruiter/interviews${query.size?`?${query}`:""}`; };
  const [{ items }, pipeline] = await Promise.all([
    recruiterAPI<{ items: Interview[] }>(`/api/v1/recruiter/interviews${jobQuery?`?${jobQuery}`:""}`),
    recruiterAPI<PipelineList>(`/api/v1/recruiter/pipeline?page=1&limit=50${jobQuery?`&${jobQuery}`:""}`),
  ]);
  const visibleItems = items.filter((item) => (!interview_id || item.id === interview_id) && (!q || `${item.candidate_name} ${item.job_title} ${item.job_reference} ${item.round_label}`.toLowerCase().includes(q.toLowerCase())) && (!from || dayKey(item.scheduled_at)>=from) && (!to || dayKey(item.scheduled_at)<=to) && (!status || status === "upcoming" && item.status === "scheduled" && new Date(item.scheduled_at).getTime() >= Date.now() || status === "completed" && item.status === "completed" || status === "cancelled" && item.status === "cancelled"));
  const calendar = view === "calendar";
  const history = interview_id && visibleItems.length ? await recruiterAPI<{ items: InterviewChangeEvent[] }>(`/api/v1/recruiter/interviews/${encodeURIComponent(interview_id)}/history`) : null;

  return (
    <RecruiterShell>
      <div className="grid gap-5">
        {job && <JobContext job={job} active="Interviews"/>}
        <RecruiterProductHeader
          eyebrow="Interview operations"
          title="Interviews"
          description="Coordinate candidates, schedules and manually supplied meeting links."
          actions={<ScheduleInterviewForm applications={pipeline.items} />}
        />

        <nav aria-label="Interview views" className="flex flex-wrap items-center gap-2"><Link href={href()} aria-current={!calendar ? "page" : undefined} className={`rounded-lg px-3 py-2 text-sm font-bold ${!calendar ? "bg-indigo text-white" : "border border-line bg-white text-navy"}`}>List view</Link><Link href={href({view:"calendar",mode:"week",...(status?{status}:{})})} aria-current={calendar ? "page" : undefined} className={`rounded-lg px-3 py-2 text-sm font-bold ${calendar ? "bg-indigo text-white" : "border border-line bg-white text-navy"}`}>Calendar view</Link>{status === "upcoming" && <Link href={href({status:""})} className="ml-auto text-sm font-bold text-indigo hover:underline">Show all interviews</Link>}</nav>
        <nav aria-label="Interview status views" className="flex flex-wrap gap-1 border-b border-line">{[["", "All"],["upcoming","Upcoming"],["completed","Completed"],["cancelled","Cancelled"]].map(([value,name])=><Link key={name} aria-current={(status||"")===value?"page":undefined} href={href({status:value,view:calendar?"calendar":"list"})} className={`min-h-11 border-b-2 px-3 py-3 text-sm font-semibold ${(status||"")===value?"border-indigo text-indigo":"border-transparent text-ink-muted"}`}>{name}</Link>)}</nav>
        <AutoFilterForm action="/recruiter/interviews" label="Interview filters" className="flex flex-wrap items-end gap-2">{Object.entries({status:status||"",view:view||"",job_id:job_id||""}).map(([key,value])=><input type="hidden" key={key} name={key} value={value}/>)}<label className="grid min-w-0 flex-[2_1_15rem] gap-1 text-xs font-semibold text-ink-muted">Search interviews<input className="min-h-11 rounded-lg border border-line bg-white px-3 text-sm" name="q" defaultValue={q} placeholder="Candidate, job or round"/></label><label className="grid gap-1 text-xs font-semibold text-ink-muted">From (IST)<input className="min-h-11 rounded-lg border border-line bg-white px-3 text-sm" type="date" name="from" defaultValue={from}/></label><label className="grid gap-1 text-xs font-semibold text-ink-muted">To (IST)<input className="min-h-11 rounded-lg border border-line bg-white px-3 text-sm" type="date" name="to" defaultValue={to}/></label>{(q||from||to)&&<Link className="min-h-11 content-center px-3 text-sm text-indigo" href={job_id?`/recruiter/interviews?job_id=${encodeURIComponent(job_id)}`:"/recruiter/interviews"}>Clear filters</Link>}</AutoFilterForm>
        {interview_id && <Link href={href()} className="text-sm font-bold text-indigo hover:underline">← All interviews</Link>}
        {calendar ? <InterviewCalendar items={visibleItems} mode={mode === "day" ? "day" : "week"} date={date} /> : visibleItems.length ? (<>
          <div className="grid gap-3 xl:hidden" aria-label="Interview cards">
            {visibleItems.map((interview) => <article key={interview.id} className="rounded-2xl border border-line/70 bg-white p-4 shadow-sm">
              <div className="flex flex-wrap items-start justify-between gap-2"><div><h2 className="font-bold text-navy">{interview.job_title}</h2><p className="mt-0.5 text-sm text-ink-muted">{interview.round_label} · {interview.job_reference}</p></div><StatusPill value={interview.status} /></div>
              <div className="mt-3 border-t border-line/60 pt-3"><InterviewCandidateCard interview={interview} /></div>
              <dl className="mt-4 grid grid-cols-2 gap-3 border-t border-line/60 pt-3 text-xs"><div><dt className="text-ink-muted">Schedule</dt><dd className="mt-1 font-semibold text-ink"><InterviewDate value={interview.scheduled_at}/></dd></div><div><dt className="text-ink-muted">Duration</dt><dd className="mt-1 font-semibold text-ink">{interview.duration_minutes} min</dd></div></dl>
              <div className="mt-4 flex flex-wrap items-center gap-3"><InterviewActions interview={interview} /></div>
            </article>)}
          </div>
          <div className="hidden overflow-x-auto rounded-2xl border border-line/70 bg-white shadow-[0_1px_2px_rgba(16,33,63,0.03)] xl:block">
            <table className="w-full table-fixed text-left text-sm">
              <thead className="border-b border-line/70 bg-slate-50/80 text-[10px] font-extrabold uppercase tracking-[0.1em] text-ink-muted">
                <tr><th className="w-[27%] px-4 py-3">Candidate</th><th className="w-[23%] px-3 py-3">Job and round</th><th className="px-3 py-3">Schedule</th><th className="hidden px-3 py-3 2xl:table-cell">Duration</th><th className="px-3 py-3">Status</th><th className="px-3 py-3">Actions</th></tr>
              </thead>
              <tbody>
                {visibleItems.map((interview) => (
                  <tr key={interview.id} className="border-t border-line/50 transition hover:bg-slate-50/65">
                    <td className="px-4 py-3.5 font-bold text-ink"><InterviewCandidateCard interview={interview} /></td>
                    <td className="px-3 py-3.5 text-ink"><span className="block font-semibold">{interview.job_title}</span><span className="block text-xs text-ink-muted">{interview.round_label}</span><span className="block text-xs text-ink-muted">{interview.job_reference}</span></td>
                    <td className="px-3 py-3.5 text-ink-muted"><InterviewDate value={interview.scheduled_at}/></td>
                    <td className="hidden px-3 py-3.5 text-ink-muted 2xl:table-cell">{interview.duration_minutes} min</td>
                    <td className="px-3 py-3.5"><StatusPill value={interview.status} /></td>

                    <td className="px-3 py-3.5"><InterviewActions interview={interview} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div></>
        ) : (
          <div className="rounded-2xl border border-dashed border-line bg-white p-12 text-center">
            <div className="mx-auto flex h-11 w-11 items-center justify-center rounded-full bg-slate-100 text-slate-500"><svg aria-hidden="true" viewBox="0 0 24 24" className="h-5 w-5 fill-none stroke-current stroke-[1.8]"><rect x="4" y="5.5" width="16" height="14" rx="2" /><path d="M8 3.5v4M16 3.5v4M4 10h16" /></svg></div>
            <h2 className="mt-3 font-bold text-ink">{interview_id ? "Interview unavailable" : status === "upcoming" ? "No upcoming interviews" : "No interviews scheduled"}</h2><p className="mt-1 text-sm text-ink-muted">{interview_id ? "This interview is no longer available in your workspace." : "Choose an application and attach your external meeting URL when an interview is arranged."}</p>
          </div>
        )}
        {history && <section aria-label="Interview history" className="rounded-2xl border border-line/70 bg-white p-4"><h2 className="font-bold text-navy">Change history</h2>{history.items.length ? <ol className="mt-3 grid gap-2">{history.items.map((event, index) => <li key={`${event.changed_at}-${index}`} className="rounded-lg border border-line/60 p-3 text-sm"><span className="font-bold capitalize text-navy">{event.action}</span><span className="text-ink-muted"> by {event.actor_name} · {new Intl.DateTimeFormat("en-IN", { dateStyle: "medium", timeStyle: "short", timeZone: "Asia/Kolkata" }).format(new Date(event.changed_at))} IST</span>{event.action === "reschedule" && <p className="mt-1 text-xs text-ink-muted">Moved from {new Intl.DateTimeFormat("en-IN", { dateStyle: "medium", timeStyle: "short", timeZone: "Asia/Kolkata" }).format(new Date(event.previous_scheduled_at))} to {new Intl.DateTimeFormat("en-IN", { dateStyle: "medium", timeStyle: "short", timeZone: "Asia/Kolkata" }).format(new Date(event.new_scheduled_at))} IST.</p>}</li>)}</ol> : <p className="mt-2 text-sm text-ink-muted">No changes have been recorded for this interview.</p>}</section>}
      </div>
    </RecruiterShell>
  );
}

function dayKey(value:string){return new Intl.DateTimeFormat("en-CA",{timeZone:"Asia/Kolkata",year:"numeric",month:"2-digit",day:"2-digit"}).format(new Date(value));}
function InterviewDate({value}:{value:string}){const date=new Date(value);return <><span className="block text-sm font-semibold text-ink">{new Intl.DateTimeFormat("en-IN",{dateStyle:"medium",timeZone:"Asia/Kolkata"}).format(date)}</span><span className="mt-1 block text-xs text-ink-muted">{new Intl.DateTimeFormat("en-IN",{hour:"numeric",minute:"2-digit",timeZone:"Asia/Kolkata"}).format(date)} · IST</span></>}
