BEGIN;

CREATE TABLE trust_risk_flags (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  subject_type varchar(24) NOT NULL,
  subject_id uuid NOT NULL,
  risk_type varchar(120) NOT NULL,
  severity varchar(16) NOT NULL,
  status varchar(24) NOT NULL DEFAULT 'pending_review',
  source varchar(120) NOT NULL,
  explanation text NOT NULL,
  evidence jsonb NOT NULL DEFAULT '{}'::jsonb,
  reviewed_by uuid REFERENCES users(id) ON DELETE SET NULL,
  reviewed_at timestamptz,
  review_note text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT trust_risk_subject_valid CHECK (subject_type IN ('job','candidate')),
  CONSTRAINT trust_risk_severity_valid CHECK (severity IN ('low','medium','high','critical')),
  CONSTRAINT trust_risk_status_valid CHECK (status IN ('pending_review','reviewing','dismissed','escalated')),
  CONSTRAINT trust_risk_type_not_blank CHECK (btrim(risk_type) <> ''),
  CONSTRAINT trust_risk_source_not_blank CHECK (btrim(source) <> ''),
  CONSTRAINT trust_risk_explanation_not_blank CHECK (btrim(explanation) <> '')
);
CREATE INDEX ix_trust_risk_flags_status_created ON trust_risk_flags(status, created_at DESC);
CREATE INDEX ix_trust_risk_flags_subject ON trust_risk_flags(subject_type, subject_id, created_at DESC);
CREATE TRIGGER trg_trust_risk_flags_updated_at BEFORE UPDATE ON trust_risk_flags FOR EACH ROW EXECUTE FUNCTION set_updated_at();

COMMIT;
