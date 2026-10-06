import type {
  CandidateProfile,
  CandidateProfileDetails,
} from "@/lib/candidate";
import type { FieldErrors } from "@/lib/profile-validation";
import { CountryField, ProfileField } from "./profile-fields";
import { ProfessionalContentFields } from "./professional-content";
import { calculatedExperience } from "@/lib/profile-validation";
import type { AccomplishmentSection } from "./profile-reference-schema";
function ProfileChoices({
  name,
  label,
  values,
  choices,
}: {
  name: string;
  label: string;
  values?: string[];
  choices: string[];
}) {
  return (
    <fieldset className="grid gap-2">
      <legend className="text-sm font-semibold">{label}</legend>
      <input type="hidden" name={name + "_present"} value="true" />
      {[...new Set([...choices, ...(values ?? [])])].map((value) => (
        <label key={value} className="profile-v2-check">
          <input
            type="checkbox"
            name={name}
            value={value}
            defaultChecked={values?.includes(value)}
          />
          {value}
        </label>
      ))}
    </fieldset>
  );
}
export type ProfileSection =
  | AccomplishmentSection
  | "headline"
  | "highlights"
  | "keyskills"
  | "project"
  | "personal"
  | "diversity"
  | "intro"
  | "about"
  | "experience"
  | "skills"
  | "education"
  | "preferences"
  | "projects"
  | "links"
  | "languages"
  | "additional"
  | "authorization";
export type ProfileEditTarget = {
  section: ProfileSection;
  index?: number;
  preset?: string;
};
export const sectionTitles: Record<ProfileSection, string> = {
  awards: "Award",
  memberships: "Professional membership",
  headline: "Resume headline",
  keyskills: "Key skills",
  project: "Project",
  personal: "Personal details",
  diversity: "Diversity & inclusion",
  highlights: "Employment highlights",
  onlineProfiles: "Online profile",
  workSamples: "Work sample",
  publications: "Publication",
  presentations: "Presentation",
  patents: "Patent",
  certifications: "Certification",
  intro: "Basic profile",
  about: "About",
  experience: "Experience",
  skills: "Skills & Expertise",
  education: "Education",
  preferences: "Career Preferences",
  projects: "Projects & Achievements",
  links: "Professional links",
  languages: "Languages",
  additional: "Optional private information",
  authorization: "Work authorization",
};
export const detailKeys: Partial<Record<ProfileSection, string[]>> = {
  highlights: ["employment_highlights", "interested_domains"],
  about: [
    "professional_summary",
    "employment_highlights",
    "interested_domains",
  ],
  preferences: ["preferred_locations", "department_role", "industry"],
  projects: ["projects", "accomplishments"],
  links: ["professional_links"],
  languages: ["languages"],
  authorization: ["other_work_permits", "usa_work_authorization"],
  additional: [
    "gender",
    "marital_status",
    "date_of_birth",
    "category",
    "more_information",
    "disability_status",
    "disability_details",
    "military_experience",
    "career_break",
    "permanent_address",
    "hometown",
    "pincode",
  ],
};
export function ProfileDomainFields({
  section,
  profile,
  extended,
  errors,
}: {
  section: ProfileSection;
  profile: CandidateProfile;
  extended: CandidateProfileDetails;
  errors: FieldErrors;
}) {
  const d = extended.details;
  const field = (
    name: string,
    label: string,
    kind: "text" | "textarea" | "date" = "text",
  ) => (
    <ProfileField
      key={name}
      name={name}
      label={label}
      value={typeof d[name] === "string" ? (d[name] as string) : ""}
      errors={errors}
      kind={kind}
      maxLength={kind === "textarea" ? 5000 : 240}
    />
  );
  switch (section) {
    case "intro":
      return (
        <div className="profile-v2-form-grid">
          <ProfileField
            name="full_name"
            label="Full name"
            value={profile.full_name}
            errors={errors}
            required
            maxLength={160}
          />
          <ProfileField
            name="headline"
            label="Professional headline"
            value={profile.headline}
            errors={errors}
          />
          <ProfileField
            name="current_city"
            label="Current city"
            value={profile.current_city}
            errors={errors}
            maxLength={120}
          />
          <ProfileField
            name="current_state"
            label="State"
            value={profile.current_state}
            errors={errors}
            maxLength={120}
          />
          <CountryField
            name="country_code"
            label="Country"
            value={profile.country_code}
            errors={errors}
          />
          <>
            {calculatedExperience(d.employment) == null && (
              <ProfileField
                name="total_experience_months"
                label="Experience estimate (months)"
                kind="number"
                value={profile.total_experience_months}
                errors={errors}
                hint="Used until complete dated work history is available. Overlapping dated roles are calculated automatically."
              />
            )}
          </>
          <div className="profile-v2-private">
            <strong>{profile.email}</strong>
            <p>
              Account email is managed through verification, not profile
              editing.
            </p>
          </div>
        </div>
      );
    case "about":
      return (
        <div className="grid gap-4">
          {field("professional_summary", "Professional summary", "textarea")}
          {field("employment_highlights", "Employment highlights")}
          {field("interested_domains", "Interested domains")}
        </div>
      );
    case "projects":
      return (
        <div className="grid gap-4">
          <ProfessionalContentFields
            name="projects"
            value={d.projects}
            errors={errors}
          />
          <ProfessionalContentFields
            name="accomplishments"
            value={d.accomplishments}
            errors={errors}
          />
        </div>
      );
    case "links":
      return (
        <ProfessionalContentFields
          name="professional_links"
          value={d.professional_links}
          errors={errors}
        />
      );
    case "authorization":
      return (
        <div className="grid gap-4">
          {field("other_work_permits", "Work authorization / permits")}
          <ProfileChoices
            name="usa_work_authorization"
            label="US work authorization (optional)"
            values={d.usa_work_authorization}
            choices={[
              "Have US H1 Visa",
              "Need US H1 Visa",
              "US TN Permit holder",
              "US Green Card holder",
              "US Citizen",
              "Authorized to work in US",
            ]}
          />
        </div>
      );
    case "additional":
      return (
        <div className="grid gap-4">
          <p className="profile-v2-hint">
            All fields are optional and private. These do not improve
            professional completion or ranking.
          </p>
          <details>
            <summary>Personal information</summary>
            <div className="profile-v2-form-grid">
              {field("gender", "Gender (optional)")}
              {field("marital_status", "Marital status (optional)")}
              {field("date_of_birth", "Date of birth (optional)", "date")}
              {field("category", "Category (optional)")}
              {field("permanent_address", "Permanent address (optional)")}
              {field("hometown", "Hometown (optional)")}
              {field("pincode", "Postal code (optional)")}
            </div>
            <ProfileChoices
              name="more_information"
              label="Additional private context (optional)"
              values={d.more_information}
              choices={[
                "Single parent",
                "Working mother",
                "Retired (Ex)",
                "LGBTQ+",
              ]}
            />
          </details>
          <details open>
            <summary>Accessibility & career context</summary>
            <div className="grid gap-4">
              {field("disability_status", "Disability status (optional)")}
              {field(
                "disability_details",
                "Accessibility context (optional)",
                "textarea",
              )}
              {field(
                "military_experience",
                "Defence background (optional)",
                "textarea",
              )}
              {field("career_break", "Career break (optional)", "textarea")}
            </div>
          </details>
        </div>
      );
    default:
      return null;
  }
}
