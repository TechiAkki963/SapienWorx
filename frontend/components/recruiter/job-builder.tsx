"use client";

import { FormEvent, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";

import { TaxonomyInput } from "@/components/workforce/taxonomy-input";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { apiRequest } from "@/lib/api";
import { EditableRecruiterJob, label, RecruiterJob, RecruiterTeamMember } from "@/lib/recruiter";

type BuilderState = {
  title: string;
  department: string;
  employment_type: string;
  work_mode: string;
  role_category: string;
  location: string;
  openings: string;
  min_experience_years: string;
  max_experience_years: string;
  min_salary_lakhs: string;
  max_salary_lakhs: string;
  description: string;
  responsibilities: string;
  company_overview: string;
  why_join: string;
  hiring_process: string;
  application_deadline: string;
  education_requirements: string;
  screening_questions: string;
  referral_enabled: boolean;
  referral_deadline?: string | null;
  referral_reward_enabled?: boolean;
  referral_terms?: string;
  referral_eligibility?: string;
  visibility: "public" | "private";
  internal_notes: string;
  assigned_recruiter_id: string;
};

const initialState: BuilderState = {
  title: "",
  department: "",
  employment_type: "full_time",
  work_mode: "hybrid",
  role_category: "",
  location: "",
  openings: "1",
  min_experience_years: "",
  max_experience_years: "",
  min_salary_lakhs: "",
  max_salary_lakhs: "",
  description: "",
  responsibilities: "",
  company_overview: "",
  why_join: "",
  hiring_process: "Application review\nRecruiter conversation\nRole-focused conversation\nFinal team conversation and decision",
  application_deadline: "",
  education_requirements: "",
  screening_questions: "",
  referral_enabled: false,
  referral_deadline: "",referral_reward_enabled:false,referral_terms:"",referral_eligibility:"",
  visibility: "public",
  internal_notes: "",
  assigned_recruiter_id: "",
};

const steps = [
  { number: 1, title: "Basics", subtitle: "Role, location and experience" },
  { number: 2, title: "Description", subtitle: "Story, competencies and qualifications" },
  { number: 3, title: "Application", subtitle: "Questions and closing date" },
  { number: 4, title: "Hiring workflow", subtitle: "Ownership, stages and internal context" },
  { number: 5, title: "Publish", subtitle: "Review, visibility and sharing" },
];

const roleCategoryOptions = [
  "Healthcare",
  "Finance",
  "Human Resources",
  "Operations",
  "Sales",
  "Marketing",
  "Technology",
  "Product",
  "Design",
  "Manufacturing",
  "Logistics",
  "Hospitality",
  "Education",
  "Construction",
  "Legal",
  "Retail",
  "Other",
];

const fieldClass = "min-h-11 min-w-0 w-full max-w-full rounded-xl border border-line bg-white px-3 shadow-sm outline-none focus:border-indigo/45 focus:ring-4 focus:ring-indigo-soft/50";

function optionalNumber(value: string): number | null {
  const normalized = value.trim();
  if (!normalized) return null;
  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : null;
}

function lines(value: string): string[] {
  return value.split("\n").map((item) => item.trim()).filter(Boolean);
}

function ChipInput({ skills, setSkills }: { skills: string[]; setSkills: (next: string[]) => void }) {
  const [value, setValue] = useState("");

  function addSkill() {
    const skill = value.trim();
    if (!skill) return;
    if (!skills.some((item) => item.toLowerCase() === skill.toLowerCase())) setSkills([...skills, skill]);
    setValue("");
  }

  return (
    <div>
      <label className="text-sm font-semibold text-ink">Skills & competencies</label>
      <div className="mt-2 flex min-h-12 flex-wrap items-center gap-2 rounded-xl border border-line bg-white px-3 py-2 shadow-sm focus-within:border-indigo/45 focus-within:ring-4 focus-within:ring-indigo-soft/50">
        {skills.map((skill) => (
          <span key={skill} className="inline-flex items-center gap-1.5 rounded-full bg-blue-50 px-2.5 py-1 text-xs font-bold text-blue-700">
            {skill}
            <button type="button" onClick={() => setSkills(skills.filter((item) => item !== skill))} className="text-blue-400 hover:text-blue-800" aria-label={`Remove ${skill}`}>×</button>
          </span>
        ))}
        <div className="min-w-[11rem] flex-1">
          <TaxonomyInput
            value={value}
            onValueChange={setValue}
            onSelect={(item) => {
              if (!skills.some((skill) => skill.toLowerCase() === item.canonical_name.toLowerCase())) setSkills([...skills, item.canonical_name]);
              setValue("");
            }}
            onCommit={addSkill}
            placeholder={skills.length ? "Add another competency" : "Search or add a competency"}
            className="w-full border-0 bg-transparent py-1 text-sm outline-none placeholder:text-ink-muted/65"
            ariaLabel="Search workforce taxonomy"
          />
        </div>
      </div>
      <p className="mt-1.5 text-xs text-ink-muted">Choose a canonical suggestion when available. New legitimate terms are still allowed and enter taxonomy review automatically.</p>
    </div>
  );
}

function TextareaField({
  labelText,
  value,
  onChange,
  placeholder,
  rows = 6,
  hint,
}: {
  labelText: string;
  value: string;
  onChange: (value: string) => void;
  placeholder: string;
  rows?: number;
  hint?: string;
}) {
  return (
    <label className="grid min-w-0 max-w-full gap-2 text-sm font-semibold text-ink">
      <span>{labelText}</span>
      <textarea rows={rows} value={value} onChange={(event) => onChange(event.target.value)} placeholder={placeholder} className="min-w-0 w-full max-w-full resize-y rounded-xl border border-line bg-white px-3.5 py-3 text-sm leading-6 shadow-sm outline-none transition placeholder:text-ink-muted/60 focus:border-indigo/45 focus:ring-4 focus:ring-indigo-soft/50" />
      {hint && <span className="text-xs font-normal leading-5 text-ink-muted">{hint}</span>}
    </label>
  );
}

function CandidatePreview({
  companyName,
  state,
  skills,
}: {
  companyName: string;
  state: BuilderState;
  skills: string[];
}) {
  const process = lines(state.hiring_process).slice(0, 5);
  return (
    <aside className="lg:sticky lg:top-24 lg:self-start">
      <div className="overflow-hidden rounded-2xl border border-line/70 bg-white shadow-[0_12px_32px_rgba(16,33,63,0.07)]">
        <div className="border-b border-line/60 px-5 py-4">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-[13px] font-extrabold uppercase tracking-[0.1em] text-indigo">Candidate-facing preview</p>
              <h2 className="mt-1 text-lg font-bold text-navy">Published story</h2>
            </div>
            <span className={`rounded-full px-2.5 py-1 text-[13px] font-extrabold uppercase tracking-[0.08em] ${state.visibility === "public" ? "bg-blue-50 text-blue-700" : "bg-slate-100 text-slate-700"}`}>
              {state.visibility}
            </span>
          </div>
        </div>
        <div className="p-5">
          {state.visibility === "private" && (
            <div className="mb-3 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs font-semibold leading-5 text-slate-700">
              Private roles are hidden from candidate search, recommendations and public job pages.
            </div>
          )}
          <div className="rounded-2xl border border-blue-100 bg-[#f8fbff] p-4">
            <div className="flex items-center gap-3">
              <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-navy text-sm font-extrabold text-white">{companyName.trim().charAt(0).toUpperCase() || "S"}</div>
              <div><p className="text-xs font-bold text-ink">{companyName}</p><p className="text-[13px] font-semibold text-ink-muted">Verified employer</p></div>
            </div>
            <h3 className="mt-5 text-xl font-bold tracking-[-0.035em] text-navy">{state.title || "Your job title"}</h3>
            <p className="mt-1 text-xs text-ink-muted">{state.department || "Department or team"}</p>
            <div className="mt-4 flex flex-wrap gap-1.5 text-[13px] font-bold text-ink-muted">
              {state.min_experience_years && <span>{state.min_experience_years}{state.max_experience_years ? `–${state.max_experience_years}` : "+"} years</span>}
              <span>· {label(state.work_mode)}</span><span>· {label(state.employment_type)}</span>{state.location && <span>· {state.location}</span>}
            </div>
            {skills.length > 0 && <div className="mt-3 flex flex-wrap gap-1.5">{skills.slice(0, 5).map((skill) => <span key={skill} className="rounded-md bg-blue-100/70 px-2 py-1 text-[13px] font-bold text-blue-800">{skill}</span>)}</div>}
            <p className="mt-4 line-clamp-5 text-xs leading-5 text-ink-muted">{state.description || "Your role summary will appear here as you write it."}</p>
            {process.length > 0 && <div className="mt-5 border-t border-line/60 pt-4"><p className="text-[13px] font-extrabold uppercase tracking-[0.1em] text-ink-muted">Hiring process</p><ol className="mt-3 grid gap-2">{process.map((item, index) => <li key={`${item}-${index}`} className="flex items-start gap-2 text-[11px] font-semibold text-ink"><span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-blue-100 text-[12px] font-extrabold text-blue-700">{index + 1}</span><span>{item}</span></li>)}</ol></div>}
            <div className="mt-5 flex items-center justify-between border-t border-line/60 pt-3 text-[12px] font-semibold text-ink-muted"><span>SapienWorx verified role</span><span className="text-indigo">View job →</span></div>
          </div>
          <p className="mt-3 text-xs leading-5 text-ink-muted">Internal compensation, recruiter assignment and internal notes are never shown to candidates.</p>
        </div>
      </div>
    </aside>
  );
}

function stateFromJob(job?: EditableRecruiterJob): BuilderState {
  if (!job) return initialState;
  return {
    title: job.title,
    department: job.department,
    employment_type: job.employment_type,
    work_mode: job.work_mode,
    role_category: job.role_category,
    location: job.location,
    openings: String(job.openings),
    min_experience_years: String(job.min_experience_years),
    max_experience_years: job.max_experience_years == null ? "" : String(job.max_experience_years),
    min_salary_lakhs: job.min_salary_lakhs == null ? "" : String(job.min_salary_lakhs),
    max_salary_lakhs: job.max_salary_lakhs == null ? "" : String(job.max_salary_lakhs),
    description: job.description === "Draft role details pending." ? "" : job.description,
    responsibilities: job.responsibilities,
    company_overview: job.company_overview,
    why_join: job.why_join,
    hiring_process: job.hiring_process.join("\n"),
    application_deadline: job.application_deadline ?? "",
    education_requirements: job.education_requirements.join("\n"),
    screening_questions: job.screening_questions.join("\n"),
    referral_enabled: job.referral_enabled,
    referral_deadline:job.referral_deadline??"",referral_reward_enabled:job.referral_reward_enabled??false,referral_terms:job.referral_terms??"",referral_eligibility:job.referral_eligibility??"",
    visibility: job.visibility,
    internal_notes: job.internal_notes,
    assigned_recruiter_id: job.assigned_recruiter_id ?? "",
  };
}

export function JobBuilder({
  companyName,
  job,
  team,
}: {
  companyName: string;
  job?: EditableRecruiterJob;
  team: RecruiterTeamMember[];
}) {
  const router = useRouter();
  const [step, setStep] = useState(1);
  const [state, setState] = useState<BuilderState>(() => stateFromJob(job));
  const [skills, setSkills] = useState<string[]>(() => job?.skills ?? []);
  const [busy, setBusy] = useState<"draft" | "publish" | "">("");
  const [error, setError] = useState("");
  const stepRef = useRef<HTMLHeadingElement>(null);
  useEffect(() => { stepRef.current?.focus(); }, [step]);
  const errorRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!error) return;
    errorRef.current?.focus();
  }, [error, step]);

  const publishReady = useMemo(
    () => Boolean(
      state.title.trim() &&
      state.description.trim() &&
      state.responsibilities.trim() &&
      skills.length &&
      lines(state.hiring_process).length >= 3,
    ),
    [state, skills],
  );
  const builderCanPublish = !job || job.status === "draft" || job.status === "active";

  function update<K extends keyof BuilderState>(key: K, value: BuilderState[K]) {
    setState((current) => ({ ...current, [key]: value }));
    if (error) setError("");
  }

  async function save(publish: boolean) {
    setError("");
    if (!state.title.trim()) {
      setStep(1);
      setError("Add a job title before saving this role.");
      return;
    }
    const openings = Number(state.openings);
    if (!Number.isInteger(openings) || openings < 1 || openings > 10000) {
      setStep(1);
      setError("Enter an openings count between 1 and 10,000.");
      return;
    }
    if (publish && (!publishReady || !builderCanPublish)) {
      setStep(5);
      setError(builderCanPublish
        ? "Complete the role summary, responsibilities, at least one competency, and at least three hiring stages before publishing."
        : "Save your edits here, then use the governed status control in Job Management to reopen this role.");
      return;
    }
    if(state.referral_reward_enabled&&(!state.referral_terms?.trim()||!state.referral_eligibility?.trim())){setStep(5);setError("Add the employer’s eligibility rules and referral terms before enabling rewards.");return;}
    setBusy(publish ? "publish" : "draft");
    try {
      await apiRequest<RecruiterJob | void>(job ? `/api/v1/recruiter/jobs/${job.id}` : "/api/v1/recruiter/jobs/builder", {
        method: job ? "PATCH" : "POST",
        body: JSON.stringify({
          title: state.title,
          department: state.department,
          employment_type: state.employment_type,
          work_mode: state.work_mode,
          role_category: state.role_category,
          location: state.location,
          openings,
          min_experience_years: Number(state.min_experience_years || 0),
          max_experience_years: optionalNumber(state.max_experience_years),
          min_salary_lakhs: optionalNumber(state.min_salary_lakhs),
          max_salary_lakhs: optionalNumber(state.max_salary_lakhs),
          skills,
          description: state.description,
          responsibilities: state.responsibilities,
          company_overview: state.company_overview,
          why_join: state.why_join,
          hiring_process: lines(state.hiring_process),
          application_deadline: state.application_deadline || null,
          education_requirements: lines(state.education_requirements),
          screening_questions: lines(state.screening_questions),
          referral_enabled: state.referral_enabled,
          referral_deadline:state.referral_deadline||null,referral_reward_enabled:state.referral_reward_enabled??false,referral_terms:state.referral_terms??"",referral_eligibility:state.referral_eligibility??"",
          visibility: state.visibility,
          internal_notes: state.internal_notes,
          assigned_recruiter_id: state.assigned_recruiter_id || null,
          publish,
        }),
      });
      router.push("/recruiter/jobs");
      router.refresh();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not save this role.");
    } finally {
      setBusy("");
    }
  }

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (step < 5) setStep(step + 1);
  }

  return (
    <form onSubmit={submit} className="grid min-w-0 w-full max-w-full gap-5">
      <nav className="grid gap-2 sm:grid-cols-2 xl:grid-cols-5" aria-label="Job posting steps">
        {steps.map((item) => {
          const active = item.number === step;
          const completed = item.number < step;
          return (
            <button key={item.number} type="button" aria-current={active ? "step" : undefined} onClick={() => setStep(item.number)} className={`rounded-xl border px-3.5 py-3 text-left transition ${active ? "border-indigo/40 bg-blue-50 shadow-sm" : completed ? "border-emerald-200 bg-emerald-50/45" : "border-line bg-white hover:border-indigo/25"}`}>
              <div className="flex items-start gap-3">
                <span className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-extrabold ${active ? "bg-indigo text-white" : completed ? "bg-emerald-100 text-emerald-700" : "border border-line bg-slate-50 text-ink-muted"}`}>{completed ? "✓" : item.number}</span>
                <span><span className="block text-sm font-bold text-ink">{item.title}</span><span className="mt-0.5 block text-[11px] leading-4 text-ink-muted">{item.subtitle}</span></span>
              </div>
            </button>
          );
        })}
      </nav>

      {error && <div ref={errorRef} id="job-builder-error" role="alert" tabIndex={-1} className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-semibold text-rose-800">{error}</div>}

      <div className="grid min-w-0 gap-5 lg:grid-cols-[minmax(0,1fr)_20rem] xl:grid-cols-[minmax(0,1fr)_23rem]">
        <section className="min-w-0 rounded-2xl border border-line/70 bg-white shadow-[0_1px_2px_rgba(16,33,63,0.03)]">
          <div className="border-b border-line/60 px-5 py-4 sm:px-6"><p className="text-[13px] font-extrabold uppercase tracking-[0.1em] text-indigo">Step {step} of 5</p><h2 ref={stepRef} tabIndex={-1} className="mt-1 text-xl font-bold tracking-[-0.03em] text-navy">{steps[step - 1].title}</h2></div>
          <div className="p-5 sm:p-6">
            {step === 1 && <div className="grid gap-5">
              <Input label="Job title" value={state.title} onChange={(event) => update("title", event.target.value)} placeholder="e.g. Critical Care Nurse" required error={error.startsWith("Add a job title") ? error : undefined} />
              <Input label="Department or team" value={state.department} onChange={(event) => update("department", event.target.value)} placeholder="e.g. Intensive Care Unit" />
              <div className="grid min-w-0 gap-4 sm:grid-cols-2">
                <label className="grid gap-2 text-sm font-semibold text-ink">Employment type<select value={state.employment_type} onChange={(event) => update("employment_type", event.target.value)} className={fieldClass}><option value="full_time">Full time</option><option value="part_time">Part time</option><option value="contract">Contract</option><option value="internship">Internship</option><option value="temporary">Temporary</option></select></label>
                <label className="grid gap-2 text-sm font-semibold text-ink">Workplace model<select value={state.work_mode} onChange={(event) => update("work_mode", event.target.value)} className={fieldClass}><option value="onsite">On-site</option><option value="hybrid">Hybrid</option><option value="remote">Remote</option></select></label>
              </div>
              <label className="grid gap-2 text-sm font-semibold text-ink">Role / function<select value={state.role_category} onChange={(event) => update("role_category", event.target.value)} className={fieldClass}><option value="">No category set</option>{state.role_category && !roleCategoryOptions.includes(state.role_category) && <option>{state.role_category}</option>}{roleCategoryOptions.map((option) => <option key={option}>{option}</option>)}</select></label>
              <div className="grid gap-4 sm:grid-cols-[minmax(0,1fr)_8rem]">
                <Input label="Location" value={state.location} onChange={(event) => update("location", event.target.value)} placeholder="e.g. Mumbai, India" />
                <Input label="Openings" type="number" min="1" max="10000" value={state.openings} onChange={(event) => update("openings", event.target.value)} error={error.startsWith("Enter an openings count") ? error : undefined} />
              </div>
              <div><h3 className="text-sm font-bold text-navy">Experience</h3><div className="mt-3 grid gap-4 sm:grid-cols-2"><Input label="Minimum years" type="number" min="0" value={state.min_experience_years} onChange={(event) => update("min_experience_years", event.target.value)} placeholder="e.g. 3" /><Input label="Maximum years" type="number" min="0" value={state.max_experience_years} onChange={(event) => update("max_experience_years", event.target.value)} placeholder="e.g. 6" /></div></div>
            </div>}

            {step === 2 && <div className="grid gap-5">
              <TextareaField labelText="Role summary" value={state.description} onChange={(value) => update("description", value)} placeholder="Describe the role, its purpose and what success looks like…" />
              <TextareaField labelText="Responsibilities" value={state.responsibilities} onChange={(value) => update("responsibilities", value)} placeholder="Add the outcomes and responsibilities candidates should understand before applying…" />
              <TextareaField labelText="Company overview" value={state.company_overview} onChange={(value) => update("company_overview", value)} placeholder="Introduce the company, its mission and the team this person will join." rows={4} />
              <TextareaField labelText="Why join" value={state.why_join} onChange={(value) => update("why_join", value)} placeholder="Give candidates honest reasons to consider this opportunity." rows={4} />
              <TextareaField labelText="Education requirements" value={state.education_requirements} onChange={(value) => update("education_requirements", value)} placeholder={"B.Sc Nursing\nGNM\nValid state nursing registration"} rows={4} hint="One requirement per line. Keep requirements genuinely necessary for the role." />
              <ChipInput skills={skills} setSkills={setSkills} />
            </div>}

            {step === 3 && <div className="grid gap-5">
              <label className="grid gap-2 text-sm font-semibold text-ink">Application deadline<input type="date" value={state.application_deadline} onChange={(event) => update("application_deadline", event.target.value)} className={fieldClass} /></label>
              <TextareaField labelText="Screening questions" value={state.screening_questions} onChange={(value) => update("screening_questions", value)} placeholder={"Do you hold a valid nursing registration?\nAre you available for rotational shifts?"} rows={5} hint="One question per line. Maximum 20 questions; each should be job-related and necessary." />
              <p className="text-xs leading-6 text-ink-muted">Existing candidate application and resume consent requirements remain in place.</p>
            </div>}

            {step === 4 && <div className="grid gap-5">
              <label className="grid gap-2 text-sm font-semibold text-ink">
                  Assigned recruiter
                  <select value={state.assigned_recruiter_id} onChange={(event) => update("assigned_recruiter_id", event.target.value)} className={fieldClass}>
                    <option value="">Me / default owner</option>
                    {team.map((member) => <option key={member.user_id} value={member.user_id}>{member.full_name}{member.designation ? ` — ${member.designation}` : ""}</option>)}
                  </select>
                </label>
              <TextareaField labelText="Hiring process" value={state.hiring_process} onChange={(value) => update("hiring_process", value)} placeholder={"Application review\nRecruiter conversation\nRole-focused conversation\nFinal decision"} rows={6} hint="Enter one stage per line. Use three to six stages so candidates know what to expect." />
              <div className="rounded-xl border border-amber-100 bg-amber-50/45 p-4">
                <div className="flex flex-wrap items-center gap-2"><h3 className="text-sm font-bold text-navy">Internal compensation range</h3><span className="rounded-full bg-white px-2 py-0.5 text-[12px] font-extrabold uppercase tracking-[0.08em] text-amber-700">Private</span></div>
                <div className="mt-3 grid gap-4 sm:grid-cols-2"><Input label="Minimum salary in lakhs" type="number" min="0" step="0.1" value={state.min_salary_lakhs} onChange={(event) => update("min_salary_lakhs", event.target.value)} placeholder="e.g. 12" /><Input label="Maximum salary in lakhs" type="number" min="0" step="0.1" value={state.max_salary_lakhs} onChange={(event) => update("max_salary_lakhs", event.target.value)} placeholder="e.g. 18" /></div>
                <p className="mt-3 text-xs leading-5 text-ink-muted">Used for matching and internal reporting. It is never shown in the candidate-facing preview.</p>
              </div>
              <TextareaField labelText="Internal recruiter notes" value={state.internal_notes} onChange={(value) => update("internal_notes", value)} placeholder="Hiring-manager context, sourcing notes, internal constraints…" rows={4} hint="Internal only. Never shown to candidates." />
            </div>}

            {step === 5 && <div className="grid gap-5">
              <p className="text-sm leading-6 text-ink-muted">Review the candidate-facing preview, then publish. Sharing becomes available from the job overview once the public role is active.</p>
              <div className="grid min-w-0 gap-4 sm:grid-cols-2">
                <label className="grid gap-2 text-sm font-semibold text-ink">
                  Job visibility
                  <select value={state.visibility} onChange={(event) => update("visibility", event.target.value as "public" | "private")} className={fieldClass}>
                    <option value="public">Public — searchable by candidates</option>
                    <option value="private">Private — recruiter access only</option>
                  </select>
                  <span className="text-xs font-normal leading-5 text-ink-muted">Private jobs do not appear in candidate search, recommendations or public job pages.</span>
                </label>
                <label className="flex min-h-[7.5rem] items-start gap-3 rounded-xl border border-line bg-white p-4 text-sm font-semibold text-ink">
                  <input type="checkbox" checked={state.referral_enabled} onChange={(event) => update("referral_enabled", event.target.checked)} className="mt-0.5 h-4 w-4 rounded border-line" />
                  <span><span className="block">Enable referrals</span><span className="mt-1 block text-xs font-normal leading-5 text-ink-muted">Allow this vacancy to participate in SapienWorx referral workflows.</span></span>
                </label>
              </div>
              {state.referral_enabled&&<fieldset className="grid gap-4 rounded-xl border border-line p-4"><legend className="px-1 text-base font-semibold text-navy">Candidate referrals</legend><label className="grid gap-2 text-sm font-semibold">Referral closing date (optional)<input type="date" value={state.referral_deadline??""} onChange={e=>update("referral_deadline",e.target.value)} className={fieldClass}/></label><p className="text-sm leading-6 text-ink-muted">Attribution policy: first valid referral wins. Existing applications are preserved; later recommendations require the candidate’s consent and never replace attribution.</p><label className="flex min-h-11 items-center gap-3 text-sm font-semibold"><input type="checkbox" checked={state.referral_reward_enabled??false} onChange={e=>update("referral_reward_enabled",e.target.checked)}/>This job has an employer referral reward programme</label><label className="grid gap-2 text-sm font-semibold">Eligibility rules{state.referral_reward_enabled?" (required for rewards)":" (optional)"}<textarea required={state.referral_reward_enabled??false} rows={3} maxLength={2000} value={state.referral_eligibility??""} onChange={e=>update("referral_eligibility",e.target.value)} className={fieldClass}/></label><label className="grid gap-2 text-sm font-semibold">Referral terms{state.referral_reward_enabled?" (required for rewards)":" (optional)"}<textarea required={state.referral_reward_enabled??false} rows={3} maxLength={4000} value={state.referral_terms??""} onChange={e=>update("referral_terms",e.target.value)} className={fieldClass}/></label><p className="text-sm leading-6 text-ink-muted">Programme terms are shown to candidates. Submission does not promise a reward or initiate payment. Invitations use the existing verified email flow.</p></fieldset>}
              <div className="grid min-w-0 gap-3 sm:grid-cols-2">
                <div className="rounded-xl border border-line p-4"><p className="text-xs font-bold text-ink-muted">Role</p><p className="mt-1 font-bold text-ink">{state.title || "Untitled role"}</p><p className="mt-1 text-xs text-ink-muted">{state.department || "No team set"} · {label(state.work_mode)}</p></div>
                <div className="rounded-xl border border-line p-4"><p className="text-xs font-bold text-ink-muted">Requirements</p><p className="mt-1 font-bold text-ink">{skills.length} competenc{skills.length === 1 ? "y" : "ies"}</p><p className="mt-1 text-xs text-ink-muted">{lines(state.screening_questions).length} screening question{lines(state.screening_questions).length === 1 ? "" : "s"} · {state.visibility}</p></div>
              </div>

              {!publishReady && <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-xs font-semibold leading-5 text-amber-900">To publish, complete the role summary, responsibilities, add at least one competency, and provide at least three hiring stages. You can still save this role as a draft.</div>}
              {!builderCanPublish && <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-xs font-semibold leading-5 text-slate-700">This role is {label(job!.status)}. Save content changes here, then use the governed status control in Job Management to reopen it.</div>}
            </div>}
          </div>

          <div className="flex flex-wrap items-center justify-between gap-3 border-t border-line/60 bg-slate-50/45 px-5 py-4 sm:px-6">
            <div className="flex flex-wrap gap-2">
              {step > 1 && <Button type="button" variant="secondary" onClick={() => setStep(step - 1)}>← Back</Button>}
              <Button type="button" variant="ghost" disabled={Boolean(busy)} onClick={() => save(false)}>{busy === "draft" ? "Saving…" : job ? "Save changes" : "Save as draft"}</Button>
            </div>
            {step < 5
              ? <Button type="submit">Continue →</Button>
              : builderCanPublish && <Button type="button" disabled={Boolean(busy) || !publishReady} onClick={() => save(true)}>{busy === "publish" ? "Publishing…" : job?.status === "active" ? "Save and keep published" : "Publish job"}</Button>}
          </div>
        </section>

        <CandidatePreview companyName={companyName} state={state} skills={skills} />
      </div>
    </form>
  );
}
