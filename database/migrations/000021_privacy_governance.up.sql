BEGIN;

CREATE TABLE privacy_incidents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title varchar(240) NOT NULL,
  severity varchar(24) NOT NULL,
  status varchar(32) NOT NULL DEFAULT 'open',
  discovered_at timestamptz NOT NULL,
  contained_at timestamptz,
  affected_subjects_estimate integer,
  categories jsonb NOT NULL DEFAULT '[]'::jsonb,
  notification_required boolean,
  notification_deadline timestamptz,
  notes text,
  created_by uuid REFERENCES users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT privacy_incident_severity_valid CHECK (severity IN ('low','medium','high','critical')),
  CONSTRAINT privacy_incident_status_valid CHECK (status IN ('open','investigating','contained','closed')),
  CONSTRAINT privacy_incident_subjects_nonnegative CHECK (affected_subjects_estimate IS NULL OR affected_subjects_estimate >= 0)
);
CREATE INDEX ix_privacy_incidents_status_discovered ON privacy_incidents(status, discovered_at DESC);
CREATE TRIGGER trg_privacy_incidents_updated_at BEFORE UPDATE ON privacy_incidents FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TABLE privacy_subprocessors (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name varchar(200) NOT NULL,
  purpose text NOT NULL,
  data_categories jsonb NOT NULL DEFAULT '[]'::jsonb,
  processing_locations jsonb NOT NULL DEFAULT '[]'::jsonb,
  website_url text,
  dpa_url text,
  active boolean NOT NULL DEFAULT true,
  effective_from date NOT NULL DEFAULT current_date,
  effective_to date,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT privacy_subprocessor_name_not_blank CHECK (btrim(name) <> ''),
  CONSTRAINT privacy_subprocessor_dates_valid CHECK (effective_to IS NULL OR effective_to >= effective_from)
);
CREATE UNIQUE INDEX ux_privacy_subprocessors_name_active ON privacy_subprocessors(lower(name)) WHERE active=true;
CREATE TRIGGER trg_privacy_subprocessors_updated_at BEFORE UPDATE ON privacy_subprocessors FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TABLE privacy_processing_activities (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  activity_name varchar(240) NOT NULL,
  purpose text NOT NULL,
  lawful_basis varchar(80) NOT NULL,
  data_subjects jsonb NOT NULL DEFAULT '[]'::jsonb,
  data_categories jsonb NOT NULL DEFAULT '[]'::jsonb,
  recipients jsonb NOT NULL DEFAULT '[]'::jsonb,
  retention_policy varchar(240) NOT NULL,
  security_measures text NOT NULL,
  international_transfers jsonb NOT NULL DEFAULT '[]'::jsonb,
  owner varchar(160) NOT NULL,
  active boolean NOT NULL DEFAULT true,
  reviewed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT privacy_processing_name_not_blank CHECK (btrim(activity_name) <> ''),
  CONSTRAINT privacy_processing_basis_not_blank CHECK (btrim(lawful_basis) <> '')
);
CREATE INDEX ix_privacy_processing_active ON privacy_processing_activities(active, updated_at DESC);
CREATE TRIGGER trg_privacy_processing_updated_at BEFORE UPDATE ON privacy_processing_activities FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TABLE privacy_retention_policies (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  data_category varchar(160) NOT NULL,
  retention_days integer,
  trigger_event varchar(160) NOT NULL,
  action varchar(40) NOT NULL,
  legal_hold_exempt boolean NOT NULL DEFAULT true,
  notes text,
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT privacy_retention_days_positive CHECK (retention_days IS NULL OR retention_days > 0),
  CONSTRAINT privacy_retention_action_valid CHECK (action IN ('delete','anonymise','review','archive'))
);
CREATE UNIQUE INDEX ux_privacy_retention_category_active ON privacy_retention_policies(lower(data_category)) WHERE active=true;
CREATE TRIGGER trg_privacy_retention_updated_at BEFORE UPDATE ON privacy_retention_policies FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TABLE privacy_audit_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  actor_user_id uuid REFERENCES users(id) ON DELETE SET NULL,
  subject_user_id uuid REFERENCES users(id) ON DELETE SET NULL,
  event_type varchar(120) NOT NULL,
  resource_type varchar(80),
  resource_id uuid,
  outcome varchar(32) NOT NULL,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT privacy_audit_outcome_valid CHECK (outcome IN ('success','rejected','failed','review_required'))
);
CREATE INDEX ix_privacy_audit_subject_created ON privacy_audit_events(subject_user_id, created_at DESC);
CREATE INDEX ix_privacy_audit_event_created ON privacy_audit_events(event_type, created_at DESC);

COMMIT;
