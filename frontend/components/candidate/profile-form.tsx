"use client";

import { FormEvent, ReactNode, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

import { Button } from "@/components/ui/button";
import { apiRequest } from "@/lib/api";
import { TaxonomyInput } from "@/components/workforce/taxonomy-input";
import { CandidateProfile, CandidateProfileDetails } from "@/lib/candidate";

type Details = Record<string, unknown>;

type ProfileFormProps = {
  profile: CandidateProfile;
  extended: CandidateProfileDetails;
  onSaved?: () => void;
  guided?: boolean;
  section?: ProfileFormSection;
};

export type ProfileFormSection = "about" | "experience" | "skills" | "education" | "preferences" | "additional";

const sectionDetailKeys: Record<ProfileFormSection, string[]> = {
  about: ["current_designation", "professional_summary", "employment_highlights", "interested_domains"],
  experience: ["employment"],
  skills: ["it_skills", "projects", "accomplishments"],
  education: ["education"],
  preferences: ["preferred_locations", "department_role", "industry", "private_contact"],
  additional: ["professional_links", "gender", "more_information", "marital_status", "date_of_birth", "category", "usa_work_authorization", "other_work_permits", "permanent_address", "hometown", "pincode", "languages", "disability_status", "disability_details", "military_experience", "career_break"],
};

const inputClass = "min-h-11 w-full rounded-xl border border-line bg-white px-3 text-sm text-ink outline-none transition focus:border-indigo/50 focus:ring-2 focus:ring-indigo/10";
const textareaClass = `${inputClass} min-h-24 resize-y py-3`;
const labelClass = "grid gap-1.5 text-sm font-semibold text-navy";

function text(details: Details, key: string): string {
  const value = details[key];
  return typeof value === "string" ? value : "";
}

function bool(details: Details, key: string): boolean {
  return details[key] === true;
}

function records(details: Details, key: string): Record<string, unknown>[] {
  const value = details[key];
  return Array.isArray(value) ? value.filter((item): item is Record<string, unknown> => Boolean(item) && typeof item === "object") : [];
}

function Section({ id, eyebrow, title, description, children }: { id?: string; eyebrow: string; title: string; description?: string; children: ReactNode }) {
  return (
    <section id={id} className="scroll-mt-24 rounded-[1.5rem] border border-line/80 bg-white p-5 shadow-sm sm:p-6">
      <div className="mb-5">
        <p className="text-[11px] font-extrabold uppercase tracking-[0.16em] text-indigo">{eyebrow}</p>
        <h2 className="mt-1 text-xl font-bold tracking-[-0.025em] text-navy">{title}</h2>
        {description && <p className="mt-1 text-xs leading-5 text-ink-muted">{description}</p>}
      </div>
      {children}
    </section>
  );
}

function Choice({ name, value, label, defaultChecked = false, type = "radio" }: { name: string; value: string; label: string; defaultChecked?: boolean; type?: "radio" | "checkbox" }) {
  return (
    <label className="cursor-pointer">
      <input className="peer sr-only" type={type} name={name} value={value} defaultChecked={defaultChecked} />
      <span className="inline-flex min-h-9 items-center rounded-full border border-line bg-white px-3 text-xs font-semibold text-ink-muted transition peer-checked:border-indigo peer-checked:bg-indigo-soft peer-checked:text-indigo peer-focus-visible:ring-2 peer-focus-visible:ring-indigo/30">
        {label}
      </span>
    </label>
  );
}

export function ProfileForm({ profile, extended, onSaved, guided = false, section }: ProfileFormProps) {
  const router = useRouter();
  const formRef = useRef<HTMLFormElement>(null);
  const saveTimer = useRef<number | null>(null);
  const savingRef = useRef(false);
  const changedWhileSaving = useRef(false);
  const initial = extended.details ?? {};
  const initialEmployment = records(initial, "employment");
  const initialSkills = records(initial, "it_skills");
  const initialEducation = records(initial, "education");
  const initialLanguages = records(initial, "languages");

  const [current, setCurrent] = useState(profile);
  const [message, setMessage] = useState("");
  const [pending, setPending] = useState(false);
  const [dirty, setDirty] = useState(false);
  const [employmentCount, setEmploymentCount] = useState(Math.max(1, initialEmployment.length));
  const [skillCount, setSkillCount] = useState(Math.max(1, initialSkills.length));
  const [educationCount, setEducationCount] = useState(Math.max(1, initialEducation.length));
  const [languageCount, setLanguageCount] = useState(Math.max(1, initialLanguages.length));
  const savedStep = Number(initial.onboarding_step);
  const [step, setStep] = useState(guided && Number.isInteger(savedStep) && savedStep >= 1 && savedStep <= 5 ? savedStep : 1);

  useEffect(() => () => {
    if (saveTimer.current != null) window.clearTimeout(saveTimer.current);
  }, []);

  function queueAutosave() {
    changedWhileSaving.current = true;
    setDirty(true);
    setMessage("Unsaved changes");
    if (section) return;
    if (saveTimer.current != null) window.clearTimeout(saveTimer.current);
    if (savingRef.current) return;
    saveTimer.current = window.setTimeout(() => formRef.current?.requestSubmit(), 1200);
  }

  function recValue(items: Record<string, unknown>[], index: number, key: string): string {
    const value = items[index]?.[key];
    return typeof value === "string" || typeof value === "number" ? String(value) : "";
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (saveTimer.current != null) window.clearTimeout(saveTimer.current);
    if (savingRef.current) return;
    savingRef.current = true;
    setPending(true);
    changedWhileSaving.current = false;
    setMessage("Saving your changes…");
    const data = new FormData(event.currentTarget);
    const submitter = (event.nativeEvent as SubmitEvent).submitter;
    const nextStep = guided && submitter instanceof HTMLButtonElement && submitter.hasAttribute("data-save-and-next") ? Math.min(5, step + 1) : step;
    const noticeValue = String(data.get("notice_period_days") ?? "").trim();

    const corePayload = {
      full_name: data.get("full_name"),
      headline: data.get("headline"),
      current_city: data.get("current_city"),
      current_state: data.get("current_state"),
      country_code: data.get("country_code"),
      total_experience_months: Number(data.get("total_experience_months") ?? 0),
      notice_period_days: noticeValue === "" ? null : Number(noticeValue),
    };

    const collect = (prefix: string, count: number, fields: string[]) =>
      Array.from({ length: count }, (_, index) => {
        const entry: Record<string, string> = {};
        for (const field of fields) entry[field] = String(data.get(`${prefix}_${index}_${field}`) ?? "").trim();
        return entry;
      }).filter((entry) => Object.values(entry).some(Boolean));

    const details: Details = {
      current_designation: String(data.get("current_designation") ?? ""),
      professional_summary: String(data.get("professional_summary") ?? ""),
      employment_highlights: String(data.get("employment_highlights") ?? ""),
      interested_domains: String(data.get("interested_domains") ?? ""),
      preferred_locations: String(data.get("preferred_locations") ?? ""),
      department_role: String(data.get("department_role") ?? ""),
      industry: String(data.get("industry") ?? ""),
      private_contact: data.get("private_contact") === "on",
      employment: collect("employment", employmentCount, ["company", "job_title", "employment_type", "joining_year", "joining_month", "end_year", "end_month", "current_company", "current_salary", "skills_used", "job_profile"]),
      it_skills: collect("skill", skillCount, ["name", "version", "last_used", "experience_years", "experience_months", "proficiency"]),
      education: collect("education", educationCount, ["level", "university", "specialization", "course_type", "grading_system", "start_year", "end_year"]),
      projects: String(data.get("projects") ?? ""),
      accomplishments: String(data.get("accomplishments") ?? ""),
      professional_links: String(data.get("professional_links") ?? ""),
      gender: String(data.get("gender") ?? ""),
      more_information: data.getAll("more_information").map(String),
      marital_status: String(data.get("marital_status") ?? ""),
      date_of_birth: String(data.get("date_of_birth") ?? ""),
      category: String(data.get("category") ?? ""),
      usa_work_authorization: data.getAll("usa_work_authorization").map(String),
      other_work_permits: String(data.get("other_work_permits") ?? ""),
      permanent_address: String(data.get("permanent_address") ?? ""),
      hometown: String(data.get("hometown") ?? ""),
      pincode: String(data.get("pincode") ?? ""),
      languages: collect("language", languageCount, ["language", "proficiency", "read", "write", "speak"]),
      disability_status: String(data.get("disability_status") ?? ""),
      disability_details: String(data.get("disability_details") ?? ""),
      military_experience: String(data.get("military_experience") ?? ""),
      career_break: String(data.get("career_break") ?? ""),
    };

    const numberOrNull = (name: string) => {
      const value = String(data.get(name) ?? "").trim();
      return value === "" ? null : Number(value);
    };

    try {
      const latest = await apiRequest<CandidateProfileDetails>("/api/v1/candidate/profile/details");
      const liveCore = section ? await apiRequest<CandidateProfile>("/api/v1/candidate/profile") : null;
      const scopedCore = liveCore ? {
        full_name: section === "about" ? corePayload.full_name : liveCore.full_name,
        headline: section === "about" ? corePayload.headline : liveCore.headline ?? "",
        current_city: section === "about" ? corePayload.current_city : liveCore.current_city ?? "",
        current_state: section === "about" ? corePayload.current_state : liveCore.current_state ?? "",
        country_code: section === "about" ? corePayload.country_code : liveCore.country_code,
        total_experience_months: section === "experience" ? corePayload.total_experience_months : liveCore.total_experience_months,
        notice_period_days: section === "preferences" ? corePayload.notice_period_days : liveCore.notice_period_days ?? null,
      } : corePayload;
      const scopedDetails = section
        ? Object.fromEntries(sectionDetailKeys[section].map((key) => [key, details[key]]))
        : details;
      const [updated] = await Promise.all([
        !section || section === "about" || section === "experience" || section === "preferences"
          ? apiRequest<CandidateProfile>("/api/v1/candidate/profile", { method: "PATCH", body: JSON.stringify(scopedCore) })
          : Promise.resolve(liveCore ?? current),
        apiRequest<CandidateProfileDetails>("/api/v1/candidate/profile/details", {
          method: "PATCH",
          body: JSON.stringify({
            details: { ...latest.details, ...scopedDetails, ...(guided ? { onboarding_step: nextStep } : {}) },
            current_salary_amount: !section || section === "preferences" ? numberOrNull("current_salary_amount") : latest.current_salary_amount ?? null,
            current_salary_currency: !section || section === "preferences" ? String(data.get("current_salary_currency") ?? "INR") : latest.current_salary_currency,
            expected_salary_amount: !section || section === "preferences" ? numberOrNull("expected_salary_amount") : latest.expected_salary_amount ?? null,
            expected_salary_currency: !section || section === "preferences" ? String(data.get("expected_salary_currency") ?? "INR") : latest.expected_salary_currency,
          }),
        }),
      ]);
      setCurrent(updated);
      setDirty(changedWhileSaving.current);
      setMessage(changedWhileSaving.current ? "Saving your latest edits…" : "All changes saved.");
      router.refresh();
      if (!changedWhileSaving.current && submitter instanceof HTMLButtonElement) {
        if (submitter.hasAttribute("data-save-and-next")) setStep(nextStep);
        if (submitter.hasAttribute("data-save-and-close")) onSaved?.();
      }
    } catch (cause) {
      setDirty(true);
      setMessage(cause instanceof Error ? "Couldn’t save your changes. Your edits are still here. Try again." : "Couldn’t save your changes. Your edits are still here. Try again.");
    } finally {
      savingRef.current = false;
      setPending(false);
      if (changedWhileSaving.current && !section) {
        saveTimer.current = window.setTimeout(() => formRef.current?.requestSubmit(), 900);
      }
    }
  }

  const selectedMoreInfo = Array.isArray(initial.more_information) ? initial.more_information.map(String) : [];
  const selectedUSA = Array.isArray(initial.usa_work_authorization) ? initial.usa_work_authorization.map(String) : [];

  return (
    <form id="candidate-profile-edit-form" ref={formRef} className="grid gap-5" onSubmit={submit} onChange={queueAutosave}>
      {guided && <nav aria-label="Profile builder steps" className="flex flex-wrap gap-2 rounded-2xl border border-line bg-white p-3">{["About you", "Experience", "Education", "Skills", "Preferences"].map((label, index) => <button type="button" key={label} onClick={() => setStep(index + 1)} aria-current={step === index + 1 ? "step" : undefined} className={`min-h-10 rounded-full px-3 text-xs font-bold ${step === index + 1 ? "bg-indigo text-white" : "bg-canvas text-ink-muted"}`}>{index + 1}. {label}</button>)}</nav>}
      <section hidden={Boolean(section)} className="rounded-[1.5rem] border border-line/80 bg-white p-5 shadow-sm sm:p-6">
        <div className="grid gap-5 lg:grid-cols-[1fr_auto] lg:items-center">
          <div className="flex items-start gap-4">
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-navy text-sm font-bold text-white">
              {current.full_name.split(/\s+/).map((part) => part[0]).slice(0, 2).join("").toUpperCase() || "CP"}
            </div>
            <div>
              <p className="text-[11px] font-extrabold uppercase tracking-[0.16em] text-indigo">Candidate profile</p>
              <h2 className="mt-1 text-xl font-bold text-navy">{current.full_name}</h2>
              <p className="mt-1 text-xs text-ink-muted">{current.headline || "Add your professional headline"}</p>
              <p className="mt-2 text-xs font-semibold text-indigo">{current.profile_completion}% profile completion</p>
            </div>
          </div>
          <div className="flex flex-col items-start gap-2 lg:items-end">
            <span className="text-xs font-semibold text-ink-muted">Visibility is controlled separately in your privacy panel.</span>
            <Link href="#section-resume" className="min-h-10 inline-flex items-center font-semibold text-indigo hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo/40">Manage private resume →</Link>
          </div>
        </div>
      </section>

      {message && <p className="rounded-xl border border-indigo/15 bg-indigo-soft/55 px-4 py-3 text-sm font-semibold text-navy" role="status">{message}</p>}

      <div hidden={section ? section !== "about" : guided && step !== 1}><Section id="section-about" eyebrow="Your story" title="About you" description="Start with your name, current work and location. You can refine the rest later.">
        <div className="grid gap-4 md:grid-cols-2">
          <label className={labelClass}>Full name<input className={inputClass} name="full_name" defaultValue={current.full_name} required /></label>
          <label className={labelClass}>Resume headline<input className={inputClass} name="headline" defaultValue={current.headline ?? ""} placeholder="e.g. Full stack engineer with 5 years of experience" /></label>
          <label className={labelClass}>Current designation<input className={inputClass} name="current_designation" defaultValue={text(initial, "current_designation")} placeholder="e.g. Senior Backend Engineer" /></label>
          <label className={labelClass}>Current city<input className={inputClass} name="current_city" defaultValue={current.current_city ?? ""} placeholder="e.g. Bengaluru" /></label>
          <label className={labelClass}>State<input className={inputClass} name="current_state" defaultValue={current.current_state ?? ""} /></label>
          <label className={labelClass}>Country code<input className={inputClass} name="country_code" maxLength={2} defaultValue={current.country_code} /></label>
          <label className="md:col-span-2 grid gap-1.5 text-sm font-semibold text-navy">Professional summary<textarea className={textareaClass} name="professional_summary" defaultValue={text(initial, "professional_summary")} placeholder="Describe your professional strengths and impact." /></label>
          <label className="md:col-span-2 grid gap-1.5 text-sm font-semibold text-navy">Employment highlights<input className={inputClass} name="employment_highlights" defaultValue={text(initial, "employment_highlights")} placeholder="e.g. Distributed systems, platform modernization, team leadership" /></label>
          <label className="md:col-span-2 grid gap-1.5 text-sm font-semibold text-navy">Interested domains<input className={inputClass} name="interested_domains" defaultValue={text(initial, "interested_domains")} placeholder="Technology, IT Services, Manufacturing & Production, Healthcare..." /></label>
        </div>
      </Section></div>

      <div hidden={section ? section !== "preferences" : guided && step !== 5}><Section id="section-preferences" eyebrow="Location & preferences" title="Work preferences" description="Choose what helps you find relevant opportunities. Compensation details remain private to recruiter profile APIs.">
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          <label className={labelClass}>Current salary<input className={inputClass} type="number" min={0} step="0.01" name="current_salary_amount" defaultValue={extended.current_salary_amount ?? ""} /></label>
          <label className={labelClass}>Current salary currency<select className={inputClass} name="current_salary_currency" defaultValue={extended.current_salary_currency || "INR"}><option>INR</option><option>USD</option><option>EUR</option><option>GBP</option></select></label>
          <label className={labelClass}>Expected salary<input className={inputClass} type="number" min={0} step="0.01" name="expected_salary_amount" defaultValue={extended.expected_salary_amount ?? ""} /></label>
          <label className={labelClass}>Expected salary currency<select className={inputClass} name="expected_salary_currency" defaultValue={extended.expected_salary_currency || "INR"}><option>INR</option><option>USD</option><option>EUR</option><option>GBP</option></select></label>
          <label className={labelClass}>Notice period (days)<input className={inputClass} type="number" min={0} name="notice_period_days" defaultValue={current.notice_period_days ?? ""} /></label>
          <label className={labelClass}>Preferred locations<input className={inputClass} name="preferred_locations" defaultValue={text(initial, "preferred_locations")} placeholder="e.g. Bengaluru, Pune, Remote" /></label>
          <label className={labelClass}>Department and role<input className={inputClass} name="department_role" defaultValue={text(initial, "department_role")} placeholder="e.g. Engineering / Platform" /></label>
          <label className={labelClass}>Industry<input className={inputClass} name="industry" defaultValue={text(initial, "industry")} placeholder="e.g. Software products" /></label>
          <label className="md:col-span-2 lg:col-span-4 flex items-center gap-2 rounded-xl bg-indigo-soft/40 p-3 text-xs font-semibold text-ink-muted"><input name="private_contact" type="checkbox" defaultChecked={bool(initial, "private_contact")} /> Keep my phone private even from recruiters at companies where I applied. This overrides the phone-sharing setting.</label>
        </div>
      </Section></div>

      <div hidden={section ? section !== "experience" : guided && step !== 2}><Section id="section-experience" eyebrow="Experience" title="Work history" description="Add roles in reverse chronological order. Freshers can leave this blank.">
        <div className="grid gap-4">
          <label className={labelClass}>Total experience (months)<input className={inputClass} type="number" min={0} name="total_experience_months" defaultValue={current.total_experience_months} /></label>
          {Array.from({ length: employmentCount }, (_, index) => (
            <div key={index} className="rounded-2xl border border-line bg-canvas/45 p-4">
              <div className="mb-4 flex items-center justify-between"><h3 className="font-bold text-navy">Employment {index + 1}</h3>{employmentCount > 1 && <button type="button" onClick={() => setEmploymentCount((count) => Math.max(1, count - 1))} className="text-xs font-bold text-ink-muted hover:text-indigo">Remove last employment</button>}</div>
              <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                <label className={labelClass}>Company name<input className={inputClass} name={`employment_${index}_company`} defaultValue={recValue(initialEmployment, index, "company")} /></label>
                <label className={labelClass}>Job title<input className={inputClass} name={`employment_${index}_job_title`} defaultValue={recValue(initialEmployment, index, "job_title")} /></label>
                <label className={labelClass}>Employment type<select className={inputClass} name={`employment_${index}_employment_type`} defaultValue={recValue(initialEmployment, index, "employment_type")}><option value="">Select</option><option>Full time</option><option>Part time</option><option>Contract</option><option>Internship</option><option>Temporary</option></select></label>
                <label className={labelClass}>Joining year<input className={inputClass} name={`employment_${index}_joining_year`} defaultValue={recValue(initialEmployment, index, "joining_year")} /></label>
                <label className={labelClass}>Joining month<input className={inputClass} name={`employment_${index}_joining_month`} defaultValue={recValue(initialEmployment, index, "joining_month")} /></label>
                <label className={labelClass}>End year<input className={inputClass} name={`employment_${index}_end_year`} defaultValue={recValue(initialEmployment, index, "end_year")} placeholder="Leave blank if current" /></label>
                <label className={labelClass}>End month<input className={inputClass} name={`employment_${index}_end_month`} defaultValue={recValue(initialEmployment, index, "end_month")} placeholder="Leave blank if current" /></label>
                <label className={labelClass}>Current company?<select className={inputClass} name={`employment_${index}_current_company`} defaultValue={recValue(initialEmployment, index, "current_company")}><option value="">Select</option><option>Yes</option><option>No</option></select></label>
                <label className={labelClass}>Current salary<input className={inputClass} name={`employment_${index}_current_salary`} defaultValue={recValue(initialEmployment, index, "current_salary")} /></label>
                <label className="md:col-span-2 grid gap-1.5 text-sm font-semibold text-navy">Skills used<input className={inputClass} name={`employment_${index}_skills_used`} defaultValue={recValue(initialEmployment, index, "skills_used")} placeholder="e.g. Java, AWS" /></label>
                <label className="md:col-span-2 lg:col-span-3 grid gap-1.5 text-sm font-semibold text-navy">Job profile, description and role<textarea className={textareaClass} name={`employment_${index}_job_profile`} defaultValue={recValue(initialEmployment, index, "job_profile")} /></label>
              </div>
            </div>
          ))}
          <button type="button" onClick={() => setEmploymentCount((count) => count + 1)} className="justify-self-end rounded-full border border-indigo/25 px-4 py-2 text-xs font-bold text-indigo hover:bg-indigo-soft">+ Employment</button>
        </div>
      </Section></div>

      <div hidden={section ? section !== "skills" : guided && step !== 4}><Section id="section-skills" eyebrow="Skills" title="Skills & competencies" description="Add professional competencies, tools, technologies, equipment or credentials relevant to your work.">
        <div className="grid gap-4">
          {Array.from({ length: skillCount }, (_, index) => (
            <div key={index} className="grid gap-4 rounded-2xl border border-line bg-canvas/45 p-4 md:grid-cols-2 lg:grid-cols-6">
              <label className={`${labelClass} lg:col-span-2`}>Skill / competency<TaxonomyInput className={inputClass} name={`skill_${index}_name`} defaultValue={recValue(initialSkills, index, "name")} placeholder="e.g. Critical Care Nursing, Negotiation, PostgreSQL" ariaLabel={`Skill or competency ${index + 1}`} /></label>
              <label className={labelClass}>Version / level (optional)<input className={inputClass} name={`skill_${index}_version`} defaultValue={recValue(initialSkills, index, "version")} /></label>
              <label className={labelClass}>Last used<input className={inputClass} name={`skill_${index}_last_used`} defaultValue={recValue(initialSkills, index, "last_used")} placeholder="Year" /></label>
              <label className={labelClass}>Experience years<input className={inputClass} name={`skill_${index}_experience_years`} defaultValue={recValue(initialSkills, index, "experience_years")} /></label>
              <label className={labelClass}>Experience months<input className={inputClass} name={`skill_${index}_experience_months`} defaultValue={recValue(initialSkills, index, "experience_months")} /></label>
              <label className={labelClass}>Proficiency<select className={inputClass} name={`skill_${index}_proficiency`} defaultValue={recValue(initialSkills, index, "proficiency")}><option value="">Select</option><option>1 / 5</option><option>2 / 5</option><option>3 / 5</option><option>4 / 5</option><option>5 / 5</option></select></label>
            </div>
          ))}
          <button type="button" onClick={() => setSkillCount((count) => count + 1)} className="justify-self-end rounded-full border border-indigo/25 px-4 py-2 text-xs font-bold text-indigo hover:bg-indigo-soft">+ Skill / competency</button>
        </div>
      </Section></div>

      <div hidden={section ? section !== "education" : guided && step !== 3}><Section id="section-education" eyebrow="Education" title="Academic details" description="Record school, degree and higher education details that support your profile.">
        <div className="grid gap-4">
          {Array.from({ length: educationCount }, (_, index) => (
            <div key={index} className="grid gap-4 rounded-2xl border border-line bg-canvas/45 p-4 md:grid-cols-2 lg:grid-cols-3">
              <label className={labelClass}>Education level<input className={inputClass} name={`education_${index}_level`} defaultValue={recValue(initialEducation, index, "level")} placeholder="e.g. Graduation" /></label>
              <label className={labelClass}>University / institute<input className={inputClass} name={`education_${index}_university`} defaultValue={recValue(initialEducation, index, "university")} /></label>
              <label className={labelClass}>Specialization<input className={inputClass} name={`education_${index}_specialization`} defaultValue={recValue(initialEducation, index, "specialization")} /></label>
              <label className={labelClass}>Course type<select className={inputClass} name={`education_${index}_course_type`} defaultValue={recValue(initialEducation, index, "course_type")}><option value="">Select</option><option>Full time</option><option>Part time</option><option>Distance</option></select></label>
              <label className={labelClass}>Grading system<input className={inputClass} name={`education_${index}_grading_system`} defaultValue={recValue(initialEducation, index, "grading_system")} placeholder="CGPA, percentage or grade" /></label>
              <label className={labelClass}>Start year<input className={inputClass} name={`education_${index}_start_year`} defaultValue={recValue(initialEducation, index, "start_year")} /></label>
              <label className={labelClass}>End year<input className={inputClass} name={`education_${index}_end_year`} defaultValue={recValue(initialEducation, index, "end_year")} /></label>
            </div>
          ))}
          <button type="button" onClick={() => setEducationCount((count) => count + 1)} className="justify-self-end rounded-full border border-indigo/25 px-4 py-2 text-xs font-bold text-indigo hover:bg-indigo-soft">+ Education</button>
        </div>
      </Section></div>

      <div hidden={section ? section !== "skills" : guided && step !== 4}><Section id="section-projects" eyebrow="Projects & achievements" title="Work beyond the role" description="Add projects, publications, patents and other credentials that demonstrate your work.">
        <div className="grid gap-4">
          <label className={labelClass}>Projects<textarea className={textareaClass} name="projects" defaultValue={text(initial, "projects")} placeholder="Describe relevant projects, your role and outcomes." /></label>
          <label className={labelClass}>Accomplishments and links<textarea className={textareaClass} name="accomplishments" defaultValue={text(initial, "accomplishments")} placeholder="Certifications, publications, patents, awards and links." /></label>
        </div>
      </Section></div>

      <div hidden={section ? section !== "additional" : guided && step !== 4}><Section id="section-links" eyebrow="Professional links" title="Your work online" description="Add a portfolio or other professional pages when they help tell your story.">
        <label className={labelClass}>Additional professional links<textarea className={textareaClass} name="professional_links" defaultValue={text(initial, "professional_links")} placeholder="https://github.com/you\nhttps://portfolio.example" /></label>
      </Section></div>

      <div hidden={section ? section !== "additional" : guided && step !== 5}><Section eyebrow="Optional details" title="Personal information" description="These details are optional and are excluded from recruiter-facing profile responses. You can leave any field blank.">
        <div className="grid gap-5">
          <div><p className="mb-2 text-sm font-semibold text-navy">Gender</p><div className="flex flex-wrap gap-2">{["Male", "Female", "Transgender", "Non-binary", "Prefer not to say"].map((value) => <Choice key={value} name="gender" value={value} label={value} defaultChecked={text(initial, "gender") === value} />)}</div></div>
          <div><p className="mb-2 text-sm font-semibold text-navy">More information</p><div className="flex flex-wrap gap-2">{["Single parent", "Working mother", "Retired (Ex)", "LGBTQ+"].map((value) => <Choice key={value} type="checkbox" name="more_information" value={value} label={value} defaultChecked={selectedMoreInfo.includes(value)} />)}</div></div>
          <div><p className="mb-2 text-sm font-semibold text-navy">Marital status</p><div className="flex flex-wrap gap-2">{["Single/unmarried", "Married", "Widowed", "Divorced", "Separated", "Other"].map((value) => <Choice key={value} name="marital_status" value={value} label={value} defaultChecked={text(initial, "marital_status") === value} />)}</div></div>
          <div className="grid gap-4 md:grid-cols-3"><label className={labelClass}>Date of birth<input className={inputClass} type="date" name="date_of_birth" defaultValue={text(initial, "date_of_birth")} /></label><label className={labelClass}>Category<select className={inputClass} name="category" defaultValue={text(initial, "category")}><option value="">Select</option><option>General</option><option>Scheduled caste (SC)</option><option>Scheduled tribe (ST)</option><option>OBC - Creamy</option><option>OBC - Non creamy</option><option>Other</option></select></label></div>
          <div><p className="mb-2 text-sm font-semibold text-navy">Work permit for USA</p><div className="flex flex-wrap gap-2">{["Have US H1 Visa", "Need US H1 Visa", "US TN Permit holder", "US Green Card holder", "US Citizen", "Authorized to work in US"].map((value) => <Choice key={value} type="checkbox" name="usa_work_authorization" value={value} label={value} defaultChecked={selectedUSA.includes(value)} />)}</div></div>
          <div className="grid gap-4 md:grid-cols-2"><label className={labelClass}>Work permit for other countries<input className={inputClass} name="other_work_permits" defaultValue={text(initial, "other_work_permits")} placeholder="e.g. Canada, Germany" /></label><label className={labelClass}>Permanent address<input className={inputClass} name="permanent_address" defaultValue={text(initial, "permanent_address")} /></label><label className={labelClass}>Hometown<input className={inputClass} name="hometown" defaultValue={text(initial, "hometown")} /></label><label className={labelClass}>Pincode<input className={inputClass} name="pincode" defaultValue={text(initial, "pincode")} /></label></div>
        </div>
      </Section></div>

      <div hidden={section ? section !== "additional" : guided && step !== 5}><Section id="section-languages" eyebrow="Languages" title="How you communicate" description="List the languages you can use comfortably and the ways you use them.">
        <div className="grid gap-4">
          {Array.from({ length: languageCount }, (_, index) => (
            <div key={index} className="grid gap-4 rounded-2xl border border-line bg-canvas/45 p-4 md:grid-cols-2 lg:grid-cols-5">
              <label className={`${labelClass} lg:col-span-2`}>Language<input className={inputClass} name={`language_${index}_language`} defaultValue={recValue(initialLanguages, index, "language")} placeholder="English" /></label>
              <label className={`${labelClass} lg:col-span-2`}>Proficiency<select className={inputClass} name={`language_${index}_proficiency`} defaultValue={recValue(initialLanguages, index, "proficiency")}><option value="">Select</option><option>Beginner</option><option>Intermediate</option><option>Proficient</option><option>Native / bilingual</option></select></label>
              <div className="flex flex-wrap items-end gap-3 pb-2 text-xs font-semibold text-ink-muted"><label><input type="checkbox" name={`language_${index}_read`} value="Yes" defaultChecked={recValue(initialLanguages, index, "read") === "Yes"} /> Read</label><label><input type="checkbox" name={`language_${index}_write`} value="Yes" defaultChecked={recValue(initialLanguages, index, "write") === "Yes"} /> Write</label><label><input type="checkbox" name={`language_${index}_speak`} value="Yes" defaultChecked={recValue(initialLanguages, index, "speak") === "Yes"} /> Speak</label></div>
            </div>
          ))}
          <button type="button" onClick={() => setLanguageCount((count) => count + 1)} className="justify-self-end rounded-full border border-indigo/25 px-4 py-2 text-xs font-bold text-indigo hover:bg-indigo-soft">+ Language</button>
        </div>
      </Section></div>

      <div hidden={section ? section !== "additional" : guided && step !== 5}><Section eyebrow="Optional information" title="Accessibility & career context" description="Optional information to help you describe your needs and career context. You decide whether to provide it.">
        <div className="grid gap-4 md:grid-cols-2">
          <label className={labelClass}>Disability status<select className={inputClass} name="disability_status" defaultValue={text(initial, "disability_status")}><option value="">Select</option><option>Prefer not to say</option><option>No disability</option><option>Person with disability</option></select></label>
          <label className={labelClass}>Disability details<input className={inputClass} name="disability_details" defaultValue={text(initial, "disability_details")} placeholder="Optional details" /></label>
          <label className={labelClass}>Military experience<input className={inputClass} name="military_experience" defaultValue={text(initial, "military_experience")} placeholder="Add military experience" /></label>
          <label className={labelClass}>Career break<input className={inputClass} name="career_break" defaultValue={text(initial, "career_break")} placeholder="Add career break details" /></label>
        </div>
      </Section></div>

      <div className="sticky bottom-4 z-20 flex items-center justify-between gap-4 rounded-2xl border border-line bg-white/95 p-3 shadow-card backdrop-blur">
        <p className="text-xs text-ink-muted" role="status" aria-live="polite">{pending ? "Saving…" : dirty ? message : message || (section ? "Save this section when you’re ready." : "Changes save automatically as you edit.")}</p>
        <div className="flex items-center gap-2">{guided && step > 1 && <button type="button" onClick={() => setStep((currentStep) => currentStep - 1)} className="min-h-11 rounded-xl border border-line px-4 text-sm font-bold text-navy">Back</button>}
          <Button type="submit" size="lg" disabled={pending} {...(guided && step < 5 ? { "data-save-and-next": true } : { "data-save-and-close": true })}>{pending ? "Saving…" : guided && step < 5 ? "Save & continue" : guided ? "Save & review" : section ? "Save section" : "Save & finish"}</Button></div>
      </div>
    </form>
  );
}
