"use client";
import { useId } from "react";
import type { ProfileSkill } from "@/lib/candidate";
import { TaxonomyInput } from "@/components/workforce/taxonomy-input";
import type { FieldErrors } from "@/lib/profile-validation";
import { ProfileField, yearOptions } from "./profile-fields";
export function SkillsEditor({
  row,
  index,
  errors,
  onChange,
}: {
  row: ProfileSkill;
  index: number;
  errors: FieldErrors;
  onChange?: () => void;
}) {
  const p = `it_skills[${index}].`;
  const id = useId(),
    error = errors[p + "name"];
  return (
    <div className="profile-v2-form-grid">
      <div className="profile-v2-field">
        <label htmlFor={id}>
          Skill / competency <span aria-hidden="true">*</span>
        </label>
        <TaxonomyInput
          id={id}
          name={p + "name"}
          defaultValue={row.name}
          ariaLabel="Skill / competency"
          ariaInvalid={!!error}
          ariaDescribedBy={error ? id + "-error" : undefined}
          ariaRequired
          maxLength={120}
          className="profile-v2-input"
          onValueChange={onChange}
        />
        {error && (
          <p id={id + "-error"} className="profile-v2-error">
            {error}
          </p>
        )}
      </div>
      <ProfileField
        name={p + "proficiency"}
        label="Proficiency"
        value={row.proficiency}
        errors={errors}
        kind="select"
        options={[
          "Beginner",
          "Intermediate",
          "Advanced",
          "Expert",
          "1 / 5",
          "2 / 5",
          "3 / 5",
          "4 / 5",
          "5 / 5",
        ]}
      />
      <ProfileField
        name={p + "experience_years"}
        label="Skill experience years"
        value={row.experience_years}
        errors={errors}
        kind="number"
      />
      <ProfileField
        name={p + "experience_months"}
        label="Skill experience months"
        value={row.experience_months}
        errors={errors}
        kind="number"
        hint="Whole months; 14 months is saved as 1 year, 2 months."
      />
      <ProfileField
        name={p + "version"}
        label="Version / level (optional)"
        value={row.version}
        errors={errors}
      />
      <ProfileField
        name={p + "last_used"}
        label="Last used"
        value={row.last_used}
        errors={errors}
        kind="select"
        options={yearOptions.filter(
          (y) => Number(y) <= new Date().getFullYear(),
        )}
      />
    </div>
  );
}
