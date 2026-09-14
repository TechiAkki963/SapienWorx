BEGIN;

CREATE TYPE chat_thread_status AS ENUM ('open','closed');
CREATE TYPE chat_sender_type AS ENUM ('candidate','recruiter');

CREATE TABLE message_templates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  recruiter_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  title varchar(160) NOT NULL,
  subject_template varchar(255) NOT NULL,
  body_template text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT message_templates_title_not_blank CHECK (length(trim(title)) > 0),
  CONSTRAINT message_templates_subject_not_blank CHECK (length(trim(subject_template)) > 0),
  CONSTRAINT message_templates_body_not_blank CHECK (length(trim(body_template)) > 0)
);
CREATE INDEX idx_message_templates_recruiter ON message_templates(recruiter_id, updated_at DESC);

CREATE TABLE chat_threads (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  recruiter_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  candidate_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  job_id uuid REFERENCES jobs(id) ON DELETE SET NULL,
  subject varchar(255) NOT NULL,
  status chat_thread_status NOT NULL DEFAULT 'open',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT chat_threads_subject_not_blank CHECK (length(trim(subject)) > 0),
  CONSTRAINT chat_threads_different_participants CHECK (recruiter_id <> candidate_id)
);
CREATE INDEX idx_chat_threads_recruiter_updated ON chat_threads(recruiter_id, updated_at DESC);
CREATE INDEX idx_chat_threads_candidate_updated ON chat_threads(candidate_id, updated_at DESC);
CREATE INDEX idx_chat_threads_job ON chat_threads(job_id) WHERE job_id IS NOT NULL;

CREATE TABLE chat_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  thread_id uuid NOT NULL REFERENCES chat_threads(id) ON DELETE CASCADE,
  sender_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  sender_type chat_sender_type NOT NULL,
  content text NOT NULL,
  is_read boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT chat_messages_content_not_blank CHECK (length(trim(content)) > 0)
);
CREATE INDEX idx_chat_messages_thread_created ON chat_messages(thread_id, created_at ASC);
CREATE INDEX idx_chat_messages_unread ON chat_messages(thread_id, created_at DESC) WHERE is_read=false;

CREATE OR REPLACE FUNCTION touch_chat_thread_from_message() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  UPDATE chat_threads SET updated_at=NEW.created_at WHERE id=NEW.thread_id;
  RETURN NEW;
END;
$$;
CREATE TRIGGER trg_chat_message_touch_thread AFTER INSERT ON chat_messages FOR EACH ROW EXECUTE FUNCTION touch_chat_thread_from_message();

CREATE OR REPLACE FUNCTION touch_message_template() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at=now();
  RETURN NEW;
END;
$$;
CREATE TRIGGER trg_message_template_touch BEFORE UPDATE ON message_templates FOR EACH ROW EXECUTE FUNCTION touch_message_template();

COMMIT;
