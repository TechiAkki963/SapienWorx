import Link from "next/link";

import { CandidateCVButton } from "@/components/recruiter/candidate-cv-button";
import { CandidateComments } from "@/components/recruiter/candidate-comments";
import { CandidateContact } from "@/components/recruiter/candidate-contact";
import { CandidateHeaderActions } from "@/components/recruiter/candidate-header-actions";
import { CandidateProfileView } from "@/components/recruiter/candidate-profile-view";
import { RecruiterShell } from "@/components/recruiter/recruiter-shell";
import { requireRole } from "@/lib/auth-server";
import { experience, PipelineList, RecruiterCandidateActivity, RecruiterCandidateDetail, RecruiterCandidateMatch, RecruiterJob } from "@/lib/recruiter";
import { recruiterAPI } from "@/lib/recruiter-server";

export const dynamic = "force-dynamic";

type Props = {
  params: Promise<{ candidateID: string }>;
  searchParams: Promise<{ job_id?: string; compose?: string; request_contact?: string; from?: string }>;
};
type RecordItem = Record<string, unknown>;

const monthNumbers: Record<string, number> = {
  jan: 1, january: 1, feb: 2, february: 2, mar: 3, march: 3, apr: 4, april: 4,
  may: 5, jun: 6, june: 6, jul: 7, july: 7, aug: 8, august: 8, sep: 9, sept: 9,
  september: 9, oct: 10, october: 10, nov: 11, november: 11, dec: 12, december: 12,
};

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

function optionalRecordText(item: RecordItem, key: string) {
  const value = item[key];
  return value == null || String(value).trim() === "" ? "" : String(value).trim();
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
  return new Intl.DateTimeFormat("en-IN", { dateStyle: "medium", timeStyle: "short", timeZone: "Asia/Kolkata" }).format(new Date(value));
}

function employmentPeriod(item: RecordItem) {
  const startMonth = optionalRecordText(item, "joining_month");
  const startYear = optionalRecordText(item, "joining_year");
  const endMonth = optionalRecordText(item, "end_month");
  const endYear = optionalRecordText(item, "end_year");
  const current = optionalRecordText(item, "current_company").toLowerCase() === "yes";
  const start = [startMonth, startYear].filter(Boolean).join(" ");
  const end = current ? "Present" : [endMonth, endYear].filter(Boolean).join(" ");
  const period = start || end ? `${start || "Start not provided"} – ${end || "End not provided"}` : "";

  const startMonthNumber = monthNumbers[startMonth.toLowerCase()] ?? Number(startMonth);
  const endMonthNumber = current ? new Date().getMonth() + 1 : monthNumbers[endMonth.toLowerCase()] ?? Number(endMonth);
  const startYearNumber = Number(startYear);
  const endYearNumber = current ? new Date().getFullYear() : Number(endYear);
  if (!Number.isFinite(startMonthNumber) || !Number.isFinite(endMonthNumber) || !startYearNumber || !endYearNumber) return { period, duration: "" };

  const totalMonths = Math.max(0, (endYearNumber - startYearNumber) * 12 + (endMonthNumber - startMonthNumber));
  const years = Math.floor(totalMonths / 12);
  const months = totalMonths % 12;
  const duration = [years ? `${years} yr${years === 1 ? "" : "s"}` : "", months ? `${months} mo${months === 1 ? "" : "s"}` : ""].filter(Boolean).join(" ");
  return { period, duration };
}

function educationTitle(item: RecordItem) {
  return optionalRecordText(item, "education") || optionalRecordText(item, "level") || "Education";
}

