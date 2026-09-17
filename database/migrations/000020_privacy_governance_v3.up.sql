BEGIN;

CREATE TYPE privacy_incident_status AS ENUM ('open','investigating','contained','notifiable','notified','closed');

CREATE TABLE privacy_subprocessors (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name varchar(200) NOT NULL,
  purpose text NOT NULL,
  data_categories text[] NOT NULL DEFAULT '{}'::text[],
  processing_locations text[] NOT NULL DEFAULT '{}'::text[],
  transfer_mechanism varchar(120),
  privacy_url text,
  active boolean NOT NULL DEFAULT true,
  effective_from date NOT NULL DEFAULT current_date,
  effective_to date,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT privacy_subprocessor_name_not_blank CHECK (btrim(name) <> ''),
  CONSTRAINT privacy_subprocessor_purpose_not_blank CHECK (btrim(purpose) <> '')
);
CREATE UNIQUE INDEX ux_privacy_subprocessors_name_active ON privacy_subprocessors(lower(name)) WHERE active=true;
CREATE TRIGGER trg_privacy_subprocessors_updated_at BEFORE UPDATE ON privacy_subprocessors FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TABLE privacy_processing_activities (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  activity_key varchar(120) NOT NULL UNIQUE,
  name varchar(200) NOT NULL,
  purpose text NOT NULL,
  data_subjects text[] NOT NULL DEFAULT '{}'::text[],
  data_categories text[] NOT NULL DEFAULT '{}'::text[],
  lawful_basis varchar(120) NOT NULL,
  recipients text[] NOT NULL DEFAULT '{}'::text[],
  retention_rule varchar(160) NOT NULL,
  security_measures text[] NOT NULL DEFAULT '{}'::text[],
  cross_border_transfer boolean NOT NULL DEFAULT false,
  owner varchar(160) NOT NULL,
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT privacy_activity_key_not_blank CHECK (btrim(activity_key) <> ''),
  CONSTRAINT privacy_activity_name_not_blank CHECK (btrim(name) <> '')
);
CREATE INDEX ix_privacy_processing_active ON privacy_processing_activities(active, activity_key);
CREATE TRIGGER trg_privacy_processing_updated_at BEFORE UPDATE ON privacy_processing_activities FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TABLE privacy_incidents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title varchar(240) NOT NULL,
  status privacy_incident_status NOT NULL DEFAULT 'open',
  severity varchar(40) NOT NULL,
  detected_at timestamptz NOT NULL,
  contained_at timestamptz,
  affected_data_categories text[] NOT NULL DEFAULT '{}'::text[],
  affected_subject_count integer,
  description text NOT NULL,
  assessment text,
  notification_required boolean,
  notification_reason text,
  authority_notified_at timestamptz,
  subjects_notified_at timestamptz,
  owner_user_id uuid REFERENCES users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT privacy_incident_title_not_blank CHECK (btrim(title) <> ''),
  CONSTRAINT privacy_incident_description_not_blank CHECK (btrim(description) <> ''),
  CONSTRAINT privacy_incident_subject_count_nonnegative CHECK (affected_subject_count IS NULL OR affected_subject_count >= 0)
);
CREATE INDEX ix_privacy_incidents_status_detected ON privacy_incidents(status, detected_at DESC);
CREATE TRIGGER trg_privacy_incidents_updated_at BEFORE UPDATE ON privacy_incidents FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TABLE privacy_retention_rules (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  rule_key varchar(120) NOT NULL UNIQUE,
  data_category varchar(160) NOT NULL,
  retention_days integer,
  trigger_event varchar(160) NOT NULL,
  action varchar(80) NOT NULL,
  legal_or_operational_basis text NOT NULL,
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT privacy_retention_days_positive CHECK (retention_days IS NULL OR retention_days > 0)
);
CREATE TRIGGER trg_privacy_retention_updated_at BEFORE UPDATE ON privacy_retention_rules FOR EACH ROW EXECUTE FUNCTION set_updated_at();

INSERT INTO privacy_processing_activities(activity_key,name,purpose,data_subjects,data_categories,lawful_basis,recipients,retention_rule,security_measures,cross_border_transfer,owner)
VALUES
('candidate-account','Candidate account and recruitment profile','Provide candidate account, job application and hiring workflows',ARRAY['candidates'],ARRAY['identity','contact','career','application','cv'],'contract / legitimate interests as applicable',ARRAY['authorised SapienWorx staff','authorised recruiters for applied roles'],'candidate-account-retention',ARRAY['RBAC','encryption in transit','private object storage','audit logging'],false,'Privacy Operations'),
('recruiter-account','Recruiter account and employer workspace','Provide employer/recruiter hiring workspace',ARRAY['recruiters'],ARRAY['identity','business contact','company affiliation'],'contract / legitimate interests as applicable',ARRAY['authorised SapienWorx staff'],'recruiter-account-retention',ARRAY['RBAC','official-email validation','audit logging'],false,'Privacy Operations')
ON CONFLICT (activity_key) DO NOTHING;

INSERT INTO privacy_retention_rules(rule_key,data_category,retention_days,trigger_event,action,legal_or_operational_basis)
VALUES
('candidate-account-retention','candidate account and profile',30,'verified erasure request with no retention hold','delete_or_anonymise','Account data is removed after approved erasure unless a documented retention obligation applies.'),
('security-audit-retention','security and privacy audit evidence',2190,'event creation','retain_then_delete','Security, fraud-prevention and compliance evidence may require longer retention than ordinary profile data.')
ON CONFLICT (rule_key) DO NOTHING;

COMMIT;