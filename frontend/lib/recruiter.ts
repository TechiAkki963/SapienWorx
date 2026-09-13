export type RecruiterDashboard = {
  recruiter_name: string;
  company_name: string;
  active_jobs: number;
  applications: number;
  shortlisted: number;
  upcoming_interviews: number;
  offers: number;
  hires: number;
  placement_rate: number;
  recent_applications: PipelineRow[];
  needs_attention: AttentionItem[];
};

export type AttentionItem = { kind: string; title: string; detail: string; href: string };
export type RecruiterJob = {
  id: string;
  title: string;
  department?: string;
  status: string;
  employment_type: string;
  work_mode: string;
  city?: string;
  state?: string;
  country_code: string;
  openings: number;
  applications: number;
  published_at?: string;
  application_deadline?: string;
  updated_at: string;
};
export type PipelineRow = {
  application_id: string;
  candidate_id: string;
  candidate_name: string;
  headline?: string;
  city?: string;
  experience_months: number;
  notice_period_days?: number;
  job_id: string;
  job_title: string;
  stage: string;
  applied_at: string;
  updated_at: string;
};
export type Interview = {
  id: string;
  application_id: string;
  candidate_name: string;
  job_title: string;
  scheduled_at: string;
  duration_minutes: number;
  meeting_url: string;
  status: string;
  notes?: string;
};

export const stages = ["new_application","screening","shortlisted","technical_interview","hr_round","final_interview","offer","hired","rejected","withdrawn"] as const;
export const jobStatuses = ["draft","active","paused","closed","expired","archived"] as const;
export function label(value: string) { return value.replaceAll("_", " ").replace(/\b\w/g, (c) => c.toUpperCase()); }
export function experience(months: number) { const years=Math.floor(months/12); const rest=months%12; return years ? `${years}y${rest ? ` ${rest}m` : ""}` : `${rest}m`; }
export function compactDate(value?: string) { if(!value) return "—"; return new Intl.DateTimeFormat("en-IN",{day:"2-digit",month:"short",year:"numeric"}).format(new Date(value)); }
