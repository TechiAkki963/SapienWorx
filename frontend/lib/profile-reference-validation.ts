import type { CandidateDetails, ProfessionalRecord } from "./candidate";
import type { FieldErrors } from "./profile-validation";
import contract from "./profile-contract.json";
const textLength = (value: string) => [...value].length;
const monthNumber = (value: unknown) => {
  const n = Number(value);
  return Number.isInteger(n) && n >= 1 && n <= 12
    ? n - 1
    : contract.months.findIndex(
        (m) =>
          m.toLowerCase() ===
          String(value ?? "")
            .slice(0, 3)
            .toLowerCase(),
      );
};
export function validateReferenceDetails(
  details: CandidateDetails,
  previous: CandidateDetails = {},
): FieldErrors {
  const errors: FieldErrors = {};
  const now = new Date();
  const present = now.getUTCFullYear() * 12 + now.getUTCMonth();
  const unchanged = (key: string) =>
    JSON.stringify(details[key]) === JSON.stringify(previous[key]);
  const merged = { ...previous, ...details };
  const changedPrefix = (prefix: string) =>
    Object.keys(details).some(
      (key) => key.startsWith(prefix) && !unchanged(key),
    );
  const validURL = (v: unknown) => {
    try {
      const u = new URL(String(v));
      return (
        u.protocol === "https:" && !!u.hostname && !u.username && !u.password
      );
    } catch {
      return false;
    }
  };
  for (const [key, choices] of Object.entries({
    preferred_work_mode: ["Onsite", "Hybrid", "Remote", "Flexible"],
    current_salary_unit: ["Annual", "Monthly"],
    expected_salary_unit: ["Annual", "Monthly"],
  })) {
    if (
      key in details &&
      !unchanged(key) &&
      !(key === "preferred_work_mode" && details[key] === "") &&
      !choices.includes(String(details[key]))
    )
      errors[key] = "Select a supported option.";
  }
  for (const key of [
    "key_skills",
    "desired_job_type",
    "desired_employment_type",
  ]) {
    if (!(key in details) || unchanged(key)) continue;
    const list = details[key];
    if (!Array.isArray(list) || list.length > (key === "key_skills" ? 50 : 20))
      errors[key] = "Too many choices.";
    else if (key === "key_skills" && !list.length)
      errors[key] = "Add at least one skill.";
    else if (
      list.some(
        (v) => typeof v !== "string" || !v.trim() || textLength(v) > 120,
      )
    )
      errors[key] = "Use non-empty text choices of 120 characters or fewer.";
  }
  for (const [key, max] of [
    ["preferred_job_roles", 3],
    ["preferred_locations", 10],
  ] as const) {
    if (
      !unchanged(key) &&
      typeof details[key] === "string" &&
      String(details[key]).split(",").length > max
    )
      errors[key] = `Select no more than ${max} values.`;
  }
  for (const key of [
    "fixed_salary",
    "variable_salary",
    "disability_percentage",
  ]) {
    if (!(key in details) || unchanged(key) || details[key] === "") continue;
    const n = Number(details[key]);
    if (
      !Number.isFinite(n) ||
      n < 0 ||
      n > (key === "disability_percentage" ? 100 : 999999999999.99)
    )
      errors[key] = "Enter a non-negative value within the supported range.";
  }
  for (const key of ["military_enrolment_date", "military_discharge_date"]) {
    if (!details[key] || unchanged(key)) continue;
    const v = String(details[key]);
    const d = new Date(v + "T00:00:00Z");
    if (
      !/^\d{4}-\d{2}-\d{2}$/.test(v) ||
      !Number.isFinite(+d) ||
      d.toISOString().slice(0, 10) !== v ||
      d > now ||
      d.getUTCFullYear() < 1900
    )
      errors[key] = "Use a valid date in the past.";
  }
  for (const key of [
    "projects",
    "project_records",
    "professional_links",
    "online_profiles",
    "work_samples",
    "publications",
    "presentations",
    "patents",
    "certifications",
    "awards",
    "professional_memberships",
  ]) {
    if (
      !(key in details) ||
      unchanged(key) ||
      (["projects", "professional_links"].includes(key) &&
        typeof details[key] === "string")
    )
      continue;
    const rows = details[key];
    if (!Array.isArray(rows) || rows.length > 20) {
      errors[key] = "Use a list with no more than 20 entries.";
      continue;
    }
    rows.forEach((unknownRow, i) => {
      const old = previous[key];
      if (
        Array.isArray(old) &&
        old.some((r) => JSON.stringify(r) === JSON.stringify(unknownRow))
      )
        return;
      const r = unknownRow as ProfessionalRecord,
        p = `${key}[${i}].`;
      if (!r || typeof r !== "object" || Array.isArray(r)) {
        errors[key] = "Use valid professional entries.";
        return;
      }
      if (
        !["professional_links", "online_profiles"].includes(key) &&
        !String(r.title ?? "").trim()
      )
        errors[p + "title"] = "This field is required.";
      if (key === "online_profiles" && !String(r.label ?? "").trim())
        errors[p + "label"] = "This field is required.";
      if (
        ["awards", "professional_memberships"].includes(key) &&
        !String(r.issuer ?? "").trim()
      )
        errors[p + "issuer"] = "This field is required.";
      if (
        key === "professional_memberships" &&
        !["Yes", "No"].includes(String(r.current))
      )
        errors[p + "current"] = "Select whether this membership is current.";
      if (
        ([
          "professional_links",
          "online_profiles",
          "work_samples",
          "publications",
          "presentations",
          "patents",
        ].includes(key) &&
          !validURL(r.url)) ||
        (r.url && !validURL(r.url))
      )
        errors[p + "url"] = "Use an HTTPS link without embedded credentials.";
      for (const [name, v] of Object.entries(r)) {
        if (
          typeof v === "string" &&
          textLength(v) >
            (name === "description"
              ? ["awards", "professional_memberships"].includes(key)
                ? 4000
                : 5000
              : name === "skills"
                ? 500
                : name === "role_description"
                  ? 250
                  : 240)
        )
          errors[p + name] = "This value is too long.";
      }
      const date = (prefix: string) => {
        const y = Number(r[prefix + "_year"]),
          m = monthNumber(r[prefix + "_month"]);
        return Number.isInteger(y) && y >= 1900 && y <= 2100 && m >= 0
          ? y * 12 + m
          : null;
      };
      for (const prefix of ["start", "end", "published", "issued"]) {
        if (!r[prefix + "_year"] && !r[prefix + "_month"]) continue;
        const n = date(prefix);
        if (n == null)
          errors[p + prefix + "_month"] = "Select a valid month and year.";
        else if (prefix !== "end" && n > present)
          errors[p + prefix + "_month"] = "Date cannot be in the future.";
      }
      const start = date("start"),
        end = date("end");
      if (start != null && end != null && start > end)
        errors[p + "start_month"] = "Start date cannot be after end date.";
      if (
        (r.status === "In progress" ||
          r.current === "Yes" ||
          r.no_expiry === "Yes") &&
        (r.end_year || r.end_month)
      )
        errors[p + "end_month"] = "An ongoing item cannot have an end date.";
      if (["projects", "project_records"].includes(key) && "status" in r) {
        if (!String(r.client ?? "").trim())
          errors[p + "client"] = "This field is required.";
        if (!r.description?.trim() || textLength(r.description) > 1000)
          errors[p + "description"] =
            "Enter project details within 1000 characters.";
        if (date("start") == null)
          errors[p + "start_month"] = "Select a valid month and year.";
        if (r.status === "Finished" && date("end") == null)
          errors[p + "end_month"] = "Select a valid month and year.";
      }
      if (
        r.team_size &&
        (!Number.isInteger(Number(r.team_size)) ||
          Number(r.team_size) < 1 ||
          Number(r.team_size) > 100000)
      )
        errors[p + "team_size"] =
          "Enter a whole team size between 1 and 100000.";
    });
  }
  if (
    !unchanged("other_work_permits") &&
    typeof details.other_work_permits === "string" &&
    details.other_work_permits.split(",").length > 3
  )
    errors.other_work_permits = "Choose no more than 3 countries.";
  if (
    changedPrefix("disability_") &&
    merged.disability_status === "Have disability"
  )
    for (const key of [
      "disability_type",
      "disability_percentage",
      "disability_reason",
    ])
      if (!String(merged[key] ?? "").trim())
        errors[key] = "This field is required.";
  if (
    changedPrefix("military_") &&
    ["Currently serving", "Previously served"].includes(
      String(merged.military_experience),
    ) &&
    !String(merged.military_service_type ?? "").trim()
  )
    errors.military_service_type = "This field is required.";
  if (
    changedPrefix("military_") &&
    merged.military_enrolment_date &&
    merged.military_discharge_date &&
    String(merged.military_enrolment_date) >
      String(merged.military_discharge_date)
  )
    errors.military_enrolment_date =
      "Enrolment date cannot be after discharge date.";
  if (
    (changedPrefix("career_break") || changedPrefix("currently_on_break")) &&
    merged.career_break === "Have taken"
  ) {
    if (!String(merged.career_break_reason ?? "").trim())
      errors.career_break_reason = "This field is required.";
    const date = (prefix: string) => {
      const y = Number(merged[prefix + "_year"]),
        m = monthNumber(merged[prefix + "_month"]);
      return Number.isInteger(y) && y >= 1900 && y <= 2100 && m >= 0
        ? y * 12 + m
        : null;
    };
    const start = date("career_break_start"),
      end = date("career_break_end");
    if (start == null || start > present)
      errors.career_break_start_month =
        "Select a valid month and year in the past.";
    if (merged.currently_on_break !== "Yes") {
      if (end == null || end > present)
        errors.career_break_end_month =
          "Select a valid month and year in the past.";
      else if (start != null && start > end)
        errors.career_break_start_month =
          "Start date cannot be after end date.";
    }
  }
  return errors;
}
