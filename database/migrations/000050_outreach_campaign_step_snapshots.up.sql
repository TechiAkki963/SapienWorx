BEGIN;

CREATE TABLE outreach_campaign_steps (
  campaign_id uuid NOT NULL REFERENCES outreach_campaigns(id) ON DELETE CASCADE,
  step_order integer NOT NULL CHECK (step_order >= 1 AND step_order <= 12),
  delay_hours integer NOT NULL CHECK (delay_hours >= 0 AND delay_hours <= 720),
  subject_template varchar(255) NOT NULL,
  body_template text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (campaign_id, step_order),
  CONSTRAINT outreach_campaign_steps_subject_not_blank CHECK (length(trim(subject_template)) > 0),
  CONSTRAINT outreach_campaign_steps_body_not_blank CHECK (length(trim(body_template)) > 0)
);

CREATE INDEX idx_outreach_campaign_steps_campaign_order
  ON outreach_campaign_steps(campaign_id, step_order);

COMMIT;
