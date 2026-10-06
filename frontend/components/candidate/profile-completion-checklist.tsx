import type {
  CandidateProfile,
  CandidateProfileDetails,
} from "@/lib/candidate";
import { profileKeySkills } from "@/lib/profile-key-skills";
export function ProfileCompletionChecklist({
  profile,
  extended,
}: {
  profile: CandidateProfile;
  extended: CandidateProfileDetails;
}) {
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
    <details className="profile-completion-checklist">
      <summary>
        Profile completeness <strong>{profile.profile_completion}%</strong>
      </summary>
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
