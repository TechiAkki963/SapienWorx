"use client";
import { useState } from "react";
import type { Employment } from "@/lib/candidate";
import type { FieldErrors } from "@/lib/profile-validation";
import { ProfileField, MonthYearFields } from "./profile-fields";
export function ExperienceEditor({
  row,
  index,
  errors,
}: {
  row: Employment;
  index: number;
  errors: FieldErrors;
}) {
  const [current, setCurrent] = useState(
    ["yes", "true"].includes(String(row.current_company).toLowerCase()),
  );
  const p = `employment[${index}].`;
  return (
    <div className="profile-v2-form-grid">
      <ProfileField
        name={p + "job_title"}
        label="Job title"
        value={row.job_title}
        errors={errors}
        required
      />
      <ProfileField
        name={p + "company"}
        label="Company name"
        value={row.company}
        errors={errors}
        required
      />
      <ProfileField
        name={p + "employment_type"}
        label="Employment type"
        value={row.employment_type}
        errors={errors}
        kind="select"
        options={[
          "Full time",
          "Part time",
          "Contract",
          "Internship",
          "Temporary",
        ]}
      />
      <label className="profile-v2-check">
        <input
          name={p + "current_company"}
          type="checkbox"
          value="Yes"
          checked={current}
          onChange={(e) => setCurrent(e.target.checked)}
        />
        I currently work here
      </label>
      <ProfileField
        name={p + "location"}
        label="Location"
        value={row.location}
        errors={errors}
        maxLength={120}
      />
      <MonthYearFields
        prefix={p + "joining"}
        label="Start date"
        month={row.joining_month}
        year={row.joining_year}
        errors={errors}
      />
      {!current && (
        <MonthYearFields
          prefix={p + "end"}
          label="End date"
          month={row.end_month}
          year={row.end_year}
          errors={errors}
        />
      )}
      <ProfileField
        name={p + "skills_used"}
        label="Skills used"
        value={row.skills_used}
        errors={errors}
        hint="Separate skills with commas."
      />
      <div className="profile-v2-wide">
        <ProfileField
          name={p + "job_profile"}
          label="Role description & achievements"
          value={row.job_profile}
          errors={errors}
          kind="textarea"
          maxLength={5000}
        />
      </div>
      <div className="profile-v2-wide">
        <ProfileField
          name={p + "achievements"}
          label="Achievements"
          value={row.achievements}
          errors={errors}
          kind="textarea"
          maxLength={4000}
        />
      </div>
      <details className="profile-v2-wide">
        <summary>Private compensation for this role</summary>
        <p className="profile-v2-hint">
          Only you can see this value. It is excluded from public and recruiter
          profiles.
        </p>
        <ProfileField
          name={p + "current_salary"}
          label="Salary for this role (private)"
          value={row.current_salary}
          errors={errors}
          kind="number"
        />
      </details>
    </div>
  );
}
