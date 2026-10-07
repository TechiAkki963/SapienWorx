export type DiscoveryValues = Record<string, string>;
export type DiscoveryCandidate = {
  id: string; full_name: string; headline?: string; designation: string; current_company: string;
  current_city?: string; current_state?: string; experience_months: number; notice_period_days?: number;
  preferred_locations: string; skills: string[]; education: string; updated_at: string; last_active_at?: string;
  email_verified?: boolean; mobile_verified?: boolean;
};
export type DiscoveryResults = { items: DiscoveryCandidate[]; page: number; limit: number; total: number };
export type SearchRecord = { id: string | number; name?: string; filters: DiscoveryValues; created_at?: string; updated_at?: string; alert_enabled?: boolean; alert_frequency?: string };
export type DiscoveryField = { key: string; label: string; type?: "number" | "date" | "check" | "select" | "chips"; options?: [string, string][]; taxonomy?: string[]; hint?: string; disabled?: boolean };
export type DiscoverySection = { id: string; title: string; open?: boolean; description?: string; fields: DiscoveryField[] };
const scope = [["current", "Current"], ["previous", "Previous"], ["any", "Any employment"]] as [string, string][];
const degree = [["any", "Any qualification"], ["specific", "Specific qualification"], ["none", "No qualification"]] as [string, string][];
export const discoverySections: DiscoverySection[] = [
  { id: "keywords", title: "Keywords & skills", open: true, fields: [
    { key: "q", label: "Keywords", hint: "Separate terms with commas. Boolean mode supports AND, OR, NOT, quotes and parentheses." },
    { key: "keyword_mode", label: "Keyword mode", type: "select", options: [["any", "Any keyword"], ["all", "All keywords are mandatory"], ["boolean", "Boolean search"]] },
    { key: "keyword_scope", label: "Search keywords in", type: "select", options: [["entire_profile", "Entire professional profile"], ["current_role", "Current role"], ["work_experience", "Work experience"], ["skills", "Skills"], ["current_company", "Current company"], ["previous_company", "Previous companies"], ["education", "Education"], ["certifications", "Certifications"]] },
    { key: "excluded_keywords", label: "Excluded keywords", type: "chips" },
    { key: "skills", label: "Required skills", type: "chips", taxonomy: ["skill", "competency", "tool", "technology", "equipment", "methodology"] },
    { key: "preferred_skills", label: "Preferred skills", type: "chips", taxonomy: ["skill", "competency", "tool", "technology"] },
    { key: "optional_skills", label: "Optional skills", type: "chips", taxonomy: ["skill", "competency", "tool", "technology"] },
  ] },
  { id: "experience", title: "Experience & location", open: true, fields: [
    { key: "min_experience", label: "Minimum experience (years)", type: "number" },
    { key: "max_experience", label: "Maximum experience (years)", type: "number" },
    { key: "location", label: "Current locations", type: "chips", taxonomy: ["location", "city", "state", "country"] },
    { key: "preferred_location", label: "Preferred locations", type: "chips", taxonomy: ["location", "city", "state", "country"] },
    { key: "include_relocation", label: "Include candidates willing to relocate to selected locations", type: "check" },
    { key: "exclude_unspecified_location", label: "Exclude anywhere or unspecified preferences", type: "check" },
  ] },
  { id: "employment", title: "Employment details", fields: [
    { key: "functional_area", label: "Department & role", type: "chips", taxonomy: ["functional_area", "job_family", "occupation"] },
    { key: "industry", label: "Industry", type: "chips", taxonomy: ["industry", "sector"] },
    { key: "current_company", label: "Company", type: "chips" },
    { key: "company_scope", label: "Search companies in", type: "select", options: scope },
    { key: "previous_company", label: "Previous company", type: "chips" },
    { key: "excluded_companies", label: "Excluded companies", type: "chips" },
    { key: "designation", label: "Designation", type: "chips", taxonomy: ["occupation", "job_family"] },
    { key: "designation_scope", label: "Search designations in", type: "select", options: scope },
  ] },
  { id: "availability", title: "Availability & work preferences", fields: [
    { key: "max_notice_days", label: "Notice period", type: "select", options: [["", "Any notice period"], ["0", "Immediate joiner"], ["15", "0–15 days"], ["30", "Within 1 month"], ["60", "Within 2 months"], ["90", "Within 3 months"], ["3650", "Any known notice period"]] },
    { key: "availability", label: "Availability", hint: "Filter the availability candidates have supplied." },
    { key: "employment_type", label: "Employment type", type: "select", options: [["", "Any"], ...["Full time", "Part time", "Contract", "Temporary", "Internship", "Consultant", "Freelance"].map(v => [v, v] as [string, string])] },
    { key: "job_type", label: "Desired job type", type: "select", options: [["", "Any"], ...["Permanent", "Contractual", "Temporary", "Freelance", "Internship", "Apprenticeship"].map(v => [v, v] as [string, string])] },
    { key: "work_mode", label: "Work mode", type: "select", options: [["", "Any"], ...["On-site", "Hybrid", "Remote", "Flexible"].map(v => [v, v] as [string, string])] },
  ] },
  { id: "education", title: "Education & qualifications", fields: [
    { key: "ug_mode", label: "UG qualification", type: "select", options: degree },
    { key: "ug_qualification", label: "Specific UG qualification", taxonomy: ["qualification"] },
    { key: "pg_mode", label: "PG qualification", type: "select", options: degree },
    { key: "pg_qualification", label: "Specific PG qualification", taxonomy: ["qualification"] },
    { key: "doctorate", label: "Doctorate / additional qualification", taxonomy: ["qualification"] },
    { key: "education", label: "Education keywords", taxonomy: ["qualification"] },
    { key: "certifications", label: "Certifications / licences", type: "chips", taxonomy: ["certification", "licence"] },
    { key: "languages", label: "Languages", type: "chips", taxonomy: ["language"] },
  ] },
  { id: "activity", title: "Profile activity", fields: [
    { key: "profile_activity", label: "Candidate activity", type: "select", options: [["all", "All candidates"], ["new", "New candidates"], ["updated", "Recently updated"]] },
    { key: "active_within_days", label: "Active within", type: "select", options: [["", "Any time"], ["1", "24 hours"], ["3", "3 days"], ["7", "7 days"], ["15", "15 days"], ["30", "30 days"], ["90", "3 months"], ["180", "6 months"]] },
    { key: "updated_since", label: "Updated since", type: "date" },
    { key: "verified_mobile", label: "Verified mobile number", type: "check" },
    { key: "verified_email", label: "Verified email", type: "check" },
    { key: "resume_available", label: "CV / resume available", type: "check" },
    { key: "min_completeness", label: "Profile completeness", type: "select", options: [["", "Any"], ["50", "50%+"], ["70", "70%+"], ["90", "90%+"]] },
  ] },
  { id: "compensation", title: "Annual compensation", description: "Candidate compensation is private under the current profile policy. Compensation filtering remains unavailable; it cannot be inferred through search results.", fields: [
    { key: "salary_kind", label: "Compensation basis", type: "select", options: [["current", "Current"], ["expected", "Expected"]], disabled: true },
    { key: "currency", label: "Currency", type: "select", options: [["INR", "INR / year"], ["USD", "USD / year"], ["GBP", "GBP / year"], ["EUR", "EUR / year"]], disabled: true },
    { key: "min_salary", label: "Minimum annual compensation", type: "number", disabled: true },
    { key: "max_salary", label: "Maximum annual compensation", type: "number", disabled: true },
    { key: "include_salary_unspecified", label: "Include unspecified compensation", type: "check", disabled: true },
  ] },
  { id: "inclusive", title: "Inclusive hiring", description: "Protected attributes require a reviewed jurisdiction, tenant programme and role permission. No programme is enabled. These attributes never contribute to general match ranking.", fields: [
    { key: "gender", label: "Gender", disabled: true }, { key: "disability", label: "Disability / accessibility programme", disabled: true },
    { key: "defence_background", label: "Defence / veteran programme", disabled: true }, { key: "career_break", label: "Returnship programme", disabled: true },
    { key: "min_age", label: "Minimum age", type: "number", disabled: true }, { key: "max_age", label: "Maximum age", type: "number", disabled: true },
  ] },
  { id: "additional", title: "Additional details", description: "Work-authorization and category filters need an approved candidate-sharing policy and a defined category taxonomy before activation.", fields: [
    { key: "work_authorizations", label: "Work permit / authorization", disabled: true }, { key: "candidate_categories", label: "Candidate category", disabled: true },
  ] },
];
export const discoveryDefaults: DiscoveryValues = { keyword_mode: "any", keyword_scope: "entire_profile", company_scope: "current", designation_scope: "current", ug_mode: "any", pg_mode: "any", profile_activity: "all", sort: "recently_updated", page_size: "25" };
export const discoveryFieldMap = Object.fromEntries(discoverySections.flatMap(section => section.fields).map(field => [field.key, field]));
export function cleanDiscovery(values: DiscoveryValues): DiscoveryValues {
  return Object.fromEntries(Object.entries(values).filter(([key, value]) => typeof value === "string" && value.trim() && (discoveryFieldMap[key] || ["sort", "page", "page_size", "client_company_id"].includes(key)) && !discoveryFieldMap[key]?.disabled).map(([key, value]) => [key, value.trim()]));
}
export function activeDiscovery(values: DiscoveryValues) { return Object.entries(cleanDiscovery(values)).filter(([key, value]) => key !== "page" && key !== "page_size" && key !== "sort" && key !== "client_company_id" && value !== discoveryDefaults[key] && value !== "false"); }
export function discoverySummary(values: DiscoveryValues) { return activeDiscovery(values).map(([key, value]) => `${discoveryFieldMap[key]?.label ?? key}: ${value}`).join(" · ") || "All discoverable candidates"; }
export function validateDiscovery(values: DiscoveryValues): Record<string, string> {
  const errors: Record<string, string> = {};
  const min = Number(values.min_experience), max = Number(values.max_experience);
  if (values.min_experience && (!Number.isFinite(min) || min < 0 || min > 60)) errors.min_experience = "Enter experience from 0 to 60 years.";
  if (values.max_experience && (!Number.isFinite(max) || max < 0 || max > 60 || max < min)) errors.max_experience = "Maximum experience must be at least the minimum.";
  for (const key of ["skills", "preferred_skills", "optional_skills"]) if ((values[key] || "").split(",").filter(v => v.trim()).length > 50) errors[key] = "Use no more than 50 skills.";
  for (const level of ["ug", "pg"]) if (values[level + "_mode"] === "specific" && !values[level + "_qualification"]?.trim()) errors[level + "_qualification"] = "Choose a qualification or change the qualification mode.";
  return errors;
}
