export type CandidateJob = {
  referral_enabled?: boolean;
  id: string;
  job_reference?: string;
  status?: string;
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

export type CandidateSearchInterpretation = {
  input: string;
  canonical: string;
  entity_type: string;
};

export type JobList = {
  items: CandidateJob[];
  page: number;
  limit: number;
  total: number;
  sort?: "relevance" | "newest";
  query_interpretation?: CandidateSearchInterpretation;
  competency_interpretation?: CandidateSearchInterpretation;
};

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

export type Employment = {
  company?: string;
  job_title?: string;
  employment_type?: string;
  joining_year?: string;
  joining_month?: string;
  end_year?: string | null;
  end_month?: string | null;
  current_company?: string;
  current_salary?: string;
  skills_used?: string;
  job_profile?: string;
  location?: string;
  achievements?: string;
};
export type Education = {
  course?: string;
  level?: string;
  education?: string;
  university?: string;
  specialization?: string;
  course_type?: string;
  grading_system?: string;
  score?: string;
  start_year?: string;
  end_year?: string;
};
export type ProfileSkill = {
  name?: string;
  version?: string;
  last_used?: string;
  experience_years?: string | number;
  experience_months?: string | number;
  proficiency?: string;
};
export type ProfileLanguage = {
  language?: string;
  proficiency?: string;
  read?: string;
  write?: string;
  speak?: string;
};
export type ProfessionalRecord = {
  title?: string;
  description?: string;
  role?: string;
  skills?: string;
  url?: string;
  issuer?: string;
  label?: string;
  type?: string;
  [key: string]: unknown;
};
export type ProfessionalContent = string | ProfessionalRecord[];
export type CandidateDetails = {
  key_skills?: string[] | string | null;
  work_status?: string;
  locality?: string;
  salary_breakdown?: string;
  fixed_salary?: string;
  variable_salary?: string;
  role_category?: string;
  job_role?: string;
  desired_job_type?: string[];
  desired_employment_type?: string[];
  preferred_job_roles?: string;
  preferred_shift?: string;
  project_records?: ProfessionalRecord[];
  work_samples?: ProfessionalRecord[];
  online_profiles?: ProfessionalRecord[];
  publications?: ProfessionalRecord[];
  presentations?: ProfessionalRecord[];
  patents?: ProfessionalRecord[];
  certifications?: ProfessionalRecord[];
  awards?: ProfessionalRecord[];
  professional_memberships?: ProfessionalRecord[];
  preferred_work_mode?: string;
  current_salary_unit?: string;
  expected_salary_unit?: string;
  professional_summary?: string;
  current_designation?: string;
  employment_highlights?: string;
  interested_domains?: string;
  employment?: Employment[];
  education?: Education[];
  it_skills?: ProfileSkill[];
  languages?: ProfileLanguage[];
  preferred_locations?: string;
  department_role?: string;
  industry?: string;
  projects?: ProfessionalContent;
  accomplishments?: ProfessionalContent;
  professional_links?: ProfessionalContent;
  private_contact?: boolean;
  profile_visible_in_sourcing?: boolean;
  discoverable_to_recruiters?: boolean;
  gender?: string;
  marital_status?: string;
  date_of_birth?: string;
  category?: string;
  more_information?: string[];
  usa_work_authorization?: string[];
  other_work_permits?: string;
  permanent_address?: string;
  hometown?: string;
  pincode?: string;
  disability_status?: string;
  disability_details?: string;
  military_experience?: string;
  career_break?: string;
  onboarding_status?: CandidateOnboardingStatus;
  onboarding_method?: string;
  onboarding_step?: number;
  onboarding_return_to?: string;
  // Unknown legacy extension keys are retained at the API boundary, never dropped by section saves.
  [key: string]: unknown;
};
export type CandidateProfileDetails = {
  details: CandidateDetails;
  current_salary_amount?: number;
  current_salary_currency: string;
  expected_salary_amount?: number;
  expected_salary_currency: string;
  cv_original_filename?: string;
  last_active_at?: string;
  profile_updated_at?: string;
  alternate_phone_e164?: string;
  contact_reveal_enabled?: boolean;
};

export type CandidateOnboardingStatus =
  | "not_started"
  | "manual_started"
  | "cv_started"
  | "review_required"
  | "profile_ready"
  | "in_progress"
  | "ready"
  | "complete";

export function candidateOnboardingStatus(
  details: CandidateProfileDetails,
): CandidateOnboardingStatus | null {
  const value = details.details?.onboarding_status;
  return value === "not_started" ||
    value === "manual_started" ||
    value === "cv_started" ||
    value === "review_required" ||
    value === "profile_ready" ||
    value === "in_progress" ||
    value === "ready" ||
    value === "complete"
    ? value
    : null;
}

export function safeCandidateJobPath(
  value: string | null | undefined,
): string | undefined {
  if(value==="/referrals")return value;
  return value && /^\/(?:candidate\/jobs|jobs)\/[a-zA-Z0-9-]+$/.test(value)
    ? value
    : undefined;
}

export type CandidateProfileSummary = {
  full_name: string;
  headline?: string;
  email: string;
  email_verified: boolean;
  primary_phone?: string;
  phone_verified?: boolean;
  secondary_phone?: string;
  current_location?: string;
  preferred_locations: string[];
  total_experience_months: number;
  profile_completion: number;
  photo_data_url?: string;
  share_token: string;
  profile_visible: boolean;
  discoverable_to_recruiters: boolean;
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
  state?: string;
  country_code?: string;
  job_status?: string;
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
  round_label?: string;
  time_zone?: string;
  mode?: string;
  location?: string;
  rescheduled?: boolean;
};

export type CandidateProfileMetrics = {
  profile_views: number;
  search_appearances: number;
  recruiter_actions: number;
  period_days: number;
  computed_at: string;
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
  return value
    .replaceAll("_", " ")
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}

export function jobLocation(job: CandidateJob): string {
  if (job.work_mode === "remote") return "Remote";
  return [job.city, job.state].filter(Boolean).join(", ") || job.country_code;
}

export function experienceLabel(job: CandidateJob): string {
  const minYears = Math.floor(job.min_experience_months / 12);
  const maxYears =
    job.max_experience_months == null
      ? null
      : Math.ceil(job.max_experience_months / 12);
  if (maxYears == null)
    return minYears > 0 ? `${minYears}+ years` : "Open to early career";
  return `${minYears}–${maxYears} years`;
}

export function salaryLabel(job: CandidateJob): string | null {
  if (job.min_salary_amount == null && job.max_salary_amount == null)
    return null;
  const formatter = new Intl.NumberFormat("en-IN", {
    maximumFractionDigits: 0,
  });
  const min =
    job.min_salary_amount == null
      ? null
      : formatter.format(job.min_salary_amount);
  const max =
    job.max_salary_amount == null
      ? null
      : formatter.format(job.max_salary_amount);
  if (min && max) return `${job.salary_currency} ${min}–${max}`;
  return `${job.salary_currency} ${min ?? max}`;
}

export function stageLabel(stage: string): string {
  return humanize(stage);
}
