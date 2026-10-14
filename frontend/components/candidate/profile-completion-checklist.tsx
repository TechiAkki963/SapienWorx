"use client";
import { useEffect, useRef } from "react";
import { profileReadiness } from "@/lib/profile-readiness";
import type {
  CandidateProfile,
  CandidateProfileDetails,
} from "@/lib/candidate";
import { profileKeySkills } from "@/lib/profile-key-skills";
export function ProfileCompletionChecklist({
  profile,
  extended,
  initiallyExpanded=false,
}: {
  profile: CandidateProfile;
  extended: CandidateProfileDetails;
  initiallyExpanded?: boolean;
}) {
  const checklist=useRef<HTMLDetailsElement>(null);
  useEffect(()=>{if(initiallyExpanded){checklist.current?.scrollIntoView({block:"center"});checklist.current?.querySelector<HTMLElement>('[data-incomplete="true"]')?.focus()}},[initiallyExpanded]);
  const d = extended.details;
  const hasContent = (value: unknown) =>
    Array.isArray(value)
      ? value.length > 0
      : typeof value === "string" && value.trim().length > 0;
  const skills = new Set(
    [
      ...profileKeySkills(d.key_skills),
      ...(d.it_skills || []).map((row) => row.name || ""),
    ]
      .filter(Boolean)
      .map((name) => name.trim().toLowerCase()),
  );
  const items = [
    ["Basic information", "intro", !!profile.full_name],
    ["Professional headline", "headline", !!profile.headline],
    ["Professional summary", "about", !!d.professional_summary],
    ["Resume", "resume", !!extended.cv_original_filename],
    ["Skills", "keyskills", skills.size >= 3],
    [
      "Experience",
      "experience",
      !!d.employment?.some((row) => row.company && row.job_title),
    ],
    [
      "Education",
      "education",
      !!d.education?.some(
        (row) => row.university && (row.level || row.education),
      ),
    ],
    [
      "Career preferences",
      "preferences",
      !!d.preferred_locations && profile.notice_period_days != null,
    ],
    [
      "Projects & accomplishments",
      "projects",
      [
        d.projects,
        d.accomplishments,
        d.project_records,
        d.work_samples,
        d.certifications,
        d.awards,
        d.professional_memberships,
      ].some(hasContent),
    ],
  ] as const;
  return (
    <details ref={checklist} id="profile-completion" className="profile-completion-checklist" open={initiallyExpanded}>
      <summary>
        Profile completeness <strong>{profile.profile_completion}%</strong>
      </summary>
      <div className="profile-readiness-missing"><h3>Next steps for your profile</h3>{profileReadiness(profile,extended).length?<ul>{profileReadiness(profile,extended).map(item=><li key={item.href}><a href={item.href} data-incomplete="true">{item.label} →</a></li>)}</ul>:<p>Your core profile sections are ready.</p>}</div>
      <ul>
        {items.map(([label, id, ready]) => (
          <li key={id}>
            <a href={`#section-${id}`}>
              <span aria-hidden="true">{ready ? "✓" : "○"}</span>
              {label}
              <span className="sr-only">
                {ready ? "Added" : "Incomplete; open this section"}
              </span>
            </a>
          </li>
        ))}
      </ul>
      <p>Optional private information does not affect your completeness.</p>
    </details>
  );
}