function languageCapabilities(item: RecordItem) {
  return [
    optionalRecordText(item, "speak").toLowerCase() === "yes" ? "Speak" : "",
    optionalRecordText(item, "read").toLowerCase() === "yes" ? "Read" : "",
    optionalRecordText(item, "write").toLowerCase() === "yes" ? "Write" : "",
  ].filter(Boolean);
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
  const selectedJob = jobs.find((job) => job.id === query.job_id);
  const match = selectedJob
    ? await recruiterAPI<RecruiterCandidateMatch | null>(`/api/v1/recruiter/candidates/${candidateID}/match?job_id=${encodeURIComponent(selectedJob.id)}`).catch(() => null)
    : null;
  const [activity, pipeline] = await Promise.all([
    candidate.can_collaborate
      ? recruiterAPI<RecruiterCandidateActivity>(`/api/v1/recruiter/candidates/${candidateID}/activity`).catch(() => ({ items: [] }))
      : Promise.resolve({ items: [] }),
    candidate.can_collaborate
      ? recruiterAPI<PipelineList>("/api/v1/recruiter/pipeline?page=1&limit=50").catch(() => ({ items: [], page: 1, limit: 50, total: 0 }))
      : Promise.resolve({ items: [], page: 1, limit: 50, total: 0 }),
  ]);

  const candidateApplications = pipeline.items
    .filter((item) => item.candidate_id === candidateID)
    .sort((a, b) => Number(b.job_id === query.job_id) - Number(a.job_id === query.job_id));

  const employment = records(candidate.details, "employment");
  const skills = records(candidate.details, "it_skills");
  const education = records(candidate.details, "education");
  const languages = records(candidate.details, "languages");
  const projects = records(candidate.details, "projects");
  const accomplishments = records(candidate.details, "accomplishments");
  const professionalLinks = records(candidate.details, "professional_links");
  const initials = candidate.full_name.split(/\s+/).filter(Boolean).map((part) => part[0]).slice(0, 2).join("").toUpperCase();
  const preferredLocations = text(candidate.details, "preferred_locations");

  const returnTarget = query.from === "discover"
    ? "/recruiter/discover"
    : query.from === "talent-pool"
      ? "/recruiter/talent-pool"
      : query.job_id
        ? `/recruiter/pipeline?job_id=${encodeURIComponent(query.job_id)}`
        : "/recruiter/pipeline";
  const returnLabel = query.from === "discover"
    ? "Back to discovery"
    : query.from === "talent-pool"
      ? "Back to talent pool"
      : "Back to applications";

  return (
    <RecruiterShell>
      <div className="grid gap-5">
        <CandidateProfileView
          candidateID={candidateID}
          candidateName={candidate.full_name}
          candidateHeadline={candidate.headline}
          jobs={jobs.map((job) => ({ id: job.id, title: job.title, status: job.status }))}
          composeOnOpen={query.compose === "1"}
          initialJobID={jobs.some((job) => job.id === query.job_id) ? query.job_id : ""}
          requestContact={query.request_contact === "1"}
          toolbarStart={<Link href={returnTarget} className="inline-flex min-h-10 items-center rounded-xl px-1 text-sm font-bold text-indigo hover:underline">← {returnLabel}</Link>}
        >
          <div className="grid gap-4">
            <section className="rounded-2xl border border-line/70 bg-white p-5 shadow-[0_1px_3px_rgba(16,33,63,0.04)] sm:p-6">
              <div className="candidate-profile-header grid gap-5 xl:grid-cols-[minmax(0,1fr)_auto] xl:items-start">
                <div className="flex min-w-0 items-start gap-3 sm:gap-4">
                  {candidate.photo_data_url ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={candidate.photo_data_url} alt="" className="h-16 w-16 shrink-0 rounded-2xl object-cover" />
                  ) : (
                    <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-2xl bg-navy text-sm font-extrabold text-white">{initials}</div>
                  )}

                  <div className="min-w-0">
                    <p className="text-[10px] font-extrabold uppercase tracking-[0.14em] text-indigo">Candidate 360°</p>
                    <h1 className="mt-1 break-words text-2xl font-bold tracking-[-0.035em] text-navy">{candidate.full_name}</h1>
                    <p className="mt-1 text-sm text-ink-muted">{candidate.headline ?? "No professional headline"}</p>

                    <div className="mt-3 flex flex-wrap gap-2 text-xs font-semibold text-ink-muted">
                      <span className="rounded-full bg-slate-100 px-2.5 py-1">{experience(candidate.total_experience_months)} experience</span>
                      <span className="rounded-full bg-slate-100 px-2.5 py-1">
                        {candidate.current_city ?? candidate.country_code}{candidate.current_state ? `, ${candidate.current_state}` : ""}
                      </span>
                      <span className="rounded-full bg-slate-100 px-2.5 py-1">
                        {candidate.notice_period_days == null ? "Notice not specified" : `${candidate.notice_period_days}d notice`}
                      </span>
                    </div>

                    {preferredLocations !== "—" && (
                      <p className="mt-3 text-xs leading-5 text-ink-muted">
                        <span className="font-bold text-ink">Preferred location:</span> {preferredLocations}
                      </p>
                    )}
                  </div>
                </div>

                <CandidateHeaderActions
                  candidateID={candidateID}
                  initialSaved={candidate.saved}
                  applications={candidateApplications}
                />
              </div>
            </section>

            <section aria-label="Candidate activity and profile freshness" className="grid gap-2 rounded-xl border border-line/70 bg-white px-4 py-3 text-xs shadow-[0_1px_2px_rgba(16,33,63,0.03)] sm:grid-cols-3 sm:items-center">
              <div className="flex items-center gap-2">
                <span className="h-2 w-2 shrink-0 rounded-full bg-emerald-500" aria-hidden="true" />
                <span className="text-ink-muted">Last active</span>
                <span className="ml-auto font-bold text-ink sm:ml-0">{formatDate(candidate.last_active_at)}</span>
              </div>
              <div className="flex items-center gap-2 sm:justify-center">
                <span className="text-ink-muted">Profile updated</span>
                <span className="ml-auto font-bold text-ink sm:ml-0">{formatDate(candidate.profile_updated_at)}</span>
              </div>
              <div className="flex items-center gap-2 sm:justify-end">
                <span className="text-ink-muted">Profile completeness</span>
                <span className="ml-auto rounded-full bg-indigo-soft px-2 py-0.5 font-extrabold text-indigo sm:ml-0">{candidate.profile_completion}%</span>
              </div>
            </section>

            <div className="candidate-profile-two-column grid gap-5 xl:grid-cols-[minmax(0,1fr)_20rem]">
              {selectedJob && (
                <section aria-label="Candidate job match" className="rounded-2xl border border-indigo-100/80 bg-[linear-gradient(145deg,#ffffff_0%,#f8f7ff_100%)] p-4 shadow-[0_1px_3px_rgba(16,33,63,0.04)] xl:col-start-2 xl:row-start-1">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="text-[10px] font-extrabold uppercase tracking-[0.13em] text-indigo">Job match</p>
                      <p className="mt-1 break-words text-sm font-bold text-navy">{selectedJob.title}</p>
                    </div>
                    {match && (
                      <div className="shrink-0 rounded-xl bg-indigo px-3 py-2 text-center text-white">
                        <p className="text-xl font-extrabold leading-none">{Math.round(match.score)}%</p>
                        <p className="mt-1 text-[9px] font-bold uppercase tracking-[0.08em] text-white/80">Match</p>
                      </div>
                    )}
                  </div>

                  {match ? (
                    <>
                      <p className="mt-3 text-xs leading-5 text-ink-muted">
                        Advisory fit generated by SapienWorx Intelligence from job and candidate profile signals. It does not make hiring decisions.
                      </p>
                      <div className="mt-4 grid grid-cols-2 gap-2 text-[11px]">
                        {[
                          ["Skills", match.components.skills],
                          ["Experience", match.components.experience],
                          ["Location", match.components.location],
                          ["Availability", match.components.availability],
                        ].map(([label, value]) => (
                          <div key={String(label)} className="rounded-xl border border-line/60 bg-white px-3 py-2">
                            <p className="font-semibold text-ink-muted">{String(label)}</p>
                            <p className="mt-0.5 text-sm font-extrabold text-ink">{typeof value === "number" ? `${Math.round(value)}%` : "—"}</p>
                          </div>
                        ))}
                      </div>
                      {Array.isArray(match.components.matched_skills) && match.components.matched_skills.length > 0 && (
                        <div className="mt-3">
                          <p className="text-[10px] font-bold uppercase tracking-[0.1em] text-ink-muted">Matched skills</p>
                          <div className="mt-2 flex flex-wrap gap-1.5">
                            {match.components.matched_skills.slice(0, 6).map((skill) => (
                              <span key={String(skill)} className="rounded-full bg-indigo-soft/70 px-2 py-1 text-[10px] font-bold text-indigo">{String(skill)}</span>
                            ))}
                          </div>
                        </div>
                      )}
                      <p className="mt-3 text-[10px] leading-4 text-ink-muted">
                        {match.eligible ? "Meets the matcher’s current eligibility gate." : "Below the matcher’s current eligibility gate."} · Model {match.model_version}
                      </p>
                    </>
                  ) : (
                    <p className="mt-3 text-xs leading-5 text-ink-muted">
                      No current production-model match result is available for this candidate and job yet. Profile completeness is kept separate from job match.
                    </p>
                  )}
                </section>
              )}

              <div className="grid gap-5 xl:col-start-1 xl:row-start-1">
                {candidate.can_collaborate ? (
                  <CandidateComments candidateID={candidateID} jobID={query.job_id} applicationID={candidateApplications[0]?.application_id} />
                ) : (
                  <section className="rounded-2xl border border-line/70 bg-white p-5">
                    <div className="flex items-center justify-between gap-3">
                      <h2 className="text-base font-bold text-navy">Recruiter Notes</h2>
                      <span className="rounded-full bg-slate-100 px-2 py-1 text-[10px] font-bold text-ink-muted">Internal</span>
                    </div>
                    <p className="mt-2 text-sm leading-6 text-ink-muted">Internal recruiter notes become available after the candidate applies to your company.</p>
                  </section>
                )}

                <section className="rounded-2xl border border-line/70 bg-white p-5">
                  <h2 className="text-base font-bold text-navy">Professional Summary</h2>
                  <p className="mt-3 whitespace-pre-wrap text-sm leading-6 text-ink-muted">{text(candidate.details, "professional_summary")}</p>
                </section>

                <section className="rounded-2xl border border-line/70 bg-white p-5">
                  <div className="flex items-center justify-between gap-3">
                    <h2 className="text-base font-bold text-navy">Employment</h2>
                    <span className="text-xs font-semibold text-ink-muted">{employment.length} records</span>
                  </div>
                  <div className="mt-4 grid gap-3">
                    {employment.length ? employment.map((item, index) => {
                      const timeline = employmentPeriod(item);
                      const profile = optionalRecordText(item, "job_profile");
                      const skillsUsed = optionalRecordText(item, "skills_used");
                      return (
                        <article key={index} className="rounded-xl border border-line/70 bg-slate-50/55 p-4">
                          <div className="flex flex-wrap items-start justify-between gap-3">
                            <div>
                              <p className="font-bold text-ink">{recordText(item, "job_title")}</p>
                              <p className="mt-0.5 text-sm text-ink-muted">{recordText(item, "company")}</p>
                            </div>
                            {optionalRecordText(item, "employment_type") && <span className="rounded-full bg-white px-2.5 py-1 text-[11px] font-bold text-ink-muted">{optionalRecordText(item, "employment_type")}</span>}
                          </div>
                          {(timeline.period || timeline.duration) && (
                            <p className="mt-2 text-xs font-semibold text-ink-muted">
                              {timeline.period}{timeline.duration ? ` · ${timeline.duration}` : ""}
                            </p>
                          )}
                          {profile && <p className="mt-3 text-xs leading-5 text-ink-muted">{profile}</p>}
                          {skillsUsed && <p className="mt-2 text-xs font-semibold text-ink">Skills: {skillsUsed}</p>}
                        </article>
                      );
                    }) : <p className="text-sm text-ink-muted">No employment history added.</p>}
                  </div>
                </section>

                <section className="rounded-2xl border border-line/70 bg-white p-5">
                  <div className="flex items-center justify-between gap-3">
                    <h2 className="text-base font-bold text-navy">Skills</h2>
                    <span className="text-xs font-semibold text-ink-muted">{skills.length} listed</span>
                  </div>
                  <div className="mt-4 flex flex-wrap gap-2">
                    {skills.length ? skills.map((item, index) => {
                      const proficiency = optionalRecordText(item, "proficiency");
                      return (
                        <span key={index} className="rounded-full border border-blue-100 bg-blue-50 px-3 py-1.5 text-xs font-bold text-blue-700">
                          {recordText(item, "name")}{proficiency ? ` · ${proficiency}` : ""}
                        </span>
                      );
                    }) : <p className="text-sm text-ink-muted">No skills added.</p>}
                  </div>
                </section>

                <section className="rounded-2xl border border-line/70 bg-white p-5">
                  <div className="flex items-center justify-between gap-3">
                    <h2 className="text-base font-bold text-navy">Education</h2>
                    <span className="text-xs font-semibold text-ink-muted">{education.length} records</span>
                  </div>
                  <div className="mt-4 grid gap-3 sm:grid-cols-2">
                    {education.length ? education.map((item, index) => {
                      const startYear = optionalRecordText(item, "start_year");
                      const endYear = optionalRecordText(item, "end_year");
                      const score = optionalRecordText(item, "score");
                      const gradingSystem = optionalRecordText(item, "grading_system");
                      const specialization = optionalRecordText(item, "specialization");
                      return (
                        <article key={index} className="rounded-xl border border-line/70 bg-slate-50/40 p-4">
                          <p className="font-bold text-ink">{educationTitle(item)}</p>
                          <p className="mt-1 text-sm text-ink-muted">{recordText(item, "university")}</p>
                          {specialization && <p className="mt-2 text-xs font-semibold text-ink">{specialization}</p>}
                          {(startYear || endYear) && <p className="mt-2 text-xs text-ink-muted">{startYear || "—"} – {endYear || "—"}</p>}
                          {(score || gradingSystem) && (
                            <p className="mt-2 text-xs font-bold text-indigo">
                              {score ? `${score}${gradingSystem ? ` · ${gradingSystem}` : ""}` : gradingSystem}
                            </p>
                          )}
                        </article>
                      );
                    }) : <p className="text-sm text-ink-muted">No education added.</p>}
                  </div>
                </section>

                <section className="rounded-2xl border border-line/70 bg-white p-5">
                  <div className="flex items-center justify-between gap-3">
                    <h2 className="text-base font-bold text-navy">Languages</h2>
                    <span className="text-xs font-semibold text-ink-muted">{languages.length} listed</span>
                  </div>
                  <div className="mt-4 grid gap-2">
                    {languages.length ? languages.map((item, index) => {
                      const capabilities = languageCapabilities(item);
                      const proficiency = optionalRecordText(item, "proficiency");
                      return (
                        <div key={index} className="flex flex-wrap items-center gap-2 rounded-xl border border-line/70 bg-slate-50/45 px-3 py-2.5">
                          <span className="min-w-[7rem] text-sm font-bold text-ink">{recordText(item, "language")}</span>
                          {proficiency && <span className="rounded-full bg-white px-2 py-1 text-[11px] font-semibold text-ink-muted">{proficiency}</span>}
                          {capabilities.map((capability) => <span key={capability} className="rounded-full bg-indigo-soft/70 px-2 py-1 text-[11px] font-bold text-indigo">{capability}</span>)}
                        </div>
                      );
                    }) : <p className="text-sm text-ink-muted">No languages added.</p>}
                  </div>
                </section>

                {(projects.length > 0 || accomplishments.length > 0 || professionalLinks.length > 0) && (
                  <section className="rounded-2xl border border-line/70 bg-white p-5">
                    <h2 className="text-base font-bold text-navy">Professional Highlights</h2>
                    <div className="mt-4 grid gap-3 sm:grid-cols-2">
                      {projects.map((item, index) => {
                        const title = recordText(item, "title") !== "—" ? recordText(item, "title") : recordText(item, "name");
                        const url = safeExternalURL(item);
                        return (
                          <article key={`project-${index}`} className="min-w-0 rounded-xl border border-line/70 bg-slate-50/55 p-4">
                            <p className="text-[10px] font-extrabold uppercase tracking-[0.12em] text-indigo">Project</p>
                            <p className="mt-1 break-words text-sm font-bold text-ink">{title}</p>
                            <p className="mt-2 whitespace-pre-wrap break-words text-xs leading-5 text-ink-muted">{recordText(item, "description")}</p>
                            {url && <a href={url} target="_blank" rel="noopener noreferrer" aria-label={`Open project ${title}`} className="mt-3 inline-flex text-xs font-bold text-indigo hover:underline">View project ↗</a>}
                          </article>
                        );
                      })}
                      {accomplishments.map((item, index) => {
                        const title = recordText(item, "title") !== "—" ? recordText(item, "title") : recordText(item, "name");
                        const url = safeExternalURL(item);
                        return (
                          <article key={`accomplishment-${index}`} className="min-w-0 rounded-xl border border-line/70 bg-slate-50/55 p-4">
                            <p className="text-[10px] font-extrabold uppercase tracking-[0.12em] text-emerald-700">Accomplishment</p>
                            <p className="mt-1 break-words text-sm font-bold text-ink">{title}</p>
                            <p className="mt-2 whitespace-pre-wrap break-words text-xs leading-5 text-ink-muted">{recordText(item, "description")}</p>
                            {url && <a href={url} target="_blank" rel="noopener noreferrer" aria-label={`Open accomplishment ${title}`} className="mt-3 inline-flex text-xs font-bold text-indigo hover:underline">View credential ↗</a>}
                          </article>
                        );
                      })}
                      {professionalLinks.map((item, index) => {
                        const label = recordText(item, "label") !== "—" ? recordText(item, "label") : recordText(item, "name");
                        const url = safeExternalURL(item);
                        return (
                          <article key={`link-${index}`} className="min-w-0 rounded-xl border border-line/70 bg-slate-50/55 p-4">
                            <p className="text-[10px] font-extrabold uppercase tracking-[0.12em] text-indigo">Professional link</p>
                            <p className="mt-1 break-words text-sm font-bold text-ink">{label}</p>
                            {url ? <a href={url} target="_blank" rel="noopener noreferrer" aria-label={`Open ${label}`} className="mt-3 inline-flex text-xs font-bold text-indigo hover:underline">Open link ↗</a> : <p className="mt-2 text-xs text-ink-muted">Link unavailable</p>}
                          </article>
                        );
                      })}
                    </div>
                  </section>
                )}
              </div>

              <aside className="grid content-start gap-4 xl:col-start-2 xl:row-start-2">
                <section className="rounded-2xl border border-line/70 bg-white p-4">
                  <p className="text-[10px] font-extrabold uppercase tracking-[0.13em] text-ink-muted">Candidate CV</p>
                  <p className="mt-2 text-xs leading-5 text-ink-muted">
                    {candidate.can_view_cv
                      ? "CV access is authorized because this candidate has an application with your company. The download link expires automatically."
                      : "CV remains private until the candidate applies to your company."}
                  </p>
                  {candidate.can_view_cv && <div className="mt-3"><CandidateCVButton candidateID={candidateID} /></div>}
                </section>

                <section className="rounded-2xl border border-line/70 bg-white p-4">
                  <p className="text-[10px] font-extrabold uppercase tracking-[0.13em] text-ink-muted">Contact</p>
                  <dl className="mt-3 grid gap-3 text-sm">
                    <div>
                      <dt className="text-xs text-ink-muted">Email</dt>
                      <dd className="mt-0.5 break-all font-semibold text-ink">{candidate.has_company_application ? (candidate.email || "Not provided") : "Private until application"}</dd>
                    </div>
                    <div>
                      <dt className="text-xs text-ink-muted">Phone</dt>
                      <dd className="mt-1">{candidate.can_view_contact ? <CandidateContact candidateID={candidateID} /> : <span className="text-xs font-semibold text-ink-muted">Private until application</span>}</dd>
                    </div>
                  </dl>
                </section>

                {candidate.can_collaborate && (
                  <section className="rounded-2xl border border-line/70 bg-white p-4">
                    <div className="flex items-center justify-between gap-3">
                      <p className="text-[10px] font-extrabold uppercase tracking-[0.13em] text-ink-muted">Recent activity</p>
                      <span className="text-[10px] font-bold text-ink-muted">{activity.items.length} events</span>
                    </div>
                    <div className="mt-3 grid gap-3">
                      {activity.items.length ? activity.items.slice(0, 6).map((item, index) => (
                        <div key={`${item.type}-${item.occurred_at}-${index}`} className="grid grid-cols-[0.5rem_minmax(0,1fr)] gap-2.5">
                          <span className="mt-1.5 h-2 w-2 rounded-full bg-indigo" aria-hidden="true" />
                          <div className="min-w-0">
                            <p className="text-xs font-bold text-ink">{item.title}</p>
                            <p className="mt-0.5 break-words text-[11px] leading-4 text-ink-muted">{item.description}</p>
                            {item.job_title && <p className="mt-0.5 text-[10px] font-semibold text-indigo">{item.job_title}</p>}
                            <time className="mt-1 block text-[10px] text-ink-muted" dateTime={item.occurred_at}>{formatDate(item.occurred_at)}</time>
                          </div>
                        </div>
                      )) : <p className="text-xs leading-5 text-ink-muted">No company activity recorded yet.</p>}
                    </div>
                  </section>
                )}

                <section className="rounded-2xl border border-line/70 bg-white p-4">
                  <p className="text-[10px] font-extrabold uppercase tracking-[0.13em] text-ink-muted">Profile context</p>
                  <dl className="mt-3 grid gap-3 text-sm">
                    <div><dt className="text-xs text-ink-muted">Current designation</dt><dd className="mt-0.5 font-semibold text-ink">{text(candidate.details, "current_designation")}</dd></div>
                    <div><dt className="text-xs text-ink-muted">Industry</dt><dd className="mt-0.5 font-semibold text-ink">{text(candidate.details, "industry")}</dd></div>
                    <div><dt className="text-xs text-ink-muted">Department / role</dt><dd className="mt-0.5 font-semibold text-ink">{text(candidate.details, "department_role")}</dd></div>
                  </dl>
                </section>
              </aside>
            </div>
          </div>
        </CandidateProfileView>
      </div>
    </RecruiterShell>
  );
}
