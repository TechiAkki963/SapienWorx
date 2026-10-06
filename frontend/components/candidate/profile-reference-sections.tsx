"use client";
import type { ReactNode } from "react";
import type {
  CandidateProfile,
  CandidateProfileDetails,
  ProfessionalRecord,
} from "@/lib/candidate";
import { Pencil, ProfileSectionCard } from "./candidate-profile-sections";
import {
  ProfessionalContentView,
  SafeProfessionalLink,
} from "./professional-content";
import {
  accomplishmentSections,
  type AccomplishmentSection,
} from "./profile-reference-schema";
import type {
  ProfileEditTarget,
  ProfileSection,
} from "./profile-domain-fields";
import { experienceText } from "@/lib/profile-validation";
export const profileQuickLinks = [
  ["resume", "Resume"],
  ["headline", "Resume headline"],
  ["keyskills", "Key skills"],
  ["experience", "Employment"],
  ["education", "Education"],
  ["skills", "IT skills"],
  ["projects", "Projects"],
  ["about", "Profile summary"],
  ["accomplishments", "Accomplishments"],
  ["preferences", "Career profile"],
  ["personal", "Personal details"],
] as const;
export function ReferenceProfileSections({
  profile,
  extended,
  onEdit,
  editing,
  resume,
}: {
  profile: CandidateProfile;
  extended: CandidateProfileDetails;
  onEdit: (target: ProfileEditTarget) => void;
  editing: boolean;
  resume: ReactNode;
}) {
  const d = extended.details;
  const pencil = (section: ProfileSection, label: string, index?: number) => (
    <Pencil
      label={label}
      onClick={() => onEdit({ section, index })}
      disabled={editing}
    />
  );
  const add = (section: ProfileSection, label: string) => (
    <button
      className="profile-v2-link"
      disabled={editing}
      onClick={() => onEdit({ section })}
    >
      {label}
    </button>
  );
  const facts = (entries: [string, unknown][]) => (
    <dl className="profile-v2-facts">
      {entries.map(([label, value]) => (
        <div key={label}>
          <dt>{label}</dt>
          <dd>
            {Array.isArray(value)
              ? value.join(", ")
              : String(value || "Not added")}
          </dd>
        </div>
      ))}
    </dl>
  );
  const projects = (
    Array.isArray(d.projects) ? d.projects : (d.project_records ?? [])
  ) as ProfessionalRecord[];
  function recordList(section: ProfileSection, rows: ProfessionalRecord[]) {
    return rows.map((r, i) => (
      <article key={i} className="profile-reference-record">
        <div className="profile-v2-item-heading">
          <div>
            <h3>{String(r.title ?? r.label ?? "Professional profile")}</h3>
            {r.url && (
              <SafeProfessionalLink url={String(r.url)} label={String(r.url)} />
            )}
          </div>
          {pencil(section, `Edit ${section} ${i + 1}`, i)}
        </div>
        {r.description && (
          <p className="profile-v2-prose whitespace-pre-line">
            {String(r.description)}
          </p>
        )}
        {r.issuer && <p className="profile-v2-meta">{String(r.issuer)}</p>}
        {Boolean(r.issued_year) && (
          <p className="profile-v2-meta">
            Issued {[r.issued_month, r.issued_year].filter(Boolean).join(" ")}
          </p>
        )}
        {Boolean(r.published_year) && (
          <p className="profile-v2-meta">
            Published{" "}
            {[r.published_month, r.published_year].filter(Boolean).join(" ")}
          </p>
        )}
        {Boolean(r.client) && (
          <p className="profile-v2-meta">Client: {String(r.client)}</p>
        )}
        {Boolean(r.start_year) && (
          <p className="profile-v2-meta">
            {[r.start_month, r.start_year].filter(Boolean).join(" ")} to{" "}
            {r.current === "Yes" || r.status === "In progress"
              ? "Present"
              : [r.end_month, r.end_year].filter(Boolean).join(" ") ||
                (section === "memberships"
                  ? "End date not added"
                  : "No expiry")}
          </p>
        )}
      </article>
    ));
  }
  return (
    <div className="profile-v2-sections">
      <div id="section-resume" className="scroll-mt-24">
        {resume}
      </div>
      <ProfileSectionCard
        id="section-headline"
        title="Resume headline"
        actions={pencil("headline", "Edit resume headline")}
      >
        <p className="profile-v2-prose">
          {profile.headline ||
            "Add a brief headline that describes your professional experience."}
        </p>
      </ProfileSectionCard>
      <ProfileSectionCard
        id="section-keyskills"
        title="Key skills"
        actions={pencil("keyskills", "Edit key skills")}
      >
        <div className="profile-reference-tags">
          {d.key_skills?.length ? (
            d.key_skills.map((skill) => <span key={skill}>{skill}</span>)
          ) : (
            <p className="profile-v2-meta">
              Add the skills that show your strengths.
            </p>
          )}
        </div>
      </ProfileSectionCard>
      {d.employment_highlights && (
        <ProfileSectionCard
          id="section-highlights"
          title="Employment highlights"
          actions={pencil("highlights", "Edit employment highlights")}
        >
          <p className="profile-v2-prose">{d.employment_highlights}</p>
        </ProfileSectionCard>
      )}
      <ProfileSectionCard
        id="section-experience"
        title="Employment"
        actions={add("experience", "Add employment")}
      >
        {(d.employment ?? []).map((r, i) => (
          <article className="profile-reference-record" key={i}>
            <div className="profile-v2-item-heading">
              <div>
                <h3>{r.job_title || "Job title"}</h3>
                <p>{r.company}</p>
              </div>
              {pencil(
                "experience",
                `Edit employment ${i + 1}: ${r.company || "role"}`,
                i,
              )}
            </div>
            <p className="profile-v2-meta">
              {[r.employment_type, r.location].filter(Boolean).join(" · ")}
            </p>
            <p className="profile-v2-meta">
              {[r.joining_month, r.joining_year].filter(Boolean).join(" ")} to{" "}
              {["yes", "true"].includes(String(r.current_company).toLowerCase())
                ? "Present"
                : [r.end_month, r.end_year].filter(Boolean).join(" ") ||
                  "Dates not added"}
            </p>
            {r.job_profile && (
              <p className="profile-v2-prose whitespace-pre-line">
                {r.job_profile}
              </p>
            )}
            {r.skills_used && (
              <p className="profile-v2-meta">Skills used: {r.skills_used}</p>
            )}
            {r.achievements && (
              <p className="profile-v2-prose whitespace-pre-line">
                <strong>Achievements: </strong>
                {r.achievements}
              </p>
            )}
          </article>
        ))}
        {!d.employment?.length && (
          <p className="profile-v2-meta">
            Add your employment history to help recruiters understand your work.
          </p>
        )}
      </ProfileSectionCard>
      <ProfileSectionCard
        id="section-education"
        title="Education"
        actions={add("education", "Add education")}
      >
        {(d.education ?? []).map((r, i) => (
          <article className="profile-reference-record" key={i}>
            <div className="profile-v2-item-heading">
              <div>
                <h3>
                  {r.course || r.level || r.education}
                  {r.specialization ? " — " + r.specialization : ""}
                </h3>
                <p>{r.university}</p>
              </div>
              {pencil(
                "education",
                `Edit education ${i + 1}: ${r.university || "qualification"}`,
                i,
              )}
            </div>
            <p className="profile-v2-meta">
              {[r.start_year, r.end_year].filter(Boolean).join("–")} ·{" "}
              {r.course_type}
            </p>
            {r.score && (
              <p className="profile-v2-meta">
                {r.grading_system}: {r.score}
              </p>
            )}
          </article>
        ))}
        <div className="profile-reference-education-add">
          {[
            "doctorate/PhD",
            "masters/post-graduation",
            "class XII",
            "class X",
          ].map((level) => (
            <button
              key={level}
              className="profile-v2-link"
              onClick={() => onEdit({ section: "education", preset: level })}
              disabled={editing}
            >
              Add {level}
            </button>
          ))}
        </div>
      </ProfileSectionCard>
      <ProfileSectionCard
        id="section-skills"
        title="IT skills"
        actions={add("skills", "Add IT skills")}
      >
        <div className="profile-reference-table-scroll">
          <table className="profile-reference-table">
            <thead>
              <tr>
                <th>Skills</th>
                <th>Version</th>
                <th>Last used</th>
                <th>Experience</th>
                <th>
                  <span className="sr-only">Edit</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {(d.it_skills ?? []).map((r, i) => (
                <tr key={i}>
                  <td>{r.name}</td>
                  <td>{r.version || "–"}</td>
                  <td>{r.last_used || "–"}</td>
                  <td>
                    {experienceText(
                      Number(r.experience_years || 0) * 12 +
                        Number(r.experience_months || 0),
                    )}
                  </td>
                  <td>
                    {pencil("skills", `Edit skill ${i + 1}: ${r.name}`, i)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {!d.it_skills?.length && (
          <p className="profile-v2-meta mt-3">
            Add technical skills with versions, experience and the year last
            used.
          </p>
        )}
      </ProfileSectionCard>
      <ProfileSectionCard
        id="section-projects"
        title="Projects"
        actions={add("project", "Add project")}
      >
        {recordList("project", projects)}
        {typeof d.projects === "string" && d.projects && (
          <div className="profile-reference-record">
            <p className="profile-v2-prose whitespace-pre-line">{d.projects}</p>
            {add("projects", "Edit existing project notes")}
          </div>
        )}
        {!projects.length && !d.projects && (
          <p className="profile-v2-meta">
            Stand out to employers by adding projects from education,
            internships or work.
          </p>
        )}
      </ProfileSectionCard>
      <ProfileSectionCard
        id="section-about"
        title="Profile summary"
        actions={pencil("about", "Edit profile summary")}
      >
        <p className="profile-v2-prose whitespace-pre-line">
          {d.professional_summary ||
            "Add a summary of your professional experience and goals."}
        </p>
      </ProfileSectionCard>
      <ProfileSectionCard id="section-accomplishments" title="Accomplishments">
        {Object.entries(accomplishmentSections).map(([section, definition]) => {
          const value = d[definition.key];
          const rows = (
            Array.isArray(value)
              ? value
              : section === "onlineProfiles"
                ? (d.online_profiles ?? [])
                : []
          ) as ProfessionalRecord[];
          return (
            <div key={section} className="profile-reference-accomplishment">
              <div className="profile-v2-item-heading">
                <div>
                  <h3>{definition.title}</h3>
                  <p className="profile-v2-meta">
                    {section === "onlineProfiles"
                      ? "Add links to your professional profiles"
                      : section === "workSamples"
                        ? "Link relevant work samples"
                        : section === "publications"
                          ? "Add links to your online publications"
                          : section === "presentations"
                            ? "Add links to your online presentations"
                            : section === "patents"
                              ? "Add details of patents you have filed"
                              : section === "awards"
                                ? "Add professional awards and recognition"
                                : section === "memberships"
                                  ? "Add professional memberships and affiliations"
                                  : "Add certifications you have completed"}
                  </p>
                </div>
                {add(
                  section as AccomplishmentSection,
                  `Add ${definition.title.toLowerCase()}`,
                )}
              </div>
              {recordList(section as AccomplishmentSection, rows)}
              {section === "onlineProfiles" &&
                typeof value === "string" &&
                value && (
                  <>
                    <ProfessionalContentView value={value} links />
                    {add("links", "Edit existing professional links")}
                  </>
                )}
            </div>
          );
        })}
        {d.accomplishments && (
          <div className="profile-reference-accomplishment">
            <h3>Existing achievements & certifications</h3>
            <ProfessionalContentView value={d.accomplishments} />
            {add("projects", "Edit existing achievements")}
          </div>
        )}
      </ProfileSectionCard>
      <ProfileSectionCard
        id="section-preferences"
        title="Career profile"
        actions={pencil("preferences", "Edit career profile")}
      >
        {facts([
          ["Current industry", d.industry],
          ["Department", d.department_role],
          ["Role category", d.role_category],
          ["Job role", d.job_role],
          ["Desired job type", d.desired_job_type],
          ["Desired employment type", d.desired_employment_type],
          ["Preferred job role", d.preferred_job_roles],
          ["Preferred work location", d.preferred_locations],
          ["Work mode", d.preferred_work_mode],
          ["Preferred shift", d.preferred_shift],
        ])}
        <div className="mt-6 border-t border-line pt-5">
          <h3 className="font-semibold">Private compensation</h3>
          <p className="profile-v2-hint mt-1 mb-4">
            Only visible to you. Excluded from your public profile and recruiter
            views.
          </p>
          {facts(
            (["current", "expected"] as const).map((kind) => {
              const monthly = d[kind + "_salary_unit"] === "Monthly";
              const amount =
                extended[
                  kind === "current"
                    ? "current_salary_amount"
                    : "expected_salary_amount"
                ];
              const currency =
                extended[
                  kind === "current"
                    ? "current_salary_currency"
                    : "expected_salary_currency"
                ];
              return [
                kind === "current" ? "Current salary" : "Expected salary",
                amount == null
                  ? null
                  : `${currency} ${(amount / (monthly ? 12 : 1)).toLocaleString("en-IN", { maximumFractionDigits: 2 })} / ${monthly ? "month" : "year"}`,
              ];
            }),
          )}
        </div>
      </ProfileSectionCard>
      <ProfileSectionCard
        id="section-personal"
        title="Personal details"
        actions={pencil("personal", "Edit personal details")}
      >
        <p className="profile-v2-hint mb-4">
          Optional and private. Not used in professional completion or matching.
        </p>
        {facts([
          ["Personal", [d.gender, d.marital_status].filter(Boolean).join(", ")],
          ["More information", d.more_information],
          ["Date of birth", d.date_of_birth],
          ["Category", d.category],
          [
            "Work permit",
            [...(d.usa_work_authorization ?? []), d.other_work_permits]
              .filter(Boolean)
              .join(", "),
          ],
          [
            "Address",
            [d.permanent_address, d.hometown, d.pincode]
              .filter(Boolean)
              .join(", "),
          ],
        ])}
        <div className="profile-v2-item-heading mt-5">
          <h3>Languages</h3>
          {add("languages", "Add languages")}
        </div>
        <div className="profile-reference-table-scroll">
          <table className="profile-reference-table">
            <thead>
              <tr>
                <th>Languages</th>
                <th>Proficiency</th>
                <th>Read</th>
                <th>Write</th>
                <th>Speak</th>
                <th>
                  <span className="sr-only">Edit</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {(d.languages ?? []).map((r, i) => (
                <tr key={i}>
                  <td>{r.language}</td>
                  <td>{r.proficiency || "–"}</td>
                  {(["read", "write", "speak"] as const).map((k) => (
                    <td key={k}>
                      {["yes", "true"].includes(String(r[k]).toLowerCase())
                        ? "Yes"
                        : "No"}
                    </td>
                  ))}
                  <td>
                    {pencil(
                      "languages",
                      `Edit language ${i + 1}: ${r.language}`,
                      i,
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </ProfileSectionCard>
      <ProfileSectionCard
        id="section-diversity"
        title="Diversity & inclusion"
        actions={pencil("diversity", "Edit diversity and inclusion")}
      >
        {facts([
          ["Disability status", d.disability_status],
          ["Military experience", d.military_experience],
          ["Career break", d.career_break],
        ])}
        <p className="profile-v2-hint mt-4">
          These details stay private. You decide whether to add them.
        </p>
      </ProfileSectionCard>
    </div>
  );
}
