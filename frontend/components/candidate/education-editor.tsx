import type { Education } from "@/lib/candidate";
import type { FieldErrors } from "@/lib/profile-validation";
import { ProfileField, yearOptions } from "./profile-fields";
export function EducationEditor({
  row,
  index,
  errors,
  reference = false,
}: {
  row: Education;
  index: number;
  errors: FieldErrors;
  reference?: boolean;
}) {
  const p = `education[${index}].`;
  return (
    <div className="profile-v2-form-grid">
      <ProfileField
        name={p + "level"}
        label="Education level"
        value={row.level ?? row.education}
        errors={errors}
        required
        kind={reference ? "select" : "text"}
        options={
          reference
            ? [
                "Doctorate/PhD",
                "Masters/Post-Graduation",
                "Graduation/Diploma",
                "12th",
                "10th",
                "Below 10th",
              ]
            : undefined
        }
      />
      <ProfileField
        name={p + "university"}
        label="University / institute"
        value={row.university}
        errors={errors}
        required
      />
      <ProfileField
        name={p + "course"}
        label="Course"
        value={row.course}
        errors={errors}
      />
      <ProfileField
        name={p + "specialization"}
        label="Specialization"
        value={row.specialization}
        errors={errors}
      />
      <ProfileField
        name={p + "course_type"}
        label="Course type"
        value={row.course_type}
        errors={errors}
        kind="select"
        options={["Full time", "Part time", "Correspondence/Distance learning"]}
      />
      <ProfileField
        name={p + "start_year"}
        label="Start year"
        value={row.start_year}
        errors={errors}
        kind="select"
        options={yearOptions}
      />
      <ProfileField
        name={p + "end_year"}
        label="End / expected graduation year"
        value={row.end_year}
        errors={errors}
        kind="select"
        options={yearOptions}
      />
      <ProfileField
        name={p + "grading_system"}
        label="Grading system"
        value={row.grading_system}
        errors={errors}
        kind="select"
        options={["Percentage", "CGPA / 10", "GPA / 4", "Letter grade"]}
      />
      <ProfileField
        name={p + "score"}
        label="Score / grade (optional)"
        value={row.score}
        errors={errors}
      />
    </div>
  );
}
