"use client";
import { useState } from "react";
import type {
  CandidateProfile,
  CandidateProfileDetails,
  ProfessionalRecord,
} from "@/lib/candidate";
import { profileContract, type FieldErrors } from "@/lib/profile-validation";
import { ProfileField, CountryField, MonthYearFields } from "./profile-fields";
import {
  accomplishmentSections,
  type AccomplishmentSection,
  type ReferenceField,
} from "./profile-reference-schema";
import type { ProfileEditTarget } from "./profile-domain-fields";
import { TaxonomyInput } from "../workforce/taxonomy-input";
import { ProfileDateFields } from "./profile-date-fields";
import { ProfilePermitCountries } from "./profile-permit-countries";
import { ProfilePersonalLanguages } from "./profile-personal-languages";

export function ReferenceKeySkills({
  value,
  errors,
  onChange,
}: {
  value?: string[];
  errors: FieldErrors;
  onChange: () => void;
}) {
  const [skills, setSkills] = useState(value ?? []),
    [draft, setDraft] = useState("");
  function add(text: string) {
    const next = text.trim();
    if (next && !skills.includes(next) && skills.length < 50) {
      setSkills((old) => [...old, next]);
      onChange();
    }
    setDraft("");
  }
  return (
    <div className="grid gap-4">
      <p className="profile-v2-hint">
        Add skills that best define your expertise. Add at least one skill.
      </p>
      <input type="hidden" name="key_skills" value={skills.join(", ")} />
      <div className="profile-reference-tags">
        {skills.map((skill) => (
          <span key={skill}>
            {skill}
            <button
              type="button"
              aria-label={"Remove " + skill}
              onClick={() => {
                setSkills((old) => old.filter((v) => v !== skill));
                onChange();
              }}
            >
              ×
            </button>
          </span>
        ))}
      </div>
      <label className="text-sm font-semibold" htmlFor="profile-key-skills">
        Skills
      </label>
      <TaxonomyInput
        id="profile-key-skills"
        ariaLabel="Add skills"
        value={draft}
        onValueChange={(v) => {
          setDraft(v);
          onChange();
        }}
        onSelect={(item) => add(item.canonical_name)}
        onCommit={add}
        className="profile-v2-input"
        maxLength={120}
        ariaInvalid={!!errors.key_skills}
        ariaDescribedBy={errors.key_skills ? "key-skills-error" : undefined}
      />
      <p className="profile-v2-hint">
        Choose a suggestion or press Enter to add a skill.
      </p>
      {errors.key_skills && (
        <p id="key-skills-error" className="profile-v2-error">
          {errors.key_skills}
        </p>
      )}
    </div>
  );
}

export function ProfileChoiceGroup({
  name,
  label,
  value,
  options,
  multiple = false,
  onChange,
}: {
  name: string;
  label: string;
  value?: string | string[];
  options: string[];
  multiple?: boolean;
  onChange?: (value: string) => void;
}) {
  const selected = Array.isArray(value) ? value : value ? [value] : [];
  return (
    <fieldset className="profile-reference-choices">
      <legend>{label}</legend>
      <input type="hidden" name={name + "_present"} value="true" />
      {[...new Set([...options, ...selected])].map((option) => (
        <label key={option}>
          <input
            type={multiple ? "checkbox" : "radio"}
            name={name}
            value={option}
            defaultChecked={selected.includes(option)}
            onChange={() => onChange?.(option)}
          />
          {option}
        </label>
      ))}
    </fieldset>
  );
}

