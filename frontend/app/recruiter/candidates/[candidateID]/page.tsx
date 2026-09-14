import Link from "next/link";

import { CandidateCVButton } from "@/components/recruiter/candidate-cv-button";
import { CandidateProfileView } from "@/components/recruiter/candidate-profile-view";
import { RecruiterShell } from "@/components/recruiter/recruiter-shell";
import { requireRole } from "@/lib/auth-server";
import { experience, RecruiterCandidateDetail, RecruiterJob } from "@/lib/recruiter";
import { recruiterAPI } from "@/lib/recruiter-server";

export const dynamic = "force-dynamic";

type Props = { params: Promise<{ candidateID: string }> };

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

function formatDate(value?: string) {
  if (!value) return "—";
  return new Intl.DateTimeFormat("en-IN", { dateStyle: "medium", timeStyle: "short" }).format(new Date(value));
}

export default async function RecruiterCandidatePage({ params }: Props) {
  await requireRole("recruiter");
  const { candidateID } = await params;
  const [candidate, jobs] = await Promise.all([
    recruiterAPI<RecruiterCandidateDetail>(`/api/v1/recruiter/candidates/${candidateID}`),
    recruiterAPI<RecruiterJob[]>("/api/v1/recruiter/jobs"),
  ]);
  const employment = records(candidate.details, "employment");
  const skills = records(candidate.details, "it_skills");
  const education = records(candidate.details, "education");
  const initials = candidate.full_name.split(/\s+/).filter(Boolean).map((part) => part[0]).slice(0, 2).join("").toUpperCase();

  return (
    <RecruiterShell>
      <div className="grid gap-5">
        <div className="flex items-center justify-between gap-3">
          <Link href="/recruiter/pipeline" className="text-sm font-bold text-indigo hover:underline">← Back to pipeline</Link>
        </div>

        <CandidateProfileView
          candidateID={candidateID}
          candidateName={candidate.full_name}
          candidateHeadline={candidate.headline}
          jobs={jobs.map((job) => ({ id: job.id, title: job.title, status: job.status }))}
        >
          <div className="grid gap-5">
            <section className="rounded-2xl border border-line/70 bg-white p-5 shadow-[0_1px_3px_rgba(16,33,63,0.04)] sm:p-6">
              <div className="flex flex-col gap-5 xl:flex-row xl:items-start xl:justify-between">
                <div className="flex items-start gap-4">
                  {candidate.photo_data_url ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={candidate.photo_data_url} alt="" className="h-16 w-16 rounded-2xl object-cover" />
                  ) : (
                    <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-navy text-sm font-extrabold text-white">{initials}</div>
                  )}
                  <div>
                    <p className="text-[10px] font-extrabold uppercase tracking-[0.14em] text-indigo">Candidate profile</p>
                    <h1 className="mt-1 text-2xl font-bold tracking-[-0.035em] text-navy">{candidate.full_name}</h1>
                    <p className="mt-1 text-sm text-ink-muted">{candidate.headline ?? "No professional headline"}</p>
                    <div className="mt-3 flex flex-wrap gap-2 text-xs font-semibold text-ink-muted">
                      <span className="rounded-full bg-slate-100 px-2.5 py-1">{experience(candidate.total_experience_months)} experience</span>
                      <span className="rounded-full bg-slate-100 px-2.5 py-1">{candidate.current_city ?? candidate.country_code}{candidate.current_state ? `, ${candidate.current_state}` : ""}</span>
                      <span className="rounded-full bg-slate-100 px-2.5 py-1">{candidate.notice_period_days == null ? "Notice not specified" : `${candidate.notice_period_days}d notice`}</span>
                      <span className="rounded-full bg-blue-50 px-2.5 py-1 text-blue-700">{candidate.profile_completion}% profile</span>
                    </div>
                  </div>
                </div>

                <div className="grid min-w-[18rem] gap-2 rounded-xl border border-line/70 bg-slate-50/70 p-3 text-xs">
                  <div className="flex justify-between gap-4"><span className="text-ink-muted">Last active</span><span className="font-bold text-ink">{formatDate(candidate.last_active_at)}</span></div>
                  <div className="flex justify-between gap-4"><span className="text-ink-muted">Profile updated</span><span className="font-bold text-ink">{formatDate(candidate.profile_updated_at)}</span></div>
                </div>
              </div>
            </section>

            <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_20rem]">
              <div className="grid gap-5">
                <section className="rounded-2xl border border-line/70 bg-white p-5">
                  <h2 className="text-base font-bold text-navy">Professional summary</h2>
                  <p className="mt-3 whitespace-pre-wrap text-sm leading-6 text-ink-muted">{text(candidate.details, "professional_summary")}</p>
                </section>

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
              </div>

              <aside className="grid content-start gap-4">
                <section className="rounded-2xl border border-line/70 bg-white p-4">
                  <p className="text-[10px] font-extrabold uppercase tracking-[0.13em] text-ink-muted">Candidate CV</p>
                  <p className="mt-2 text-xs leading-5 text-ink-muted">CV access is authorized only because this candidate has an application with your company. The download link expires automatically.</p>
                  <div className="mt-3"><CandidateCVButton candidateID={candidateID} /></div>
                </section>
                <section className="rounded-2xl border border-line/70 bg-white p-4">
                  <p className="text-[10px] font-extrabold uppercase tracking-[0.13em] text-ink-muted">Contact</p>
                  <dl className="mt-3 grid gap-3 text-sm">
                    <div><dt className="text-xs text-ink-muted">Email</dt><dd className="mt-0.5 break-all font-semibold text-ink">{candidate.email}</dd></div>
                    <div><dt className="text-xs text-ink-muted">Phone</dt><dd className="mt-0.5 font-semibold text-ink">{candidate.phone ?? "—"}</dd></div>
                    <div><dt className="text-xs text-ink-muted">Preferred locations</dt><dd className="mt-0.5 font-semibold text-ink">{text(candidate.details, "preferred_locations")}</dd></div>
                  </dl>
                </section>
                <section className="rounded-2xl border border-line/70 bg-white p-4">
                  <p className="text-[10px] font-extrabold uppercase tracking-[0.13em] text-ink-muted">Searchable context</p>
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
