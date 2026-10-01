export type AdminDashboard = {
  computed_at: string;
  company_id?: string;
  country?: string;
  period: string;
  from: string;
  to: string;
  registered_users: number;
  candidates: number;
  recruiters: number;
  verified_recruiters: number;
  organizations: number;
  published_jobs: number;
  draft_jobs: number;
  applications: number;
  scheduled_interviews: number;
  offer_stage_applications: number;
  hired_stage_applications: number;
  pending_company_reviews: number;
  pending_accounts: number;
  pending_privacy_requests: number;
  open_privacy_incidents: number;
  new_users: number;
  jobs_published: number;
  new_applications: number;
  active_conversations: number;
  admin_access_denials: number;
};

export type AdminMetrics = {
  metric_date: string;
  total_active_users: number;
  active_jobs: number;
  total_candidates: number;
  jobs_posted_today: number;
  sns_sms_sent_today: number;
  sns_sms_sent_billing_cycle: number;
  sns_billing_cycle_start: string;
  pending_company_reviews: number;
  computed_at: string;
};

export type CompanyVerification = {
  id: string;
  company_id: string;
  recruiter_user_id: string;
  company_name: string;
  registration_doc_url?: string | null;
  status: "pending" | "approved" | "rejected";
  reviewed_by?: string | null;
  review_notes?: string | null;
  reviewed_at?: string | null;
  created_at: string;
  updated_at: string;
};

export type VerificationList = {
  items: CompanyVerification[];
  page: number;
  limit: number;
  total: number;
};

export type AdminUser = {
  id: string;
  role: "candidate" | "recruiter" | "master_admin";
  status: "pending_verification" | "active" | "suspended" | "disabled";
  name: string;
  email: string;
  phone?: string | null;
  email_verified_at?: string | null;
  phone_verified_at?: string | null;
  force_password_reset: boolean;
  is_active: boolean;
  last_login_at?: string | null;
  company_id?: string | null;
  company_name?: string | null;
  recruiter_verification?: string | null;
  created_at: string;
};

export type AdminUserList = {
  items: AdminUser[];
  page: number;
  limit: number;
  total: number;
};

export type AdminAccountSummary = {
  id:string; role:AdminUser["role"]; status:AdminUser["status"]; created_at:string; last_login_at?:string;
  active_sessions:number; computed_at:string;
  consent:{events:number;latest_purposes:number;latest_granted:number;latest_denied_or_withdrawn:number;last_recorded_at?:string};
  candidate?:{onboarding:string;method:string;profile_completion:number;discoverable:boolean;contact_sharing:boolean;resume_uploaded:boolean;updated_at:string;applications:number};
  recruiter?:{company_id?:string;verification:string;jobs_owned:number;active_jobs_owned:number;applications_to_owned_jobs:number;stage_changes:number;interview_changes:number;last_recorded_workflow?:string};
};

export type AdminOrganization = {
  id: string; legal_name: string; display_name: string; website_url?: string | null;
  work_email_domain?: string | null; country_code?: string | null;
  verification_status: "pending" | "verified" | "rejected"; created_at: string;
  recruiters: number; active_jobs: number; applications: number; cv_views_current_month: number;
};
export type AdminOrganizationList = { items: AdminOrganization[]; page: number; limit: number; total: number };

export type AdminAuditRecord = {
  id: string;
  admin_id?: string | null;
  admin_name?: string | null;
  action_type: string;
  target_entity_type?: string | null;
  target_entity_id?: string | null;
  ip_address?: string | null;
  request_id?: string | null;
  metadata: Record<string, unknown>;
  created_at: string;
};

export type AdminAuditList = {
  items: AdminAuditRecord[];
  page: number;
  limit: number;
  total: number;
};

export type AdminJob = {
  id: string;
  job_reference: string;
  title: string;
  company_id: string;
  company_name: string;
  recruiter_user_id: string;
  recruiter_name: string;
  status: "draft" | "active" | "paused" | "closed" | "expired" | "archived";
  work_mode: "onsite" | "hybrid" | "remote";
  city?: string | null;
  country_code: string;
  published_at?: string | null;
  created_at: string;
  updated_at: string;
  application_count: number;
};

export type AdminJobList = {
  items: AdminJob[];
  page: number;
  limit: number;
  total: number;
};

export type AdminBudgetSettings = {
  sns_sms_warning_count: number;
  sns_sms_critical_count: number;
  updated_at: string;
  updated_by?: string | null;
};

export type AdminApplication = {
  id: string; candidate_id: string; job_id: string; job_reference: string; job_title: string;
  company_id: string; company_name: string; organization_country?: string | null;
  stage: string; source: string; applied_at: string; updated_at: string;
};
export type AdminInterview = {
  id: string; application_id: string; candidate_id: string; job_id: string; job_reference: string;
  job_title: string; company_id: string; company_name: string; recruiter_id: string;
  scheduled_at: string; duration_minutes: number; round_label: string; status: string; created_at: string;
};
export type AdminRecruitmentList<T> = { items: T[]; page: number; limit: number; total: number };
export type AdminRecruitmentEvent = { id: string; kind: string; actor_id?: string | null; occurred_at: string; changes: Record<string,string|number> };
export type AdminApplicationHistory = AdminRecruitmentList<AdminRecruitmentEvent> & { application: AdminApplication };