export function ReferenceBasicFields({
  profile,
  extended,
  errors,
}: {
  profile: CandidateProfile;
  extended: CandidateProfileDetails;
  errors: FieldErrors;
}) {
  const d = extended.details;
  const [status, setStatus] = useState(
    String(
      d.work_status ??
        (profile.total_experience_months ? "Experienced" : "Fresher"),
    ),
  );
  const [salaryBreakdown, setSalaryBreakdown] = useState(
    String(d.salary_breakdown ?? "Fixed"),
  );
  const [locationInIndia, setLocationInIndia] = useState(
    profile.country_code === "IN",
  );
  const [outsideCountry, setOutsideCountry] = useState(
    profile.country_code === "IN" ? "" : (profile.country_code ?? ""),
  );
  return (
    <div className="grid gap-6">
      <ProfileField
        name="full_name"
        label="Name"
        value={profile.full_name}
        errors={errors}
        required
        maxLength={160}
      />
      <fieldset className="profile-reference-choices">
        <legend>Work status</legend>
        <p className="profile-v2-hint">
          This helps us personalise your experience.
        </p>
        {["Fresher", "Experienced"].map((v) => (
          <label key={v}>
            <input
              name="work_status"
              type="radio"
              value={v}
              checked={status === v}
              onChange={() => setStatus(v)}
            />
            {v}
          </label>
        ))}
      </fieldset>
      {status === "Experienced" && (
        <>
          <div className="profile-v2-form-grid">
            <ProfileField
              name="experience_years"
              label="Total experience — years"
              kind="select"
              options={Array.from({ length: 81 }, (_, i) => String(i))}
              value={Math.floor(profile.total_experience_months / 12)}
              errors={errors}
            />
            <ProfileField
              name="experience_months"
              label="Total experience — months"
              kind="select"
              options={Array.from({ length: 12 }, (_, i) => String(i))}
              value={profile.total_experience_months % 12}
              errors={errors}
            />
          </div>
          <p className="profile-v2-hint">
            Complete employment dates take precedence; overlapping roles are
            counted once.
          </p>
          <div className="profile-v2-form-grid">
            <ProfileField
              name="current_salary_currency"
              label="Currency"
              value={extended.current_salary_currency}
              kind="select"
              options={profileContract.currencies}
              errors={errors}
            />
            <ProfileField
              name="current_salary_amount"
              label="Current salary"
              value={extended.current_salary_amount}
              kind="number"
              errors={errors}
            />
          </div>
          <label className="profile-v2-field">
            Salary breakdown
            <select
              className="profile-v2-input"
              name="salary_breakdown"
              value={salaryBreakdown}
              onChange={(e) => setSalaryBreakdown(e.target.value)}
            >
              <option>Fixed</option>
              <option>Fixed + Variable</option>
            </select>
          </label>
          {salaryBreakdown === "Fixed + Variable" && (
            <div className="profile-v2-form-grid">
              <ProfileField
                name="fixed_salary"
                label="Fixed component"
                value={String(d.fixed_salary ?? "")}
                kind="number"
                errors={errors}
              />
              <ProfileField
                name="variable_salary"
                label="Variable component"
                value={String(d.variable_salary ?? "")}
                kind="number"
                errors={errors}
              />
            </div>
          )}
          <p className="profile-v2-hint">
            Compensation remains private and is excluded from public and
            recruiter profiles.
          </p>
        </>
      )}
      <fieldset className="profile-reference-choices">
        <legend>Current location</legend>
        <label>
          <input
            type="radio"
            name="location_region"
            checked={locationInIndia}
            onChange={() => setLocationInIndia(true)}
          />
          India
        </label>
        <label>
          <input
            type="radio"
            name="location_region"
            checked={!locationInIndia}
            onChange={() => setLocationInIndia(false)}
          />
          Outside India
        </label>
      </fieldset>
      {locationInIndia ? (
        <input type="hidden" name="country_code" value="IN" />
      ) : (
        <CountryField
          name="country_code"
          label="Current location country"
          value={outsideCountry}
          errors={errors}
          onChange={setOutsideCountry}
        />
      )}
      <ProfileField
        name="current_city"
        label="Current location"
        value={profile.current_city}
        maxLength={120}
        errors={errors}
      />
      <div className="profile-v2-form-grid">
        <ProfileField
          name="current_state"
          label="State"
          value={profile.current_state}
          maxLength={120}
          errors={errors}
        />
        <ProfileField
          name="locality"
          label="Locality"
          value={String(d.locality ?? "")}
          errors={errors}
        />
      </div>
      <dl className="profile-v2-facts">
        <div>
          <dt>Mobile number</dt>
          <dd>{profile.phone || "Not added"}</dd>
        </div>
        <div>
          <dt>Email address</dt>
          <dd>{profile.email}</dd>
        </div>
      </dl>
      <p className="profile-v2-hint">
        Verified account contact details are managed through account
        verification.
      </p>
      <div className="profile-v2-field">
        <label htmlFor="profile-reference-availability">
          Availability to join
        </label>
        <select
          id="profile-reference-availability"
          name="notice_period_days"
          className="profile-v2-input"
          defaultValue={profile.notice_period_days ?? ""}
          aria-invalid={!!errors.notice_period_days}
          aria-describedby={
            errors.notice_period_days
              ? "profile-reference-availability-error"
              : undefined
          }
        >
          <option value="">Select availability</option>
          {[
            [0, "Immediate"],
            [15, "15 days or less"],
            [30, "1 month"],
            [60, "2 months"],
            [90, "3 months"],
            [120, "More than 3 months"],
          ].map(([days, label]) => (
            <option key={days} value={days}>
              {label}
            </option>
          ))}
          {profile.notice_period_days != null &&
            ![0, 15, 30, 60, 90, 120].includes(profile.notice_period_days) && (
              <option value={profile.notice_period_days}>
                {profile.notice_period_days} days (saved value)
              </option>
            )}
        </select>
        {errors.notice_period_days && (
          <p
            id="profile-reference-availability-error"
            className="profile-v2-error"
          >
            {errors.notice_period_days}
          </p>
        )}
      </div>
    </div>
  );
}

