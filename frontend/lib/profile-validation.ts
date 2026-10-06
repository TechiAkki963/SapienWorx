import contract from "./profile-contract.json";
import { validateReferenceDetails } from "./profile-reference-validation";
import type {
  CandidateDetails,
  CandidateProfile,
  CandidateProfileDetails,
  Employment,
} from "./candidate";
export const profileContract = contract;
export const countries = contract.countries.split(" ");
export type FieldErrors = Record<string, string>;
export function textLength(value: string) {
  return [...value].length;
}
export function validateProfile(
  profile: Pick<
    CandidateProfile,
    | "full_name"
    | "headline"
    | "country_code"
    | "current_city"
    | "current_state"
    | "total_experience_months"
    | "notice_period_days"
  >,
): FieldErrors {
  const errors: FieldErrors = {};
  for (const [key, max] of Object.entries({
    full_name: 160,
    headline: 240,
    current_city: 120,
    current_state: 120,
  })) {
    const value = String(profile[key as keyof typeof profile] ?? "").trim();
    if (key === "full_name" && !value) errors[key] = "This field is required.";
    else if (textLength(value) > max)
      errors[key] = `Use ${max} characters or fewer.`;
  }
  if (!countries.includes(profile.country_code.trim().toUpperCase()))
    errors.country_code = "Select a valid country.";
  if (
    !Number.isInteger(profile.total_experience_months) ||
    profile.total_experience_months < 0 ||
    profile.total_experience_months > 960
  )
    errors.total_experience_months =
      "Use an experience value between 0 and 960 months.";
  if (
    profile.notice_period_days != null &&
    (!Number.isInteger(profile.notice_period_days) ||
      profile.notice_period_days < 0 ||
      profile.notice_period_days > 730)
  )
    errors.notice_period_days = "Use a notice period between 0 and 730 days.";
  return errors;
}
export function monthNumber(value: unknown) {
  const v = String(value ?? "");
  const n = Number(v);
  if (Number.isInteger(n) && n >= 1 && n <= 12) return n - 1;
  return contract.months.findIndex(
    (m) => m.toLowerCase() === v.slice(0, 3).toLowerCase(),
  );
}
export function employmentMonth(row: Employment, end = false) {
  const year = Number(end ? row.end_year : row.joining_year);
  const month = monthNumber(end ? row.end_month : row.joining_month);
  return Number.isInteger(year) && year >= 1900 && year <= 2100 && month >= 0
    ? year * 12 + month
    : null;
}
export function calculatedExperience(
  rows: Employment[] | undefined,
  now = new Date(),
): number | null {
  if (!rows?.length) return null;
  const covered = new Set<number>();
  for (const row of rows) {
    const start = employmentMonth(row);
    const end = ["yes", "true"].includes(
      String(row.current_company).toLowerCase(),
    )
      ? now.getFullYear() * 12 + now.getMonth()
      : employmentMonth(row, true);
    if (start === null || end === null || end < start) return null;
    for (let m = start; m < end; m++) covered.add(m);
  }
  return covered.size;
}
export function experienceText(months: number) {
  const y = Math.floor(months / 12),
    m = months % 12;
  return y
    ? `${y} year${y === 1 ? "" : "s"}${m ? ` ${m} month${m === 1 ? "" : "s"}` : ""}`
    : `${m} month${m === 1 ? "" : "s"}`;
}
export function validateDetails(
  details: CandidateDetails,
  salary?: Pick<
    CandidateProfileDetails,
    | "current_salary_amount"
    | "expected_salary_amount"
    | "current_salary_currency"
    | "expected_salary_currency"
  >,
  previous: CandidateDetails = {},
): FieldErrors {
  details = Object.fromEntries(
    Object.entries(details).filter(
      ([key, value]) => JSON.stringify(value) !== JSON.stringify(previous[key]),
    ),
  );
  const errors: FieldErrors = {};
  const now = new Date();
  const present = now.getFullYear() * 12 + now.getMonth();
  for (const [key, value] of Object.entries(details)) {
    if (typeof value === "string") {
      const max = [
        "professional_summary",
        "employment_highlights",
        "projects",
        "accomplishments",
        "professional_links",
        "disability_details",
        "career_break",
        "military_experience",
        "permanent_address",
      ].includes(key)
        ? 5000
        : 240;
      if (textLength(value) > max)
        errors[key] = `Use ${max} characters or fewer.`;
    }
  }
  if (salary) {
    for (const key of [
      "current_salary_amount",
      "expected_salary_amount",
    ] as const) {
      const v = salary[key];
      if (
        v != null &&
        (!Number.isFinite(v) || v < 0 || v > contract.limits.max_salary)
      )
        errors[key] = "Enter a non-negative salary within the supported range.";
    }
    for (const key of [
      "current_salary_currency",
      "expected_salary_currency",
    ] as const)
      if (!contract.currencies.includes(salary[key]))
        errors[key] = "Select a supported currency.";
  }
  const validLink = (link: string) => {
    try {
      const u = new URL(link);
      return (
        u.protocol === "https:" && !!u.hostname && !u.username && !u.password
      );
    } catch {
      return false;
    }
  };
  if (typeof details.professional_links === "string") {
    const links = details.professional_links
      .split(/[\n,]+/)
      .map((v) => v.trim())
      .filter(Boolean);
    if (links.length > 20)
      errors.professional_links = "Add no more than 20 links.";
    if (links.some((link) => !validLink(link)))
      errors.professional_links =
        "Use HTTPS links without embedded credentials.";
  }
  for (const key of [
    "projects",
    "accomplishments",
    "professional_links",
  ] as const) {
    const records = details[key];
    if (!Array.isArray(records)) continue;
    if (records.length > 20) errors[key] = "Add no more than 20 entries.";
    records.forEach((row, i) => {
      const oldRecords = previous[key];
      if (
        Array.isArray(oldRecords) &&
        oldRecords.some((old) => JSON.stringify(old) === JSON.stringify(row))
      )
        return;
      const prefix = `${key}[${i}].`;
      for (const [k, v] of Object.entries(row)) {
        if (
          typeof v === "string" &&
          textLength(v) >
            (k === "description" ? 5000 : k === "skills" ? 500 : 240)
        )
          errors[prefix + k] = "This value is too long.";
      }
      if (key === "professional_links") {
        if (!row.url || !validLink(row.url))
          errors[prefix + "url"] =
            "Use an HTTPS link without embedded credentials.";
      } else if (!row.title?.trim())
        errors[prefix + "title"] = "This field is required.";
      if (row.url && !validLink(row.url))
        errors[prefix + "url"] =
          "Use an HTTPS link without embedded credentials.";
    });
  }
  if (details.date_of_birth) {
    const d = new Date(details.date_of_birth + "T00:00:00Z");
    if (
      !/^\d{4}-\d{2}-\d{2}$/.test(details.date_of_birth) ||
      !Number.isFinite(+d) ||
      d.toISOString().slice(0, 10) !== details.date_of_birth ||
      d > now ||
      d.getUTCFullYear() < 1900
    )
      errors.date_of_birth = "Use a valid birth date in the past.";
  }
  if (
    details.pincode &&
    !/^[\p{L}\p{N}][\p{L}\p{N} -]{1,15}$/u.test(details.pincode)
  )
    errors.pincode =
      "Use a valid postal code (2–16 letters, digits, spaces or hyphens).";
  if (
    details.secondary_phone &&
    !/^\+[1-9][0-9]{7,14}$/.test(String(details.secondary_phone))
  )
    errors.secondary_phone = "Use international E.164 format.";
  for (const key of [
    "employment",
    "education",
    "it_skills",
    "languages",
  ] as const) {
    const rows = details[key];
    if (!rows) continue;
    if (rows.length > contract.limits[key])
      errors[key] = `Add no more than ${contract.limits[key]} items.`;
  }
  for (const key of [
    "employment",
    "education",
    "it_skills",
    "languages",
  ] as const) {
    details[key]?.forEach((row, i) => {
      if (
        previous[key]?.some(
          (old) => JSON.stringify(old) === JSON.stringify(row),
        )
      )
        return;
      for (const [name, value] of Object.entries(row)) {
        const max =
          name === "job_profile"
            ? 5000
            : name === "achievements"
              ? 4000
              : name === "location"
                ? 120
                : name === "name" || name === "language"
                  ? 120
                  : 240;
        if (typeof value === "string" && textLength(value) > max)
          errors[`${key}[${i}].${name}`] = `Use ${max} characters or fewer.`;
      }
      if (
        key === "languages" &&
        !String((row as { language?: string }).language ?? "").trim()
      )
        errors[`languages[${i}].language`] = "This field is required.";
    });
  }
  details.employment?.forEach((row, i) => {
    if (
      previous.employment?.some(
        (old) => JSON.stringify(old) === JSON.stringify(row),
      )
    )
      return;
    const prefix = `employment[${i}].`;
    if (!row.company?.trim())
      errors[prefix + "company"] = "This field is required.";
    if (!row.job_title?.trim())
      errors[prefix + "job_title"] = "This field is required.";
    const start = employmentMonth(row),
      end = employmentMonth(row, true),
      current = ["yes", "true"].includes(
        String(row.current_company).toLowerCase(),
      );
    if (start === null)
      errors[prefix + "joining_month"] = "Select a valid start month and year.";
    else if (start > present)
      errors[prefix + "joining_month"] = "Start date cannot be in the future.";
    if (current) {
      if (row.end_month || row.end_year)
        errors[prefix + "end_month"] =
          "A current role cannot have an end date.";
    } else if (end === null)
      errors[prefix + "end_month"] = "Select a valid end month and year.";
    else if (start !== null && start > end)
      errors[prefix + "joining_month"] = "Start date cannot be after end date.";
    else if (end > present)
      errors[prefix + "end_month"] = "End date cannot be in the future.";
    if (
      row.current_salary &&
      (!Number.isFinite(Number(row.current_salary)) ||
        Number(row.current_salary) < 0)
    )
      errors[prefix + "current_salary"] = "Enter a non-negative salary.";
  });
  details.education?.forEach((row, i) => {
    if (
      previous.education?.some(
        (old) => JSON.stringify(old) === JSON.stringify(row),
      )
    )
      return;
    const prefix = `education[${i}].`;
    if (!row.level?.trim())
      errors[prefix + "level"] = "This field is required.";
    if (!row.university?.trim())
      errors[prefix + "university"] = "This field is required.";
    for (const key of ["start_year", "end_year"] as const)
      if (
        row[key] &&
        (!/^\d{4}$/.test(row[key]!) ||
          Number(row[key]) < 1900 ||
          Number(row[key]) > 2100)
      )
        errors[prefix + key] = "Select a valid year.";
    if (
      row.start_year &&
      row.end_year &&
      Number(row.start_year) > Number(row.end_year)
    )
      errors[prefix + "start_year"] = "Start year cannot be after end year.";
    if (row.score) {
      const system = row.grading_system?.toLowerCase() ?? "",
        max = system.includes("10") ? 10 : system.includes("4") ? 4 : 100;
      if (system === "letter grade") {
        if (!/^[A-F][+-]?$/i.test(row.score))
          errors[prefix + "score"] = "Use a letter grade from A to F.";
      } else {
        const n = Number(row.score.replace(/%$/, ""));
        if (!Number.isFinite(n) || n < 0 || n > max)
          errors[prefix + "score"] = `Enter a score between 0 and ${max}.`;
      }
    }
  });
  details.it_skills?.forEach((row, i) => {
    if (
      previous.it_skills?.some(
        (old) => JSON.stringify(old) === JSON.stringify(row),
      )
    )
      return;
    const prefix = `it_skills[${i}].`;
    if (!row.name?.trim()) errors[prefix + "name"] = "This field is required.";
    for (const key of ["experience_years", "experience_months"] as const) {
      const n = Number(row[key] ?? 0);
      if (!Number.isInteger(n) || n < 0 || n > 960)
        errors[prefix + key] = "Use a non-negative whole number.";
    }
    if (
      Number(row.experience_years ?? 0) * 12 +
        Number(row.experience_months ?? 0) >
      960
    )
      errors[prefix + "experience_months"] =
        "Use no more than 960 months of experience.";
    if (
      row.last_used &&
      (!/^\d{4}$/.test(row.last_used) ||
        Number(row.last_used) < 1900 ||
        Number(row.last_used) > now.getFullYear())
    )
      errors[prefix + "last_used"] =
        "Select a valid year in the past or present.";
  });
  return { ...errors, ...validateReferenceDetails(details, previous) };
}
