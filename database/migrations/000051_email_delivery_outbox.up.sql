BEGIN;

CREATE TABLE email_suppressions (
  email text PRIMARY KEY,
  reason varchar(24) NOT NULL CHECK (reason IN ('bounce','complaint','manual')),
  source varchar(32) NOT NULL DEFAULT 'ses',
  detail text,
  first_seen_at timestamptz NOT NULL DEFAULT now(),
  last_seen_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE email_outbox (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  kind varchar(48) NOT NULL,
  recipient_email text NOT NULL,
  subject varchar(255) NOT NULL,
  text_body text NOT NULL,
  html_body text,
  dedupe_key varchar(160),
  status varchar(20) NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','sending','sent','failed','suppressed')),
  provider_message_id varchar(255),
  attempts integer NOT NULL DEFAULT 0 CHECK (attempts >= 0),
  next_attempt_at timestamptz NOT NULL DEFAULT now(),
  last_error text,
  created_at timestamptz NOT NULL DEFAULT now(),
  sent_at timestamptz,
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT email_outbox_recipient_not_blank CHECK (length(trim(recipient_email)) > 3),
  CONSTRAINT email_outbox_subject_not_blank CHECK (length(trim(subject)) > 0),
  CONSTRAINT email_outbox_text_not_blank CHECK (length(trim(text_body)) > 0)
);
CREATE UNIQUE INDEX idx_email_outbox_dedupe ON email_outbox(dedupe_key) WHERE dedupe_key IS NOT NULL;
CREATE INDEX idx_email_outbox_dispatch ON email_outbox(status,next_attempt_at,created_at);

CREATE TABLE email_delivery_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  provider varchar(20) NOT NULL DEFAULT 'ses',
  provider_message_id varchar(255),
  event_type varchar(24) NOT NULL CHECK (event_type IN ('send','delivery','bounce','complaint','reject','delivery_delay')),
  recipient_email text,
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  occurred_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_email_delivery_events_type_time ON email_delivery_events(event_type,occurred_at DESC);
CREATE INDEX idx_email_delivery_events_message ON email_delivery_events(provider_message_id) WHERE provider_message_id IS NOT NULL;
CREATE INDEX idx_email_delivery_events_recipient ON email_delivery_events(recipient_email) WHERE recipient_email IS NOT NULL;

CREATE OR REPLACE FUNCTION touch_email_outbox() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at=now();
  RETURN NEW;
END;
$$;
CREATE TRIGGER trg_email_outbox_touch BEFORE UPDATE ON email_outbox FOR EACH ROW EXECUTE FUNCTION touch_email_outbox();

COMMIT;
