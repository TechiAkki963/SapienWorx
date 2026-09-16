export type CandidateJob = {
  id: string;
  company_name: string;
  company_logo_url?: string;
  title: string;
  department?: string;
  description: string;
  employment_type: string;
  work_mode: string;
  city?: string;
  state?: string;
  country_code: string;
  min_experience_months: number;
  max_experience_months?: number;
  min_salary_amount?: number;
  max_salary_amount?: number;
  salary_currency: string;
  openings: number;
  application_deadline?: string;
  published_at?: string;
  required_skills?: string[];
  match_score?: number;
};

export type JobList = { items: CandidateJob[]; page: number; limit: number; total: number };

export type CandidateProfile = {
  user_id: string;
  email: string;
  phone?: string;
  full_name: string;
  headline?: string;
  current_city?: string;
  current_state?: string;
  country_code: string;
  total_experience_months: number;
  notice_period_days?: number;
  profile_completion: number;
};

export type CandidateProfileDetails = {
  details: Record<string, unknown>;
  current_salary_amount?: number;
  current_salary_currency: string;
  expected_salary_amount?: number;
  expected_salary_currency: string;
  cv_original_filename?: string;
  last_active_at?: string;
  profile_updated_at?: string;
};

export type CandidateProfileSummary = {
  full_name: string;
  headline?: string;
  email: string;
  email_verified: boolean;
  primary_phone?: string;
  secondary_phone?: string;
  current_location?: string;
  preferred_locations: string[];
  total_experience_months: number;
  profile_completion: number;
  photo_data_url?: string;
  share_token: string;
  profile_visible: boolean;
};

export type CandidateApplication = {
  id: string;
  stage: string;
  applied_at: string;
  updated_at: string;
  job_id: string;
  job_title: string;
  company_name: string;
  work_mode: string;
  city?: string;
};

export type CandidateInterview = {
  id: string;
  application_id: string;
  job_id: string;
  job_title: string;
  company_name: string;
  scheduled_at: string;
  duration_minutes: number;
  meeting_url: string;
  status: string;
};

export type CandidateNotification = {
  id: string;
  kind: string;
  title: string;
  body: string;
  action_url?: string;
  read_at?: string;
  created_at: string;
};

export type CandidateDashboard = {
  profile: CandidateProfile;
  application_count: number;
  interview_count: number;
  offer_count: number;
  saved_count: number;
  recommended_jobs: CandidateJob[];
  recent_applications: CandidateApplication[];
  notifications: CandidateNotification[];
};

export function humanize(value: string): string {
  return value.replaceAll("_", " ").replace(/\b\w/g, (letter) => letter.toUpperCase());
}

export function jobLocation(job: CandidateJob): string {
  if (job.work_mode === "remote") return "Remote";
  return [job.city, job.state].filter(Boolean).join(", ") || job.country_code;
}

export function experienceLabel(job: CandidateJob): string {
  const minYears = Math.floor(job.min_experience_months / 12);
  const maxYears = job.max_experience_months == null ? null : Math.ceil(job.max_experience_months / 12);
  if (maxYears == null) return minYears > 0 ? `${minYears}+ years` : "Open to early career";
  return `${minYears}–${maxYears} years`;
}

export function salaryLabel(job: CandidateJob): string | null {
  if (job.min_salary_amount == null && job.max_salary_amount == null) return null;
  const formatter = new Intl.NumberFormat("en-IN", { maximumFractionDigits: 0 });
  const min = job.min_salary_amount == null ? null : formatter.format(job.min_salary_amount);
  const max = job.max_salary_amount == null ? null : formatter.format(job.max_salary_amount);
  if (min && max) return `${job.salary_currency} ${min}–${max}`;
  return `${job.salary_currency} ${min ?? max}`;
}

export function stageLabel(stage: string): string {
  return humanize(stage);
}
