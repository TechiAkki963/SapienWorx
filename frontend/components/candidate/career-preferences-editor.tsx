import type {
  CandidateDetails,
  CandidateProfile,
  CandidateProfileDetails,
} from "@/lib/candidate";
import { profileContract, type FieldErrors } from "@/lib/profile-validation";
import { ProfileField } from "./profile-fields";
import { careerFields } from "./profile-reference-schema";
import { ProfileChoiceGroup } from "./profile-reference-fields";
import { SalaryUnitFields } from "./salary-unit-fields";
export function CareerPreferencesEditor({
  profile,
  extended,
  errors,
}: {
  profile: CandidateProfile;
  extended: CandidateProfileDetails;
  errors: FieldErrors;
}) {
  const d = extended.details;
  return (
    <div className="grid gap-5">
      <div className="profile-v2-form-grid">
        {careerFields
          .filter(
            (f) =>
              !["industry", "department_role", "preferred_locations"].includes(
                f.key,
              ),
          )
          .map((f) => (
            <ProfileField
              key={f.key}
              name={f.key}
              label={f.label}
              value={String(d[f.key] ?? "")}
              errors={errors}
              kind={f.kind}
              options={f.options}
            />
          ))}
        <ProfileField
          name="preferred_locations"
          label="Preferred locations"
          value={d.preferred_locations}
          errors={errors}
        />
        <ProfileField
          name="notice_period_days"
          label="Notice period (days)"
          value={profile.notice_period_days}
          errors={errors}
          kind="number"
        />
        <ProfileField
          name="department_role"
          label="Department and role"
          value={d.department_role}
          errors={errors}
        />
        <ProfileField
          name="industry"
          label="Industry"
          value={d.industry}
          errors={errors}
        />
      </div>
      <ProfileChoiceGroup
        name="desired_job_type"
        label="Desired job type"
        value={d.desired_job_type}
        options={["Permanent", "Contractual"]}
        multiple
      />
      <ProfileChoiceGroup
        name="desired_employment_type"
        label="Desired employment type"
        value={d.desired_employment_type}
        options={["Full time", "Part time"]}
        multiple
      />
      <section className="profile-v2-private">
        <h3>🔒 Private compensation</h3>
        <p>
          Only visible to you. Excluded from your public profile and recruiter
          profile APIs.
        </p>
        <div className="profile-v2-form-grid">
          {(["current", "expected"] as const).map((k) => (
            <div key={k} className="grid gap-3">
              <SalaryUnitFields
                kind={k}
                annualAmount={
                  extended[
                    (k + "_salary_amount") as keyof CandidateProfileDetails
                  ] as number | undefined
                }
                initialUnit={String(d[k + "_salary_unit"] || "Annual")}
                errors={errors}
              />
              <ProfileField
                name={k + "_salary_currency"}
                label={
                  k === "current"
                    ? "Current salary currency"
                    : "Expected salary currency"
                }
                value={
                  extended[
                    (k + "_salary_currency") as keyof CandidateProfileDetails
                  ] as string
                }
                errors={errors}
                kind="select"
                options={profileContract.currencies}
              />
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
export const preferenceKeys: (keyof CandidateDetails)[] = [
  "preferred_locations",
  "department_role",
  "industry",
  "role_category",
  "job_role",
  "preferred_job_roles",
  "preferred_shift",
  "desired_job_type",
  "desired_employment_type",
  "preferred_work_mode",
  "current_salary_unit",
  "expected_salary_unit",
];
