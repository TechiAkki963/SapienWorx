export type RecruiterDashboard = {
  recruiter_name: string;
  company_name: string;
  active_jobs: number;
  applications: number;
  new_applications: number;
  shortlisted: number;
  upcoming_interviews: number;
  upcoming_items: UpcomingInterviewItem[];
  offers: number;
  hires: number;
  placement_rate: number;
  recent_applications: PipelineRow[];
  needs_attention: AttentionItem[];
};

export type AttentionItem = { kind: string; title: string; detail: string; href: string };
export type UpcomingInterviewItem = { id: string; candidate_name: string; job_title: string; scheduled_at: string };
export type RecruiterJob = {
  id: string;
  job_reference: string;
  title: string;
  department?: string;
  role_category?: string;
  status: string;
  visibility: "public" | "private";
  employment_type: string;
  work_mode: string;
  city?: string;
  state?: string;
  country_code: string;
  openings: number;
  applications: number;
  new_applications: number;
  shortlisted: number;
  interviews: number;
  published_at?: string;
  application_deadline?: string;
  updated_at: string;
  owner_name?: string;
};
export type RecruiterJobWorkspace = {
  items: RecruiterJob[];
  page: number;
  limit: number;
  total: number;
  sort: "updated" | "applications" | "newest" | "deadline";
  summary: {
    total_jobs: number; closed_jobs?: number; expired_jobs?: number; archived_jobs?: number;
    active_jobs: number;
    draft_jobs: number;
    paused_jobs: number;
    applications: number;
    new_applications: number;
  };
};
export type JobAnalytics = {
  job_id: string;
  job_reference: string;
  title: string;
  status: string;
  openings: number;
  published_at?: string;
  closed_at?: string;
  application_deadline?: string;
  total_applications: number;
  hires: number;
  remaining_openings: number;
  fill_rate_percent: number;
  days_open: number;
  days_to_deadline?: number;
  closing_soon: boolean;
  overdue: boolean;
  time_to_first_application_hours?: number;
  time_to_first_shortlist_hours?: number;
  time_to_first_offer_hours?: number;
  time_to_first_hire_hours?: number;
  funnel: { stage: string; count: number; conversion_percent: number }[];
  sources: { source: string; applications: number; shortlisted: number; interviews: number; offers: number; hires: number; hire_conversion_percent: number }[];
  trend: { date: string; applications: number }[];
};
export type PipelineRow = {
 source?: string;
 referrer_name?: string;
  application_id: string;
  candidate_id: string;
  candidate_name: string;
  headline?: string;
  city?: string;
  experience_months: number;
  notice_period_days?: number;
  job_id: string;
  job_title: string;
  job_reference: string;
  stage: string;
  applied_at: string;
  updated_at: string;
  designation: string;
  current_company: string;
  education: string;
  university: string;
  preferred_location: string;
  previous_company: string;
  key_skills: string;
  photo_data_url?: string;
  cv_filename?: string;
  saved: boolean;
  talent_pool_tags: string[];
  comment_count: number;
  last_active_at?: string;
  profile_updated_at: string;
};
export type EditableRecruiterJob = {
  id: string;
  job_reference: string;
  status: string;
  title: string;
  department: string;
  employment_type: string;
  work_mode: string;
  role_category: string;
  location: string;
  min_experience_years: number;
  max_experience_years: number | null;
  min_salary_lakhs: number | null;
  max_salary_lakhs: number | null;
  skills: string[];
  description: string;
  responsibilities: string;
  company_overview: string;
  why_join: string;
  hiring_process: string[];
  application_deadline: string | null;
  education_requirements: string[];
  screening_questions: string[];
  referral_enabled: boolean;
  visibility: "public" | "private";
  internal_notes: string;
  assigned_recruiter_id: string | null;
  openings: number;
};
export type RecruiterTeamMember = {
  user_id: string;
  full_name: string;
  designation?: string;
};
export type BulkJobActionResult = {
  operation_id: string;
  requested_count: number;
  unique_count: number;
  succeeded_count: number;
  unchanged_count: number;
  failed_count: number;
  status: "succeeded" | "partial" | "failed" | "unchanged";
  items: { job_id: string; outcome: "succeeded" | "unchanged" | "failed"; error_code?: string }[];
};
export type JobAuditEvent = {
  id: string;
  action: string;
  actor_user_id: string;
  actor_name: string;
  previous_state: Record<string, unknown>;
  new_state: Record<string, unknown>;
  changed_at: string;
};
export type PipelineList = { stage_counts?: Record<string, number>; items: PipelineRow[]; page: number; limit: number; total: number };
export type Interview = {
  id: string;
  application_id: string;
  candidate_id: string;
  job_id: string;
  job_reference: string;
  candidate_name: string;
  candidate_headline: string;
  job_title: string;
  scheduled_at: string;
  duration_minutes: number;
  meeting_url: string;
  status: string;
  round_label: string;
  notes?: string;
};
export type InterviewChangeEvent = {
  action: "reschedule" | "cancel" | "complete";
  previous_status: string;
  new_status: string;
  previous_scheduled_at: string;
  new_scheduled_at: string;
  changed_at: string;
  actor_name: string;
};
export type RecruiterCandidateDetail = {
 referral_attributions?:{id:string;referrer_name:string;relationship:string;source:string;submitted_at:string;job_title:string}[];
  user_id: string;
  full_name: string;
  headline?: string;
  email?: string;
  email_verified: boolean;
  masked_phone?: string;
  has_company_application: boolean;
  can_view_cv: boolean;
  can_view_contact: boolean;
  can_collaborate: boolean;
  saved: boolean;
  talent_pool_tags: string[];
  current_city?: string;
  current_state?: string;
  country_code: string;
  total_experience_months: number;
  notice_period_days?: number;
  profile_completion: number;
  last_active_at?: string;
  profile_updated_at: string;
  photo_data_url?: string;
  details: Record<string, unknown>;
};

export type RecruiterCandidateMatch = {
  job_id: string;
  job_title: string;
  score: number;
  eligible: boolean;
  components: Record<string, unknown>;
  explanation: Record<string, unknown>;
  model_version: string;
  model_ref: string;
  generated_at: string;
};

export type RecruiterCandidateActivityItem = {
  type: "application" | "stage" | "interview" | "note" | string;
  title: string;
  description: string;
  job_id?: string;
  job_title?: string;
  occurred_at: string;
};

export type RecruiterCandidateActivity = {
  items: RecruiterCandidateActivityItem[];
};

export const stages = ["new_application","screening","shortlisted","technical_interview","hr_round","final_interview","offer","hired","rejected","withdrawn"] as const;
export const jobStatuses = ["draft","active","paused","closed","expired","archived"] as const;
export const jobStatusTransitions: Record<string, readonly string[]> = {
  draft: ["draft","active","archived"],
  active: ["active","paused","closed"],
  paused: ["paused","active","closed","archived"],
  closed: ["closed","active","archived"],
  expired: ["expired","active","archived"],
  archived: ["archived"],
};
export function label(value: string) { return value.replaceAll("_", " ").replace(/\b\w/g, (c) => c.toUpperCase()); }
export function experience(months: number) { const years=Math.floor(months/12); const rest=months%12; return years ? `${years}y${rest ? ` ${rest}m` : ""}` : `${rest}m`; }
// Business dates must remain identical in server rendering and browser hydration.
export function compactDate(value?: string) { if(!value) return "—"; return new Intl.DateTimeFormat("en-IN",{day:"2-digit",month:"short",year:"numeric",timeZone:"Asia/Kolkata"}).format(new Date(value)); }
