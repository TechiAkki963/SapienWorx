"use client";

import Link from "next/link";
import type { ReactNode } from "react";
import { useState } from "react";

import { CandidateProfile, CandidateProfileDetails } from "@/lib/candidate";
import type { ProfileFormSection } from "@/components/candidate/profile-form";

type RecordValue = Record<string, unknown>;

function text(details: RecordValue, key: string) {
  const value = details[key];
  return typeof value === "string" ? value.trim() : "";
}

function list(details: RecordValue, key: string): RecordValue[] {
  const value = details[key];
  return Array.isArray(value)
    ? value.filter((item): item is RecordValue => Boolean(item && typeof item === "object" && !Array.isArray(item)))
    : [];
}

function field(item: RecordValue, key: string) {
  const value = item[key];
  return value == null ? "" : String(value).trim();
}

function Section({ id, title, hint, active, onEdit, children }: { id: string; title: string; hint: string; active: boolean; onEdit: () => void; children: ReactNode }) {
  return (
    <section id={id} className={`${active ? "block" : "hidden md:block"} scroll-mt-24 rounded-2xl border border-line/80 bg-white p-5 shadow-sm sm:p-6`}>
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-line/70 pb-3">
        <h2 className="font-serif text-xl font-semibold tracking-[-0.02em] text-navy">{title}</h2>
        <div className="flex items-center gap-3"><span className="hidden text-xs text-ink-muted sm:inline">{hint}</span><button type="button" onClick={onEdit} className="min-h-10 rounded-full border border-indigo/20 bg-white px-3 text-xs font-bold text-indigo transition hover:bg-indigo-soft/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo/40" aria-label={`Edit ${title}`}>Edit</button></div>
      </div>
      <div className="pt-4">{children}</div>
    </section>
  );
}

function Empty({ children, edit }: { children: string; edit: () => void }) {
  return <div className="rounded-xl bg-canvas/65 px-4 py-5 text-sm leading-6 text-ink-muted">
    <p>{children}</p>
    <button type="button" onClick={edit} className="mt-3 inline-flex min-h-10 items-center font-bold text-indigo hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo/40">Add to your profile →</button>
  </div>;
}

