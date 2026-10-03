BEGIN;

-- Task 49: recruiter discovery and CRM access paths.
CREATE INDEX IF NOT EXISTS ix_candidate_discovery_experience_updated
  ON candidate_profiles (total_experience_months, updated_at DESC, user_id)
  WHERE lower(trim(coalesce(profile_details->>'discoverable_to_recruiters','')))='true';

CREATE INDEX IF NOT EXISTS ix_candidate_discovery_notice_updated
  ON candidate_profiles (notice_period_days, updated_at DESC, user_id)
  WHERE lower(trim(coalesce(profile_details->>'discoverable_to_recruiters','')))='true';

CREATE INDEX IF NOT EXISTS ix_talent_pool_recruiter_updated
  ON talent_pool_memberships (recruiter_id, updated_at DESC, candidate_id);

-- Saved-search alert controls remain private to the recruiter.
ALTER TABLE recruiter_saved_searches
  ADD COLUMN alert_enabled boolean NOT NULL DEFAULT false,
  ADD COLUMN alert_frequency varchar(16) NOT NULL DEFAULT 'daily',
  ADD COLUMN last_alerted_at timestamptz,
  ADD CONSTRAINT recruiter_saved_searches_alert_frequency
    CHECK (alert_frequency IN ('daily','weekly'));

CREATE INDEX ix_recruiter_saved_search_alerts
  ON recruiter_saved_searches (recruiter_id, alert_enabled, updated_at DESC);

CREATE INDEX ix_recruiter_saved_search_alert_due
  ON recruiter_saved_searches (last_alerted_at, updated_at)
  WHERE alert_enabled=true;

-- Structured offers; application stage remains the pipeline source of truth.
CREATE TABLE recruiter_offers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  application_id uuid NOT NULL REFERENCES applications(id) ON DELETE CASCADE,
  company_id uuid NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  recruiter_id uuid NOT NULL REFERENCES recruiter_profiles(user_id) ON DELETE RESTRICT,
  title varchar(200) NOT NULL DEFAULT 'Employment offer',
  currency char(3) NOT NULL DEFAULT 'INR',
  annual_compensation numeric(14,2),
  joining_date date,
  expires_at date,
  status varchar(20) NOT NULL DEFAULT 'draft'
    CHECK (status IN ('draft','sent','accepted','declined','withdrawn','expired')),
  notes text,
  sent_at timestamptz,
  responded_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT recruiter_offers_comp_nonnegative CHECK (annual_compensation IS NULL OR annual_compensation >= 0),
  CONSTRAINT recruiter_offers_dates_valid CHECK (expires_at IS NULL OR joining_date IS NULL OR expires_at <= joining_date)
);
CREATE UNIQUE INDEX ux_recruiter_offers_open_application
  ON recruiter_offers(application_id)
  WHERE status IN ('draft','sent','accepted');
CREATE INDEX ix_recruiter_offers_company_status
  ON recruiter_offers(company_id,status,updated_at DESC);
CREATE INDEX ix_recruiter_offers_recruiter_updated
  ON recruiter_offers(recruiter_id,updated_at DESC);
CREATE TRIGGER trg_recruiter_offers_updated_at
BEFORE UPDATE ON recruiter_offers
FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- Referral tracking for candidates introduced by employees/partners/recruiters.
CREATE TABLE recruiter_referrals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  recruiter_id uuid NOT NULL REFERENCES recruiter_profiles(user_id) ON DELETE RESTRICT,
  candidate_id uuid NOT NULL REFERENCES candidate_profiles(user_id) ON DELETE CASCADE,
  job_id uuid REFERENCES jobs(id) ON DELETE SET NULL,
  referrer_name varchar(160) NOT NULL,
  referrer_email varchar(320),
  source varchar(32) NOT NULL DEFAULT 'employee'
    CHECK (source IN ('employee','partner','recruiter','other')),
  status varchar(24) NOT NULL DEFAULT 'referred'
    CHECK (status IN ('referred','contacted','applied','interviewing','offered','hired','closed')),
  reward_status varchar(24) NOT NULL DEFAULT 'not_eligible'
    CHECK (reward_status IN ('not_eligible','pending','approved','paid','cancelled')),
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT recruiter_referrals_referrer_not_blank CHECK (length(trim(referrer_name)) > 0)
);
CREATE INDEX ix_recruiter_referrals_company_status
  ON recruiter_referrals(company_id,status,updated_at DESC);
CREATE INDEX ix_recruiter_referrals_recruiter_updated
  ON recruiter_referrals(recruiter_id,updated_at DESC);
CREATE INDEX ix_recruiter_referrals_candidate
  ON recruiter_referrals(candidate_id,updated_at DESC);
CREATE TRIGGER trg_recruiter_referrals_updated_at
BEFORE UPDATE ON recruiter_referrals
FOR EACH ROW EXECUTE FUNCTION set_updated_at();

COMMIT;
