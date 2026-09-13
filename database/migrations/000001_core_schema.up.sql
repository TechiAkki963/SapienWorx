BEGIN;

CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TYPE user_role AS ENUM ('candidate', 'recruiter', 'master_admin');
CREATE TYPE account_status AS ENUM ('pending_verification', 'active', 'suspended', 'disabled');
CREATE TYPE verification_status AS ENUM ('pending', 'verified', 'rejected');
CREATE TYPE job_status AS ENUM ('draft', 'active', 'paused', 'closed', 'expired', 'archived');
CREATE TYPE employment_type AS ENUM ('full_time', 'part_time', 'contract', 'internship', 'temporary');
CREATE TYPE work_mode AS ENUM ('onsite', 'hybrid', 'remote');

CREATE TABLE users (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email varchar(320) NOT NULL,
  password_hash text NOT NULL,
  role user_role NOT NULL,
  status account_status NOT NULL DEFAULT 'pending_verification',
  phone_e164 varchar(20),
  email_verified_at timestamptz,
  phone_verified_at timestamptz,
  last_login_at timestamptz,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT users_email_not_blank CHECK (btrim(email) <> ''),
  CONSTRAINT users_phone_e164_format CHECK (phone_e164 IS NULL OR phone_e164 ~ '^\+[1-9][0-9]{7,14}$')
);

CREATE UNIQUE INDEX ux_users_email_ci ON users (lower(email));
CREATE UNIQUE INDEX ux_users_phone_e164 ON users (phone_e164) WHERE phone_e164 IS NOT NULL;
CREATE INDEX ix_users_role_status ON users (role, status) WHERE is_active = true;

CREATE TABLE companies (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  legal_name varchar(200) NOT NULL,
  display_name varchar(200) NOT NULL,
  website_url text,
  work_email_domain varchar(255),
  country_code char(2),
  city varchar(120),
  verification_status verification_status NOT NULL DEFAULT 'pending',
  verified_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT companies_legal_name_not_blank CHECK (btrim(legal_name) <> ''),
  CONSTRAINT companies_display_name_not_blank CHECK (btrim(display_name) <> ''),
  CONSTRAINT companies_domain_lowercase CHECK (work_email_domain IS NULL OR work_email_domain = lower(work_email_domain))
);

CREATE INDEX ix_companies_verification_status ON companies (verification_status);
CREATE INDEX ix_companies_domain ON companies (work_email_domain) WHERE work_email_domain IS NOT NULL;

CREATE TABLE candidate_profiles (
  user_id uuid PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  full_name varchar(160) NOT NULL,
  headline varchar(240),
  current_city varchar(120),
  current_state varchar(120),
  country_code char(2) NOT NULL DEFAULT 'IN',
  total_experience_months integer NOT NULL DEFAULT 0,
  notice_period_days integer,
  current_salary_amount numeric(14,2),
  current_salary_currency char(3) NOT NULL DEFAULT 'INR',
  expected_salary_amount numeric(14,2),
  expected_salary_currency char(3) NOT NULL DEFAULT 'INR',
  cv_s3_key text,
  cv_original_filename varchar(255),
  cv_uploaded_at timestamptz,
  profile_completion smallint NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT candidate_full_name_not_blank CHECK (btrim(full_name) <> ''),
  CONSTRAINT candidate_experience_nonnegative CHECK (total_experience_months >= 0),
  CONSTRAINT candidate_notice_nonnegative CHECK (notice_period_days IS NULL OR notice_period_days >= 0),
  CONSTRAINT candidate_salary_nonnegative CHECK (
    (current_salary_amount IS NULL OR current_salary_amount >= 0)
    AND (expected_salary_amount IS NULL OR expected_salary_amount >= 0)
  ),
  CONSTRAINT candidate_profile_completion_range CHECK (profile_completion BETWEEN 0 AND 100)
);

