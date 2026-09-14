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
  created_at: string;
};

export type AdminUserList = {
  items: AdminUser[];
  page: number;
  limit: number;
  total: number;
};
