BEGIN;

CREATE TABLE platform_admin_settings (
  singleton boolean PRIMARY KEY DEFAULT true CHECK (singleton),
  sns_sms_warning_count integer NOT NULL DEFAULT 500 CHECK (sns_sms_warning_count >= 0),
  sns_sms_critical_count integer NOT NULL DEFAULT 1000 CHECK (sns_sms_critical_count > sns_sms_warning_count),
  updated_at timestamptz NOT NULL DEFAULT now(),
  updated_by uuid REFERENCES users(id) ON DELETE SET NULL
);

INSERT INTO platform_admin_settings(singleton) VALUES (true)
ON CONFLICT (singleton) DO NOTHING;


CREATE INDEX ix_jobs_admin_moderation
  ON jobs (status, updated_at DESC, company_id);

COMMIT;
