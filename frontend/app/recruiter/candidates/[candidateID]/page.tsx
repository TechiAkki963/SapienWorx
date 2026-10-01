import Link from "next/link";

import { CandidateCVButton } from "@/components/recruiter/candidate-cv-button";
import { CandidateComments } from "@/components/recruiter/candidate-comments";
import { CandidateContact } from "@/components/recruiter/candidate-contact";
import { CandidateProfileView } from "@/components/recruiter/candidate-profile-view";
import { SaveProfileButton } from "@/components/recruiter/save-profile-button";
import { RecruiterShell } from "@/components/recruiter/recruiter-shell";
import { requireRole } from "@/lib/auth-server";
import { experience, RecruiterCandidateActivity, RecruiterCandidateDetail, RecruiterJob } from "@/lib/recruiter";
import { recruiterAPI } from "@/lib/recruiter-server";

export const dynamic = "force-dynamic";

type Props = { params: Promise<{ candidateID: string }>; searchParams: Promise<{ job_id?: string; compose?: string; request_contact?: string; from?: string }> };
type RecordItem = Record<string, unknown>;

function text(details: Record<string, unknown>, key: string) {
  const value = details[key];
  return typeof value === "string" && value.trim() ? value.trim() : "—";
}

function records(details: Record<string, unknown>, key: string): RecordItem[] {
  const value = details[key];
  return Array.isArray(value) ? value.filter((item): item is RecordItem => Boolean(item && typeof item === "object" && !Array.isArray(item))) : [];
}

function recordText(item: RecordItem, key: string) {
  const value = item[key];
  return value == null || String(value).trim() === "" ? "—" : String(value);
}

function safeExternalURL(item: RecordItem, key = "url") {
  const value = item[key];
  if (typeof value !== "string" || !value.trim()) return null;
  try {
    const url = new URL(value.trim());
    return url.protocol === "https:" || url.protocol === "http:" ? url.toString() : null;
  } catch {
    return null;
  }
}

function formatDate(value?: string) {
  if (!value) return "—";
  return new Intl.DateTimeFormat("en-IN", { dateStyle: "medium", timeStyle: "short" }).format(new Date(value));
}