CREATE INDEX ix_candidate_profiles_location ON candidate_profiles (country_code, current_state, current_city);
CREATE INDEX ix_candidate_profiles_experience ON candidate_profiles (total_experience_months);
CREATE INDEX ix_candidate_profiles_notice ON candidate_profiles (notice_period_days);

CREATE TABLE recruiter_profiles (
  user_id uuid PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  company_id uuid NOT NULL REFERENCES companies(id) ON DELETE RESTRICT,
  full_name varchar(160) NOT NULL,
  designation varchar(160),
  verification_status verification_status NOT NULL DEFAULT 'pending',
  verified_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT recruiter_full_name_not_blank CHECK (btrim(full_name) <> '')
);

CREATE INDEX ix_recruiter_profiles_company ON recruiter_profiles (company_id);
CREATE INDEX ix_recruiter_profiles_verification ON recruiter_profiles (verification_status);

CREATE TABLE admin_profiles (
  user_id uuid PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  full_name varchar(160) NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT admin_full_name_not_blank CHECK (btrim(full_name) <> '')
);

CREATE TABLE jobs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES companies(id) ON DELETE RESTRICT,
  created_by_recruiter_id uuid NOT NULL REFERENCES recruiter_profiles(user_id) ON DELETE RESTRICT,
  title varchar(200) NOT NULL,
  slug varchar(240) NOT NULL,
  department varchar(160),
  description text NOT NULL,
  employment_type employment_type NOT NULL,
  work_mode work_mode NOT NULL,
  city varchar(120),
  state varchar(120),
  country_code char(2) NOT NULL DEFAULT 'IN',
  min_experience_months integer NOT NULL DEFAULT 0,
  max_experience_months integer,
  min_salary_amount numeric(14,2),
  max_salary_amount numeric(14,2),
  salary_currency char(3) NOT NULL DEFAULT 'INR',
  openings integer NOT NULL DEFAULT 1,
  status job_status NOT NULL DEFAULT 'draft',
  application_deadline date,
  published_at timestamptz,
  closed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT jobs_title_not_blank CHECK (btrim(title) <> ''),
  CONSTRAINT jobs_slug_not_blank CHECK (btrim(slug) <> ''),
  CONSTRAINT jobs_description_not_blank CHECK (btrim(description) <> ''),
  CONSTRAINT jobs_experience_nonnegative CHECK (min_experience_months >= 0 AND (max_experience_months IS NULL OR max_experience_months >= min_experience_months)),
  CONSTRAINT jobs_salary_valid CHECK (
    (min_salary_amount IS NULL OR min_salary_amount >= 0)
    AND (max_salary_amount IS NULL OR max_salary_amount >= 0)
    AND (min_salary_amount IS NULL OR max_salary_amount IS NULL OR max_salary_amount >= min_salary_amount)
  ),
  CONSTRAINT jobs_openings_positive CHECK (openings > 0)
);

CREATE UNIQUE INDEX ux_jobs_company_slug ON jobs (company_id, slug);
CREATE INDEX ix_jobs_status_published ON jobs (status, published_at DESC);
CREATE INDEX ix_jobs_location ON jobs (country_code, state, city);
CREATE INDEX ix_jobs_filter_core ON jobs (employment_type, work_mode, min_experience_months, max_experience_months);
CREATE INDEX ix_jobs_company_status ON jobs (company_id, status);
CREATE INDEX ix_jobs_recruiter_status ON jobs (created_by_recruiter_id, status);

CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_users_updated_at BEFORE UPDATE ON users FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER trg_companies_updated_at BEFORE UPDATE ON companies FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER trg_candidate_profiles_updated_at BEFORE UPDATE ON candidate_profiles FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER trg_recruiter_profiles_updated_at BEFORE UPDATE ON recruiter_profiles FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER trg_admin_profiles_updated_at BEFORE UPDATE ON admin_profiles FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER trg_jobs_updated_at BEFORE UPDATE ON jobs FOR EACH ROW EXECUTE FUNCTION set_updated_at();

COMMIT;