export function ReferenceRecordFields({
  target,
  row,
  index,
  profile,
  extended,
  errors,
}: {
  target: ProfileEditTarget;
  row: ProfessionalRecord;
  index: number;
  profile: CandidateProfile;
  extended: CandidateProfileDetails;
  errors: FieldErrors;
}) {
  const key =
    target.section === "project"
      ? typeof extended.details.projects === "string"
        ? "project_records"
        : "projects"
      : target.section === "onlineProfiles" &&
          typeof extended.details.professional_links === "string"
        ? "online_profiles"
        : (accomplishmentSections[target.section as AccomplishmentSection]
            ?.key ?? target.section);
  const p = `${key}[${index}].`;
  const [ongoing, setOngoing] = useState(
    target.section === "project"
      ? String(row.status ?? "In progress") === "In progress"
      : row.current === "Yes",
  );
  const [noExpiry, setNoExpiry] = useState(row.no_expiry === "Yes");
  const [more, setMore] = useState(
    [
      "location",
      "site",
      "employment_type",
      "team_size",
      "role",
      "role_description",
      "skills",
    ].some((k) => !!row[k]),
  );
  const field = (
    name: string,
    label: string,
    kind: "text" | "textarea" | "number" | "select" = "text",
    options?: string[],
    required = false,
    max = 240,
  ) => (
    <ProfileField
      key={name}
      name={p + name}
      label={label}
      value={typeof row[name] === "string" ? String(row[name]) : ""}
      errors={errors}
      kind={kind}
      options={options}
      required={required}
      maxLength={max}
    />
  );
  const dates = (prefix: string, label: string) => (
    <MonthYearFields
      prefix={p + prefix}
      label={label}
      month={String(row[prefix + "_month"] ?? "")}
      year={String(row[prefix + "_year"] ?? "")}
      errors={errors}
    />
  );
  if (target.section === "project")
    return (
      <div className="grid gap-5">
        {field("title", "Project title", "text", undefined, true)}
        {field(
          "tag",
          "Tag this project with your employment/education",
          "select",
          [
            ...(extended.details.employment ?? []).map((r) =>
              [r.job_title, r.company].filter(Boolean).join(" at "),
            ),
            ...(extended.details.education ?? []).map((r) =>
              [r.level, r.university].filter(Boolean).join(" at "),
            ),
          ],
        )}
        {field("client", "Client", "text", undefined, true)}
        <fieldset className="profile-reference-choices">
          <legend>Project status</legend>
          {["In progress", "Finished"].map((v) => (
            <label key={v}>
              <input
                name={p + "status"}
                type="radio"
                value={v}
                checked={ongoing === (v === "In progress")}
                onChange={() => setOngoing(v === "In progress")}
              />
              {v}
            </label>
          ))}
        </fieldset>
        {dates("start", "Worked from")}
        {!ongoing && dates("end", "Worked till")}
        {field(
          "description",
          "Details of project",
          "textarea",
          undefined,
          true,
          1000,
        )}
        <button
          type="button"
          className="profile-v2-link"
          onClick={() => setMore(!more)}
        >
          {more ? "Show fewer details" : "Add more details"}
        </button>
        {more && (
          <>
            {field("location", "Project location")}
            {field("site", "Project site", "select", ["Onsite", "Offsite"])}
            {field("employment_type", "Nature of employment", "select", [
              "Full time",
              "Part time",
              "Contractual",
            ])}
            {field("team_size", "Team size", "number")}
            {field("role", "Role")}
            {field(
              "role_description",
              "Role description",
              "textarea",
              undefined,
              false,
              250,
            )}
            {field("skills", "Skills used", "text", undefined, false, 500)}
            {field("url", "Project URL")}
          </>
        )}
      </div>
    );
  const definition = accomplishmentSections[
    target.section as AccomplishmentSection
  ] as { title: string; key: string; fields: ReferenceField[] };
  return (
    <div className="grid gap-5">
      {definition.fields.map((f) => (
        <ProfileField
          key={f.key}
          name={p + f.key}
          label={f.label}
          value={typeof row[f.key] === "string" ? String(row[f.key]) : ""}
          errors={errors}
          kind={f.kind}
          options={"options" in f ? f.options : undefined}
          required={"required" in f ? f.required : undefined}
          maxLength={"max" in f ? f.max : 240}
        />
      ))}
      {target.section === "workSamples" && (
        <>
          {dates("start", "Duration from")}
          {!ongoing && dates("end", "Duration to")}
          <label className="profile-v2-check">
            <input
              name={p + "current"}
              type="checkbox"
              value="Yes"
              checked={ongoing}
              onChange={(e) => setOngoing(e.target.checked)}
            />
            I am currently working on this
          </label>
        </>
      )}
      {target.section === "publications" && dates("published", "Published on")}
      {target.section === "awards" && dates("issued", "Awarded on")}
      {target.section === "memberships" && (
        <>
          {dates("start", "Member since")}
          {!ongoing && dates("end", "Membership ended")}
          <label className="profile-v2-check">
            <input
              name={p + "current"}
              type="checkbox"
              value="Yes"
              checked={ongoing}
              onChange={(event) => setOngoing(event.target.checked)}
            />
            Current membership
          </label>
        </>
      )}
      {target.section === "patents" && dates("issued", "Issue / filing date")}
      {target.section === "certifications" && (
        <>
          {dates("start", "Certification validity from")}
          {!noExpiry && dates("end", "Certification validity to")}
          <label className="profile-v2-check">
            <input
              name={p + "no_expiry"}
              type="checkbox"
              value="Yes"
              checked={noExpiry}
              onChange={(e) => setNoExpiry(e.target.checked)}
            />
            This certification does not expire
          </label>
        </>
      )}
    </div>
  );
}