export default async function RecruiterCandidatePage({ params, searchParams }: Props) {
  await requireRole("recruiter");
  const { candidateID } = await params;
  const query = await searchParams;
  const [candidate, jobsResponse] = await Promise.all([
    recruiterAPI<RecruiterCandidateDetail>(`/api/v1/recruiter/candidates/${candidateID}`),
    recruiterAPI<{ items: RecruiterJob[] }>("/api/v1/recruiter/jobs"),
  ]);
  const jobs = jobsResponse.items ?? [];
  const activity = candidate.can_collaborate ? await recruiterAPI<RecruiterCandidateActivity>(`/api/v1/recruiter/candidates/${candidateID}/activity`).catch(() => ({ items: [] })) : { items: [] };
  const employment = records(candidate.details, "employment");
  const skills = records(candidate.details, "it_skills");
  const education = records(candidate.details, "education");
  const languages = records(candidate.details, "languages");
  const projects = records(candidate.details, "projects");
  const accomplishments = records(candidate.details, "accomplishments");
  const professionalLinks = records(candidate.details, "professional_links");
  const initials = candidate.full_name.split(/\s+/).filter(Boolean).map((part) => part[0]).slice(0, 2).join("").toUpperCase();

  const returnTarget = query.from === "discover" ? "/recruiter/discover" : query.from === "talent-pool" ? "/recruiter/talent-pool" : query.job_id ? `/recruiter/pipeline?job_id=${encodeURIComponent(query.job_id)}` : "/recruiter/pipeline";
  const returnLabel = query.from === "discover" ? "Back to discovery" : query.from === "talent-pool" ? "Back to talent pool" : "Back to applications";

  return (
    <RecruiterShell>
      <div className="grid gap-5">
        <CandidateProfileView
          candidateID={candidateID}
          candidateName={candidate.full_name}
          candidateHeadline={candidate.headline}
          jobs={jobs.map((job) => ({ id: job.id, title: job.title, status: job.status }))}
          composeOnOpen={query.compose === "1"}
          initialJobID={jobs.some(job => job.id === query.job_id) ? query.job_id : ""}
          requestContact={query.request_contact === "1"}
          toolbarStart={<Link href={returnTarget} className="inline-flex min-h-10 items-center rounded-xl px-1 text-sm font-bold text-indigo hover:underline">← {returnLabel}</Link>}
        >
          <div className="grid gap-5">
            <section className="rounded-2xl border border-line/70 bg-white p-5 shadow-[0_1px_3px_rgba(16,33,63,0.04)] sm:p-6">
              <div className="candidate-profile-header flex flex-col gap-5 xl:flex-row xl:items-start xl:justify-between">
                <div className="flex min-w-0 items-start gap-3 sm:gap-4">
                  {candidate.photo_data_url ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={candidate.photo_data_url} alt="" className="h-16 w-16 rounded-2xl object-cover" />
                  ) : (
                    <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-2xl bg-navy text-sm font-extrabold text-white">{initials}</div>
                  )}
                  <div className="min-w-0">
                    <p className="text-[10px] font-extrabold uppercase tracking-[0.14em] text-indigo">Candidate 360°</p>
                    <h1 className="mt-1 break-words text-2xl font-bold tracking-[-0.035em] text-navy">{candidate.full_name}</h1>
                    <p className="mt-1 text-sm text-ink-muted">{candidate.headline ?? "No professional headline"}</p>
                    <div className="mt-3 flex flex-wrap gap-2 text-xs font-semibold text-ink-muted">
                      <span className="rounded-full bg-slate-100 px-2.5 py-1">{experience(candidate.total_experience_months)} experience</span>
                      <span className="rounded-full bg-slate-100 px-2.5 py-1">{candidate.current_city ?? candidate.country_code}{candidate.current_state ? `, ${candidate.current_state}` : ""}</span>
                      <span className="rounded-full bg-slate-100 px-2.5 py-1">{candidate.notice_period_days == null ? "Notice not specified" : `${candidate.notice_period_days}d notice`}</span>
                      <span className="rounded-full bg-blue-50 px-2.5 py-1 text-blue-700">{candidate.profile_completion}% profile</span>
                    </div>
                    <div className="mt-3"><SaveProfileButton candidateID={candidateID} initialSaved={candidate.saved} initialTags={candidate.talent_pool_tags ?? []} /></div>
                  </div>
                </div>

                <div className="grid min-w-0 gap-2 rounded-xl border border-line/70 bg-slate-50/70 p-3 text-xs sm:min-w-[18rem]">
                  <div className="flex flex-wrap justify-between gap-x-4 gap-y-1"><span className="text-ink-muted">Last active</span><span className="font-bold text-ink">{formatDate(candidate.last_active_at)}</span></div>
                  <div className="flex flex-wrap justify-between gap-x-4 gap-y-1"><span className="text-ink-muted">Profile updated</span><span className="font-bold text-ink">{formatDate(candidate.profile_updated_at)}</span></div>
                </div>
              </div>
            </section>

            <div className="candidate-profile-two-column grid gap-5 xl:grid-cols-[minmax(0,1fr)_20rem]">
              <div className="grid gap-5 xl:col-start-1 xl:row-start-1">
                <section className="rounded-2xl border border-line/70 bg-white p-5">
                  <h2 className="text-base font-bold text-navy">Professional summary</h2>
                  <p className="mt-3 whitespace-pre-wrap text-sm leading-6 text-ink-muted">{text(candidate.details, "professional_summary")}</p>
                </section>
              </div>

              <aside className="grid content-start gap-4 xl:col-start-2 xl:row-span-2 xl:row-start-1">
                <section className="rounded-2xl border border-line/70 bg-white p-4">
                  <p className="text-[10px] font-extrabold uppercase tracking-[0.13em] text-ink-muted">Candidate CV</p>
                  <p className="mt-2 text-xs leading-5 text-ink-muted">{candidate.can_view_cv ? "CV access is authorized because this candidate has an application with your company. The download link expires automatically." : "CV remains private until the candidate applies to your company."}</p>
                  {candidate.can_view_cv && <div className="mt-3"><CandidateCVButton candidateID={candidateID} /></div>}
                </section>
                <section className="rounded-2xl border border-line/70 bg-white p-4">
                  <p className="text-[10px] font-extrabold uppercase tracking-[0.13em] text-ink-muted">Contact</p>
                  <dl className="mt-3 grid gap-3 text-sm">
                    <div><dt className="text-xs text-ink-muted">Email</dt><dd className="mt-0.5 break-all font-semibold text-ink">{candidate.has_company_application ? (candidate.email || "Not provided") : "Private until application"}</dd></div>
                    <div><dt className="text-xs text-ink-muted">Phone</dt><dd className="mt-1">{candidate.can_view_contact ? <CandidateContact candidateID={candidateID} /> : <span className="text-xs font-semibold text-ink-muted">Private until application</span>}</dd></div>
                    <div><dt className="text-xs text-ink-muted">Preferred locations</dt><dd className="mt-0.5 font-semibold text-ink">{text(candidate.details, "preferred_locations")}</dd></div>
                  </dl>
                </section>
                {candidate.can_collaborate ? <CandidateComments candidateID={candidateID} jobID={query.job_id} /> : <section className="rounded-2xl border border-line/70 bg-white p-4"><p className="text-[10px] font-extrabold uppercase tracking-[0.13em] text-ink-muted">Recruiter notes</p><p className="mt-2 text-xs leading-5 text-ink-muted">Internal application notes become available after the candidate applies to your company.</p></section>}
                {candidate.can_collaborate && <section className="rounded-2xl border border-line/70 bg-white p-4">
                  <div className="flex items-center justify-between gap-3"><p className="text-[10px] font-extrabold uppercase tracking-[0.13em] text-ink-muted">Recent activity</p><span className="text-[10px] font-bold text-ink-muted">{activity.items.length} events</span></div>
                  <div className="mt-3 grid gap-3">
                    {activity.items.length ? activity.items.slice(0, 6).map((item, index) => <div key={`${item.type}-${item.occurred_at}-${index}`} className="grid grid-cols-[0.5rem_minmax(0,1fr)] gap-2.5">
                      <span className="mt-1.5 h-2 w-2 rounded-full bg-indigo" aria-hidden="true" />
                      <div className="min-w-0">
                        <p className="text-xs font-bold text-ink">{item.title}</p>
                        <p className="mt-0.5 break-words text-[11px] leading-4 text-ink-muted">{item.description}</p>
                        {item.job_title && <p className="mt-0.5 text-[10px] font-semibold text-indigo">{item.job_title}</p>}
                        <time className="mt-1 block text-[10px] text-ink-muted" dateTime={item.occurred_at}>{formatDate(item.occurred_at)}</time>
                      </div>
                    </div>) : <p className="text-xs leading-5 text-ink-muted">No company activity recorded yet.</p>}
                  </div>
                </section>}
                <section className="rounded-2xl border border-line/70 bg-white p-4">
                  <p className="text-[10px] font-extrabold uppercase tracking-[0.13em] text-ink-muted">Searchable context</p>
                  <dl className="mt-3 grid gap-3 text-sm">
                    <div><dt className="text-xs text-ink-muted">Current designation</dt><dd className="mt-0.5 font-semibold text-ink">{text(candidate.details, "current_designation")}</dd></div>
                    <div><dt className="text-xs text-ink-muted">Industry</dt><dd className="mt-0.5 font-semibold text-ink">{text(candidate.details, "industry")}</dd></div>
                    <div><dt className="text-xs text-ink-muted">Department / role</dt><dd className="mt-0.5 font-semibold text-ink">{text(candidate.details, "department_role")}</dd></div>
                  </dl>
                </section>
              </aside>

              <div className="grid gap-5 xl:col-start-1 xl:row-start-2">

                <section className="rounded-2xl border border-line/70 bg-white p-5">
                  <div className="flex items-center justify-between"><h2 className="text-base font-bold text-navy">Employment</h2><span className="text-xs font-semibold text-ink-muted">{employment.length} records</span></div>
                  <div className="mt-4 grid gap-3">
                    {employment.length ? employment.map((item, index) => (
                      <div key={index} className="rounded-xl border border-line/70 bg-slate-50/55 p-4">
                        <div className="flex flex-wrap items-start justify-between gap-3"><div><p className="font-bold text-ink">{recordText(item, "job_title")}</p><p className="mt-0.5 text-sm text-ink-muted">{recordText(item, "company")}</p></div><span className="text-xs font-semibold text-ink-muted">{recordText(item, "employment_type")}</span></div>
                        <p className="mt-3 text-xs leading-5 text-ink-muted">{recordText(item, "job_profile")}</p>
                        <p className="mt-2 text-xs font-semibold text-ink">Skills: {recordText(item, "skills_used")}</p>
                      </div>
                    )) : <p className="text-sm text-ink-muted">No employment history added.</p>}
                  </div>
                </section>

                <section className="rounded-2xl border border-line/70 bg-white p-5">
                  <div className="flex items-center justify-between"><h2 className="text-base font-bold text-navy">Skills</h2><span className="text-xs font-semibold text-ink-muted">{skills.length} listed</span></div>
                  <div className="mt-4 flex flex-wrap gap-2">
                    {skills.length ? skills.map((item, index) => <span key={index} className="rounded-full border border-blue-100 bg-blue-50 px-3 py-1.5 text-xs font-bold text-blue-700">{recordText(item, "name")}</span>) : <p className="text-sm text-ink-muted">No skills added.</p>}
                  </div>
                </section>

                <section className="rounded-2xl border border-line/70 bg-white p-5">
                  <div className="flex items-center justify-between"><h2 className="text-base font-bold text-navy">Education</h2><span className="text-xs font-semibold text-ink-muted">{education.length} records</span></div>
                  <div className="mt-4 grid gap-3 sm:grid-cols-2">
                    {education.length ? education.map((item, index) => (
                      <div key={index} className="rounded-xl border border-line/70 p-4"><p className="font-bold text-ink">{recordText(item, "education")}</p><p className="mt-1 text-sm text-ink-muted">{recordText(item, "university")}</p><p className="mt-2 text-xs text-ink-muted">{recordText(item, "specialization")}</p></div>
                    )) : <p className="text-sm text-ink-muted">No education added.</p>}
                  </div>
                </section>

                <section className="rounded-2xl border border-line/70 bg-white p-5">
                  <div className="flex items-center justify-between gap-3"><h2 className="text-base font-bold text-navy">Languages</h2><span className="text-xs font-semibold text-ink-muted">{languages.length} listed</span></div>
                  <div className="mt-4 flex flex-wrap gap-2">
                    {languages.length ? languages.map((item, index) => <span key={index} className="rounded-full border border-line bg-slate-50 px-3 py-1.5 text-xs font-semibold text-ink">{recordText(item, "language")} · {recordText(item, "proficiency")}</span>) : <p className="text-sm text-ink-muted">No languages added.</p>}
                  </div>
                </section>

                {(projects.length > 0 || accomplishments.length > 0 || professionalLinks.length > 0) && <section className="rounded-2xl border border-line/70 bg-white p-5">
                  <h2 className="text-base font-bold text-navy">Professional highlights</h2>
                  <div className="mt-4 grid gap-3 sm:grid-cols-2">
                    {projects.map((item, index) => {
                      const title = recordText(item, "title") !== "—" ? recordText(item, "title") : recordText(item, "name");
                      const url = safeExternalURL(item);
                      return <article key={`project-${index}`} className="min-w-0 rounded-xl border border-line/70 bg-slate-50/55 p-4"><p className="text-[10px] font-extrabold uppercase tracking-[0.12em] text-indigo">Project</p><p className="mt-1 break-words text-sm font-bold text-ink">{title}</p><p className="mt-2 whitespace-pre-wrap break-words text-xs leading-5 text-ink-muted">{recordText(item, "description")}</p>{url && <a href={url} target="_blank" rel="noopener noreferrer" aria-label={`Open project ${title}`} className="mt-3 inline-flex text-xs font-bold text-indigo hover:underline">View project ↗</a>}</article>;
                    })}
                    {accomplishments.map((item, index) => {
                      const title = recordText(item, "title") !== "—" ? recordText(item, "title") : recordText(item, "name");
                      const url = safeExternalURL(item);
                      return <article key={`accomplishment-${index}`} className="min-w-0 rounded-xl border border-line/70 bg-slate-50/55 p-4"><p className="text-[10px] font-extrabold uppercase tracking-[0.12em] text-emerald-700">Accomplishment</p><p className="mt-1 break-words text-sm font-bold text-ink">{title}</p><p className="mt-2 whitespace-pre-wrap break-words text-xs leading-5 text-ink-muted">{recordText(item, "description")}</p>{url && <a href={url} target="_blank" rel="noopener noreferrer" aria-label={`Open accomplishment ${title}`} className="mt-3 inline-flex text-xs font-bold text-indigo hover:underline">View credential ↗</a>}</article>;
                    })}
                    {professionalLinks.map((item, index) => {
                      const label = recordText(item, "label") !== "—" ? recordText(item, "label") : recordText(item, "name");
                      const url = safeExternalURL(item);
                      return <article key={`link-${index}`} className="min-w-0 rounded-xl border border-line/70 bg-slate-50/55 p-4"><p className="text-[10px] font-extrabold uppercase tracking-[0.12em] text-indigo">Professional link</p><p className="mt-1 break-words text-sm font-bold text-ink">{label}</p>{url ? <a href={url} target="_blank" rel="noopener noreferrer" aria-label={`Open ${label}`} className="mt-3 inline-flex text-xs font-bold text-indigo hover:underline">Open link ↗</a> : <p className="mt-2 text-xs text-ink-muted">Link unavailable</p>}</article>;
                    })}
                  </div>
                </section>}
              </div>
            </div>
          </div>
        </CandidateProfileView>
      </div>
    </RecruiterShell>
  );
}
