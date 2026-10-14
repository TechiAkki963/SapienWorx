BEGIN;
CREATE TABLE candidate_application_drafts (
 candidate_id uuid NOT NULL REFERENCES candidate_profiles(user_id) ON DELETE CASCADE,
 job_id uuid NOT NULL REFERENCES jobs(id) ON DELETE CASCADE,
 question_version char(64) NOT NULL,
 questions text[] NOT NULL,
 answers text[] NOT NULL DEFAULT '{}',
 revision bigint NOT NULL DEFAULT 1 CHECK(revision>0),
 updated_at timestamptz NOT NULL DEFAULT now(),
 PRIMARY KEY(candidate_id,job_id)
);
CREATE TABLE application_screening_answers (
 application_id uuid PRIMARY KEY REFERENCES applications(id) ON DELETE CASCADE,
 questions text[] NOT NULL,
 answers text[] NOT NULL,
 CONSTRAINT application_answers_count CHECK(cardinality(questions)=cardinality(answers))
);
CREATE TABLE candidate_job_events (
 id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
 candidate_id uuid NOT NULL REFERENCES candidate_profiles(user_id) ON DELETE CASCADE,
 job_id uuid NOT NULL REFERENCES jobs(id) ON DELETE CASCADE,
 event_type text NOT NULL CHECK(event_type IN ('job_card_viewed','job_saved','job_detail_viewed','apply_clicked','application_started','application_submitted')),
 event_day date NOT NULL DEFAULT CURRENT_DATE,
 occurred_at timestamptz NOT NULL DEFAULT now(),
 UNIQUE(candidate_id,job_id,event_type,event_day)
);
CREATE INDEX candidate_job_events_day ON candidate_job_events(event_day,event_type);
COMMIT;
