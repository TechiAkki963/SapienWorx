import { APIRequestError } from "./api";

export const jobParseFields = [
  ["title", "Job title", "text"], ["department", "Department or team", "text"],
  ["employment_type", "Employment type", "employment"], ["work_mode", "Workplace model", "work"],
  ["role_category", "Role or function", "text"], ["location", "Location", "text"],
  ["min_experience_years", "Minimum years", "number"], ["max_experience_years", "Maximum years", "number"],
  ["skills", "Required skills", "list"], ["description", "Role summary", "long"],
  ["responsibilities", "Responsibilities", "long"], ["company_overview", "Company overview", "long"],
  ["why_join", "Why join", "long"], ["hiring_process", "Hiring process", "list"],
  ["education_requirements", "Education requirements", "list"], ["openings", "Openings", "number"],
  ["min_salary_lakhs", "Minimum annual salary (INR lakhs)", "number"], ["max_salary_lakhs", "Maximum annual salary (INR lakhs)", "number"],
] as const;
export type JobParseKey = typeof jobParseFields[number][0];
export type ParseValue = string | number | string[] | null;
export type JobParseFields = Partial<Record<JobParseKey, ParseValue>>;
export type ParseMetadata = { provenance?: { source?: string; section?: string; reference?: string }; confidence?: number | null };
export type JobParseResponse = {
  id: string; revision: number; expires_at: string;
  result: { status: string; domain_valid: boolean; value: JobParseFields; field_metadata?: Record<string, ParseMetadata>; validation?: { issues?: { path: string; message: string }[] } };
};

export function parseDisplay(value: ParseValue | undefined) {
  return value == null ? "" : Array.isArray(value) ? value.join("\n") : String(value);
}

export function aiErrorMessage(error: unknown, fallback: string) {
  const message = error instanceof APIRequestError && error.status === 429
    ? "The AI usage limit has been reached. Continue manually and try again later."
    : error instanceof APIRequestError && error.status === 409
      ? "This proposal changed or expired. Review the latest version before applying it. Your saved data is unchanged."
      : fallback;
  return message + (error instanceof APIRequestError && error.requestId ? ` Reference: ${error.requestId}.` : "");
}