export function ReferencePersonalFields({
  extended,
  errors,
}: {
  extended: CandidateProfileDetails;
  errors: FieldErrors;
}) {
  const d = extended.details;
  const field = (
    key: string,
    label: string,
    kind: "text" | "date" = "text",
  ) => (
    <ProfileField
      name={key}
      label={label}
      value={String(d[key] ?? "")}
      errors={errors}
      kind={kind}
    />
  );
  return (
    <div className="grid gap-6">
      <p className="profile-v2-hint">
        Optional and private. These details do not affect professional
        completion or matching.
      </p>
      <ProfileChoiceGroup
        name="gender"
        label="Gender"
        value={d.gender}
        options={["Male", "Female", "Transgender", "Prefer not to say"]}
      />
      <ProfileChoiceGroup
        name="more_information"
        label="More information"
        value={d.more_information}
        options={["Single parent", "Working mother", "Retired (60+)", "LGBTQ+"]}
        multiple
      />
      <ProfileChoiceGroup
        name="marital_status"
        label="Marital status"
        value={d.marital_status}
        options={[
          "Single/unmarried",
          "Married",
          "Widowed",
          "Divorced",
          "Separated",
          "Other",
        ]}
      />
      <ProfileDateFields
        name="date_of_birth"
        label="Date of birth"
        value={d.date_of_birth}
        errors={errors}
      />
      <ProfileChoiceGroup
        name="category"
        label="Category"
        value={d.category}
        options={[
          "General",
          "Scheduled Caste (SC)",
          "Scheduled Tribe (ST)",
          "OBC - Creamy",
          "OBC - Non creamy",
          "Other",
        ]}
      />
      <ProfileChoiceGroup
        name="usa_work_authorization"
        label="Work permit for USA"
        value={d.usa_work_authorization}
        options={[
          "Have US H1 Visa",
          "Need US H1 Visa",
          "US TN Permit Holder",
          "US Green Card Holder",
          "US Citizen",
          "Authorized to work in US",
        ]}
        multiple={(d.usa_work_authorization?.length ?? 0) > 1}
      />
      <ProfilePermitCountries value={d.other_work_permits} errors={errors} />
      {field("permanent_address", "Permanent address")}
      {field("hometown", "Hometown")}
      {field("pincode", "Pincode")}
      <ProfilePersonalLanguages value={d.languages} errors={errors} />
    </div>
  );
}

