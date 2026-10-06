// Field structure observed in the signed-in profile reference; no account values are retained.
export type ReferenceField = {
  key: string;
  label: string;
  kind?: "textarea" | "select" | "date" | "number";
  options?: string[];
  required?: boolean;
  max?: number;
};
export const accomplishmentSections = {
  awards: {
    title: "Award",
    key: "awards",
    fields: [
      { key: "title", label: "Award title", required: true, max: 240 },
      {
        key: "issuer",
        label: "Awarding organization",
        required: true,
        max: 240,
      },
      { key: "description", label: "Description", kind: "textarea", max: 4000 },
    ],
  },
  memberships: {
    title: "Professional membership",
    key: "professional_memberships",
    fields: [
      { key: "title", label: "Membership title", required: true, max: 240 },
      {
        key: "issuer",
        label: "Professional organization",
        required: true,
        max: 240,
      },
      { key: "description", label: "Description", kind: "textarea", max: 4000 },
    ],
  },
  onlineProfiles: {
    title: "Online profile",
    key: "professional_links",
    fields: [
      { key: "label", label: "Social profile", required: true },
      { key: "url", label: "URL", required: true },
      { key: "description", label: "Description", kind: "textarea", max: 500 },
    ],
  },
  workSamples: {
    title: "Work sample",
    key: "work_samples",
    fields: [
      { key: "title", label: "Work title", required: true },
      { key: "url", label: "URL", required: true },
      { key: "description", label: "Description", kind: "textarea", max: 500 },
    ],
  },
  publications: {
    title: "White paper / Research publication / Journal entry",
    key: "publications",
    fields: [
      { key: "title", label: "Title", required: true },
      { key: "url", label: "URL", required: true },
      { key: "description", label: "Description", kind: "textarea", max: 500 },
    ],
  },
  presentations: {
    title: "Presentation",
    key: "presentations",
    fields: [
      { key: "title", label: "Title", required: true },
      { key: "url", label: "URL", required: true },
      { key: "description", label: "Description", kind: "textarea", max: 500 },
    ],
  },
  patents: {
    title: "Patent",
    key: "patents",
    fields: [
      { key: "title", label: "Patent title", required: true },
      { key: "url", label: "URL", required: true },
      { key: "patent_office", label: "Patent office" },
      {
        key: "status",
        label: "Status",
        kind: "select",
        options: ["Patent issued", "Patent pending"],
      },
      { key: "application_number", label: "Application number" },
      { key: "description", label: "Description", kind: "textarea", max: 500 },
    ],
  },
  certifications: {
    title: "Certification",
    key: "certifications",
    fields: [
      { key: "title", label: "Certification name", required: true },
      { key: "completion_id", label: "Certification completion ID" },
      { key: "url", label: "Certification URL" },
      { key: "issuer", label: "Certification provider (optional)" },
    ],
  },
} satisfies Record<
  string,
  { title: string; key: string; fields: ReferenceField[] }
>;
export type AccomplishmentSection = keyof typeof accomplishmentSections;
export const careerFields: ReferenceField[] = [
  {
    key: "preferred_work_mode",
    label: "Preferred work mode",
    kind: "select",
    options: ["Onsite", "Hybrid", "Remote", "Flexible"],
  },
  { key: "industry", label: "Current industry" },
  { key: "department_role", label: "Department" },
  { key: "role_category", label: "Role category" },
  { key: "job_role", label: "Job role" },
  { key: "preferred_job_roles", label: "Preferred job role (Max 3)" },
  { key: "preferred_locations", label: "Preferred work location (Max 10)" },
  {
    key: "preferred_shift",
    label: "Preferred shift",
    kind: "select",
    options: ["Day", "Night", "Flexible"],
  },
];
export const referenceRecordKeys = {
  project: "projects",
  ...Object.fromEntries(
    Object.entries(accomplishmentSections).map(([section, definition]) => [
      section,
      definition.key,
    ]),
  ),
} as Record<string, string>;
export const referenceDetailKeys: Record<string, string[]> = {
  intro: [
    "work_status",
    "locality",
    "salary_breakdown",
    "fixed_salary",
    "variable_salary",
  ],
  keyskills: ["key_skills"],
  personal: [
    "gender",
    "marital_status",
    "date_of_birth",
    "category",
    "more_information",
    "permanent_address",
    "hometown",
    "pincode",
    "usa_work_authorization",
    "other_work_permits",
  ],
  diversity: [
    "disability_status",
    "disability_details",
    "disability_type",
    "disability_percentage",
    "disability_reason",
    "disability_certificate",
    "military_experience",
    "military_service_type",
    "military_enrolment_date",
    "military_discharge_date",
    "military_service_number",
    "career_break",
    "career_break_reason",
    "career_break_start_year",
    "career_break_start_month",
    "career_break_end_year",
    "career_break_end_month",
    "currently_on_break",
  ],
};
