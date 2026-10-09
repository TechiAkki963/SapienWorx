BEGIN;
ALTER TABLE interviews ADD COLUMN format varchar(16) NOT NULL DEFAULT 'video' CHECK (format IN ('video','phone','in_person'));
ALTER TABLE interviews ADD COLUMN timezone text NOT NULL DEFAULT 'Asia/Kolkata';
ALTER TABLE interviews ADD COLUMN location text NOT NULL DEFAULT '';
ALTER TABLE interviews DROP CONSTRAINT interviews_meeting_url_http;
ALTER TABLE interviews ADD CONSTRAINT interviews_meeting_url_http CHECK ((format='video' AND meeting_url ~ '^https?://') OR (format<>'video' AND (meeting_url='' OR meeting_url ~ '^https?://')));
CREATE TABLE interview_panel (
 interview_id uuid NOT NULL REFERENCES interviews(id) ON DELETE CASCADE,
 recruiter_id uuid NOT NULL REFERENCES recruiter_profiles(user_id) ON DELETE RESTRICT,
 response varchar(16) NOT NULL DEFAULT 'pending' CHECK(response IN ('pending','accepted','declined')),
 responded_at timestamptz,
 PRIMARY KEY(interview_id,recruiter_id)
);
INSERT INTO interview_panel(interview_id,recruiter_id,response,responded_at) SELECT id,recruiter_id,'accepted',created_at FROM interviews;
CREATE INDEX ix_interview_panel_recruiter ON interview_panel(recruiter_id,interview_id);
CREATE TABLE interview_feedback (
 interview_id uuid NOT NULL,
 recruiter_id uuid NOT NULL,
 rating smallint NOT NULL CHECK(rating BETWEEN 1 AND 5),
 recommendation varchar(24) NOT NULL CHECK(recommendation IN ('advance','hold','do_not_advance')),
 notes text NOT NULL CHECK(length(notes) BETWEEN 1 AND 4000),
 submitted_at timestamptz NOT NULL DEFAULT now(),
 PRIMARY KEY(interview_id,recruiter_id),
 FOREIGN KEY(interview_id,recruiter_id) REFERENCES interview_panel(interview_id,recruiter_id) ON DELETE CASCADE
);
CREATE TABLE interview_feedback_audit (
 id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
 interview_id uuid NOT NULL REFERENCES interviews(id) ON DELETE CASCADE,
 recruiter_id uuid NOT NULL REFERENCES recruiter_profiles(user_id),
 rating smallint NOT NULL,
 recommendation varchar(24) NOT NULL,
 notes text NOT NULL,
 submitted_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX ix_interview_feedback_audit ON interview_feedback_audit(interview_id,submitted_at DESC);
COMMIT;