export function ReferenceDiversityFields({
  extended,
  errors,
}: {
  extended: CandidateProfileDetails;
  errors: FieldErrors;
}) {
  const d = extended.details;
  const [disability, setDisability] = useState(
      String(d.disability_status ?? ""),
    ),
    [military, setMilitary] = useState(String(d.military_experience ?? "")),
    [careerBreak, setCareerBreak] = useState(String(d.career_break ?? "")),
    [ongoing, setOngoing] = useState(d.currently_on_break === "Yes");
  const field = (
    key: string,
    label: string,
    kind: "text" | "number" | "date" | "select" = "text",
    options?: string[],
    required = false,
  ) => (
    <ProfileField
      name={key}
      label={label}
      value={String(d[key] ?? "")}
      errors={errors}
      kind={kind}
      options={options}
      required={required}
    />
  );
  return (
    <div className="grid gap-6">
      <p className="profile-v2-hint">
        All information is optional and private. It does not affect matching or
        professional completion.
      </p>
      <ProfileChoiceGroup
        name="disability_status"
        label="Disability status"
        value={d.disability_status}
        options={[
          "Have disability",
          "Do not have disability",
          "Prefer not to say",
        ]}
        onChange={setDisability}
      />
      {disability === "Have disability" && (
        <>
          {field(
            "disability_type",
            "Disability type",
            "select",
            [
              "Blindness",
              "Low Vision",
              "Hearing Impairment",
              "Speech and Language Disability",
              "Locomotor Disability",
              "Leprosy Cured Person",
              "Cerebral Palsy",
              "Dwarfism",
              "Muscular Dystrophy",
              "Acid Attack Victims",
              "Specific Learning Disabilities",
              "Autism Spectrum Disorder",
              "Mental Illness",
              "Haemophilia",
              "Sickle Cell Disease",
              "Thalassemia",
              "Parkinson's Disease",
              "Intellectual Disability",
              "Chronic Neurological Conditions",
              "Multiple Sclerosis",
              "Multiple Disabilities including Deaf Blindness",
              "Others",
            ],
            true,
          )}
          {field(
            "disability_percentage",
            "Percentage of disability",
            "number",
            undefined,
            true,
          )}
          <ProfileChoiceGroup
            name="disability_reason"
            label="Disability reason"
            value={String(d.disability_reason ?? "")}
            options={[
              "Genetic",
              "Accident",
              "Medicine",
              "Diseases",
              "By birth",
            ]}
          />
          <ProfileChoiceGroup
            name="disability_certificate"
            label="Certificate type"
            value={String(d.disability_certificate ?? "")}
            options={["UDID", "Other certificate"]}
          />
        </>
      )}
      <ProfileField
        name="disability_details"
        label="Accessibility context"
        value={d.disability_details}
        kind="textarea"
        maxLength={5000}
        errors={errors}
      />
      <ProfileChoiceGroup
        name="military_experience"
        label="Military experience"
        value={d.military_experience}
        options={["Currently serving", "Previously served", "Never served"]}
        onChange={setMilitary}
      />
      {["Currently serving", "Previously served"].includes(military) && (
        <>
          {field(
            "military_service_type",
            "Service type",
            "select",
            ["Army", "Navy", "Air Force", "Coast Guard"],
            true,
          )}
          {
            <ProfileDateFields
              name="military_enrolment_date"
              label="Date of enrolment"
              value={String(d.military_enrolment_date ?? "")}
              errors={errors}
            />
          }
          {military === "Previously served" && (
            <ProfileDateFields
              name="military_discharge_date"
              label="Discharge date"
              value={String(d.military_discharge_date ?? "")}
              errors={errors}
            />
          )}
          {field("military_service_number", "Service number")}
        </>
      )}
      <ProfileChoiceGroup
        name="career_break"
        label="Career break"
        value={d.career_break}
        options={["Have taken", "Have not taken"]}
        onChange={setCareerBreak}
      />
      {careerBreak === "Have taken" && (
        <>
          <ProfileChoiceGroup
            name="career_break_reason"
            label="Reason of break"
            value={String(d.career_break_reason ?? "")}
            options={[
              "Child care",
              "Education",
              "Medical",
              "Layoff",
              "Personal",
            ]}
          />
          <MonthYearFields
            prefix="career_break_start"
            label="Break duration from"
            month={String(d.career_break_start_month ?? "")}
            year={String(d.career_break_start_year ?? "")}
            errors={errors}
          />
          {!ongoing && (
            <MonthYearFields
              prefix="career_break_end"
              label="Break duration till"
              month={String(d.career_break_end_month ?? "")}
              year={String(d.career_break_end_year ?? "")}
              errors={errors}
            />
          )}
          <input
            type="hidden"
            name="currently_on_break"
            value={ongoing ? "Yes" : "No"}
          />
          <label className="profile-v2-check">
            <input
              type="checkbox"
              checked={ongoing}
              onChange={(e) => setOngoing(e.target.checked)}
            />
            Currently on break
          </label>
        </>
      )}
    </div>
  );
}