export function CandidateProfileSections({ profile, extended, onEdit }: { profile: CandidateProfile; extended: CandidateProfileDetails; onEdit: (section: ProfileFormSection) => void }) {
  const [active, setActive] = useState<ProfileFormSection>("about");
  const details = extended.details ?? {};
  const employment = list(details, "employment").filter((item) => field(item, "company") || field(item, "job_title"));
  const skills = list(details, "it_skills").filter((item) => field(item, "name"));
  const education = list(details, "education").filter((item) => field(item, "level") || field(item, "university") || field(item, "education"));
  const summary = text(details, "professional_summary");
  const projectText = text(details, "projects");
  const accomplishmentText = text(details, "accomplishments");
  const links = text(details, "professional_links").split(/[\n,]+/).map((item) => item.trim()).filter(Boolean);
  const languages = list(details, "languages").filter((item) => field(item, "language"));
  const privateFacts = ([
    ["Gender", text(details, "gender")], ["Marital status", text(details, "marital_status")],
    ["Date of birth", text(details, "date_of_birth")], ["Category", text(details, "category")],
    ["Work permits", text(details, "other_work_permits")], ["Career break", text(details, "career_break")],
    ["Accessibility context", text(details, "disability_details")], ["Military experience", text(details, "military_experience")],
  ] as const).filter(([, value]) => value);

  return (
    <div className="grid gap-4">
      <nav aria-label="Profile sections" className="-mx-1 flex gap-2 overflow-x-auto px-1 pb-1 md:hidden">
        {(["about", "experience", "skills", "education", "preferences", "additional"] as const).map((section) => <button key={section} type="button" aria-current={active === section ? "page" : undefined} onClick={() => setActive(section)} className={`min-h-10 shrink-0 rounded-full border px-3 text-xs font-bold ${active === section ? "border-indigo bg-indigo text-white" : "border-line bg-white text-navy"}`}>{({ about: "About", experience: "Experience", skills: "Skills", education: "Education", preferences: "Preferences", additional: "More" })[section]}</button>)}
      </nav>
      <Section id="section-about" title="About Me" hint="Your story, in your words" active={active === "about"} onEdit={() => onEdit("about")}>
        {summary || text(details, "current_designation") || profile.headline ? (
          <div className="space-y-3">
            {text(details, "current_designation") && <p className="font-semibold text-navy">{text(details, "current_designation")}</p>}
            {profile.headline && profile.headline !== text(details, "current_designation") && <p className="text-sm font-medium text-ink-muted">{profile.headline}</p>}
            {summary && <p className="whitespace-pre-line text-sm leading-7 text-ink-muted">{summary}</p>}
            {text(details, "employment_highlights") && <p className="text-sm leading-6 text-ink-muted">{text(details, "employment_highlights")}</p>}
            {text(details, "interested_domains") && <p className="text-sm"><span className="font-semibold text-navy">Areas of interest:</span> <span className="text-ink-muted">{text(details, "interested_domains")}</span></p>}
          </div>
        ) : <Empty edit={() => onEdit("about")}>Add a short introduction so people can understand your strengths and the work you’re looking for.</Empty>}
      </Section>

      <Section id="section-experience" title="Work Experience" hint="Your career, in context" active={active === "experience"} onEdit={() => onEdit("experience")}>
        <p className="mb-4 text-xs font-semibold text-ink-muted">Total experience: {profile.total_experience_months} month{profile.total_experience_months === 1 ? "" : "s"}</p>
        {employment.length ? <div className="relative ml-2 grid gap-5 border-l border-indigo/20 pl-5">
          {employment.map((item, index) => {
            const current = field(item, "current_company").toLowerCase() === "yes";
            const dates = [field(item, "joining_month"), field(item, "joining_year")].filter(Boolean).join(" ");
            const end = current ? "Present" : [field(item, "end_month"), field(item, "end_year")].filter(Boolean).join(" ");
            const skillsUsed = field(item, "skills_used");
            return <article key={`${field(item, "company")}-${index}`} className="relative">
              <span aria-hidden="true" className="absolute -left-[1.63rem] top-1.5 h-3 w-3 rounded-full border-2 border-white bg-indigo shadow-[0_0_0_1px_rgba(79,70,229,.28)]" />
              <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
                <h3 className="font-bold text-navy">{field(item, "job_title") || "Role"}</h3>
                <span className="text-xs font-medium text-ink-muted">{[dates, end].filter(Boolean).join(" — ") || "Dates not added"}</span>
              </div>
              <p className="mt-1 text-sm text-ink-muted">{field(item, "company")}{field(item, "employment_type") ? ` · ${field(item, "employment_type")}` : ""}</p>
              {field(item, "job_profile") && <p className="mt-3 whitespace-pre-line text-sm leading-6 text-ink-muted">{field(item, "job_profile")}</p>}
              {skillsUsed && <p className="mt-3 text-xs leading-5 text-ink-muted"><span className="font-semibold text-navy">Skills used:</span> {skillsUsed}</p>}
            </article>;
          })}
        </div> : <Empty edit={() => onEdit("experience")}>Add recent roles and achievements to show where you’ve built your expertise.</Empty>}
      </Section>

      <Section id="section-skills" title="Skills & Expertise" hint="What you bring to the work" active={active === "skills"} onEdit={() => onEdit("skills")}>
        {skills.length ? <div className="flex flex-wrap gap-2">
          {skills.map((item, index) => {
            const name = field(item, "name");
            const experience = [field(item, "experience_years") && `${field(item, "experience_years")} yr`, field(item, "experience_months") && `${field(item, "experience_months")} mo`].filter(Boolean).join(" ");
            const evidence = employment.find((role) => field(role, "skills_used").toLowerCase().includes(name.toLowerCase()));
            return <div key={`${name}-${index}`} className="max-w-full rounded-xl border border-indigo/10 bg-indigo-soft/35 px-3 py-2.5">
              <p className="break-words text-sm font-bold text-navy">{name}</p>
              <p className="mt-0.5 text-[11px] text-ink-muted">{[field(item, "proficiency") && `Level ${field(item, "proficiency")}`, experience].filter(Boolean).join(" · ") || "Experience details not added"}</p>
              {evidence && <p className="mt-1 text-[11px] text-indigo">Used at {field(evidence, "company")}</p>}
            </div>;
          })}
        </div> : <Empty edit={() => onEdit("skills")}>Add the skills you use most. You can include experience level and connect them to roles.</Empty>}
        {(projectText || accomplishmentText) && <details id="section-projects" className="mt-4 rounded-xl border border-line bg-canvas/45 p-4"><summary className="cursor-pointer text-sm font-bold text-navy">Projects & accomplishments</summary><div className="mt-3 space-y-3 text-sm leading-6 text-ink-muted">{projectText && <p className="whitespace-pre-line">{projectText}</p>}{accomplishmentText && <p className="whitespace-pre-line">{accomplishmentText}</p>}</div></details>}
      </Section>

      <Section id="section-education" title="Education" hint="Learning and qualifications" active={active === "education"} onEdit={() => onEdit("education")}>
        {education.length ? <div className="grid gap-3 sm:grid-cols-2">
          {education.map((item, index) => <article key={`${field(item, "university")}-${index}`} className="rounded-xl bg-canvas/65 p-4">
            <h3 className="font-bold text-navy">{field(item, "level") || field(item, "education") || "Education"}{field(item, "specialization") ? ` · ${field(item, "specialization")}` : ""}</h3>
            {field(item, "university") && <p className="mt-1 text-sm text-ink-muted">{field(item, "university")}</p>}
            {(field(item, "start_year") || field(item, "end_year")) && <p className="mt-2 text-xs text-ink-muted">{[field(item, "start_year"), field(item, "end_year")].filter(Boolean).join(" — ")}</p>}
          </article>)}
        </div> : <Empty edit={() => onEdit("education")}>Add education or training that supports your professional story.</Empty>}
      </Section>

      <Section id="section-preferences" title="Career Preferences" hint="The next move, on your terms" active={active === "preferences"} onEdit={() => onEdit("preferences")}>
        <dl className="grid gap-4 text-sm sm:grid-cols-2">
          <div><dt className="font-semibold text-navy">Preferred locations</dt><dd className="mt-1 text-ink-muted">{text(details, "preferred_locations") || "Not added yet"}</dd></div>
          <div><dt className="font-semibold text-navy">Notice period</dt><dd className="mt-1 text-ink-muted">{profile.notice_period_days == null ? "Not added yet" : `${profile.notice_period_days} days`}</dd></div>
          <div><dt className="font-semibold text-navy">Department & role</dt><dd className="mt-1 text-ink-muted">{text(details, "department_role") || "Not added yet"}</dd></div>
          <div><dt className="font-semibold text-navy">Industry</dt><dd className="mt-1 text-ink-muted">{text(details, "industry") || "Not added yet"}</dd></div>
        </dl>
        {(extended.current_salary_amount != null || extended.expected_salary_amount != null) && <details className="mt-4 rounded-xl border border-line bg-canvas/50 p-4"><summary className="cursor-pointer text-sm font-bold text-navy">Private compensation preferences</summary><p className="mt-2 text-xs leading-5 text-ink-muted">Current: {extended.current_salary_amount ?? "Not added"} {extended.current_salary_currency}. Expected: {extended.expected_salary_amount ?? "Not added"} {extended.expected_salary_currency}. These values are not on your shareable profile.</p></details>}
      </Section>

      <Section id="section-additional" title="Additional Information" hint="More context when you want it" active={active === "additional"} onEdit={() => onEdit("additional")}>
        {links.length > 0 && <><h3 id="section-links" className="text-sm font-bold text-navy">Professional links</h3><ul className="mt-3 flex flex-wrap gap-2">
          {links.map((value, index) => {
            let safeURL: string | null = null;
            try {
              const parsed = new URL(value);
              if (parsed.protocol === "https:" && !parsed.username && !parsed.password) safeURL = parsed.toString();
            } catch { /* Display invalid entries as plain text for the owner to correct. */ }
            return <li key={`${value}-${index}`} className="max-w-full break-all rounded-full border border-line bg-white px-3 py-2 text-xs font-semibold text-indigo">
              {safeURL ? <Link href={safeURL} target="_blank" rel="noopener noreferrer">{safeURL.replace(/^https:\/\//, "")}</Link> : value}
            </li>;
          })}
        </ul></>}
        {languages.length > 0 && <div className="mt-5"><h3 className="text-sm font-bold text-navy">Languages</h3><p className="mt-2 text-sm text-ink-muted">{languages.map((item) => [field(item, "language"), field(item, "proficiency")].filter(Boolean).join(" · ")).join(", ")}</p></div>}
        {privateFacts.length > 0 && <details className="mt-5 rounded-xl border border-line bg-canvas/45 p-4"><summary className="cursor-pointer text-sm font-bold text-navy">Optional personal details — visible only to you</summary><dl className="mt-3 grid gap-3 text-xs sm:grid-cols-2">{privateFacts.map(([label, value]) => <div key={label}><dt className="font-semibold text-navy">{label}</dt><dd className="mt-0.5 text-ink-muted">{value}</dd></div>)}</dl></details>}
        {!links.length && !languages.length && !privateFacts.length && <Empty edit={() => onEdit("additional")}>Add languages or professional links when they help tell your story. Personal details remain optional.</Empty>}
      </Section>

      <p className="px-1 text-xs leading-5 text-ink-muted">Your profile is separate from your public share page. Recruiter access to application details remains governed by SapienWorx permissions.</p>
    </div>
  );
}
