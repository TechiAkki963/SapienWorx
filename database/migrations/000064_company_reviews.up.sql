BEGIN;
CREATE TABLE company_reviews (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), company_id uuid NOT NULL REFERENCES companies(id) ON DELETE RESTRICT,
 author_id uuid NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
 kind varchar(16) NOT NULL CHECK(kind IN('employee','interview')),
 relationship varchar(24) NOT NULL CHECK(relationship IN('current','former','intern','contractor','interview')),
 job_function varchar(160) NOT NULL, location varchar(160) NOT NULL,
 period_start date, period_end date,
 anonymous boolean NOT NULL DEFAULT true, public_name varchar(80),
 overall smallint NOT NULL CHECK(overall BETWEEN 1 AND 5), ratings jsonb NOT NULL DEFAULT '{}' CHECK(jsonb_typeof(ratings)='object'),
 title varchar(160) NOT NULL, pros text NOT NULL, cons text NOT NULL, advice text NOT NULL DEFAULT '',
 recommend boolean, outlook varchar(12) CHECK(outlook IS NULL OR outlook IN('positive','neutral','negative')),
 interview_details jsonb NOT NULL DEFAULT '{}' CHECK(jsonb_typeof(interview_details)='object'),
 verified boolean NOT NULL DEFAULT false, verification_basis varchar(40),
 moderation_status varchar(16) NOT NULL DEFAULT 'pending' CHECK(moderation_status IN('pending','published','rejected','deleted')),
 moderation_flags text[] NOT NULL DEFAULT '{}', moderation_reason text,
 moderated_by uuid REFERENCES users(id) ON DELETE RESTRICT,
 published_at timestamptz, created_at timestamptz NOT NULL DEFAULT now(), edited_at timestamptz,
 revision integer NOT NULL DEFAULT 1,
 CHECK(NOT anonymous OR public_name IS NULL), CHECK(moderation_status<>'published' OR (verified AND published_at IS NOT NULL)),
 CHECK(period_end IS NULL OR period_start IS NULL OR period_end>=period_start)
);
CREATE UNIQUE INDEX ix_company_active_review ON company_reviews(company_id,author_id,kind) WHERE moderation_status<>'deleted';
CREATE INDEX ix_company_review_public ON company_reviews(company_id,kind,published_at DESC) WHERE moderation_status='published';
CREATE INDEX ix_company_review_moderation ON company_reviews(moderation_status,created_at);
CREATE TABLE company_review_responses (
 review_id uuid PRIMARY KEY REFERENCES company_reviews(id) ON DELETE RESTRICT,
 company_id uuid NOT NULL REFERENCES companies(id) ON DELETE RESTRICT,
 actor_id uuid NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
 body text NOT NULL CHECK(length(trim(body)) BETWEEN 20 AND 3000),
 updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE company_review_votes (
 review_id uuid NOT NULL REFERENCES company_reviews(id) ON DELETE CASCADE,
 user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
 created_at timestamptz NOT NULL DEFAULT now(), PRIMARY KEY(review_id,user_id)
);
CREATE TABLE company_review_reports (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),review_id uuid NOT NULL REFERENCES company_reviews(id) ON DELETE RESTRICT,
 reporter_id uuid NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
 kind varchar(16) NOT NULL CHECK(kind IN('report','appeal')),
 reason text NOT NULL CHECK(length(trim(reason)) BETWEEN 10 AND 2000),
 status varchar(16) NOT NULL DEFAULT 'pending' CHECK(status IN('pending','resolved','dismissed')),
 resolution text,reviewed_by uuid REFERENCES users(id) ON DELETE RESTRICT,
 created_at timestamptz NOT NULL DEFAULT now(),reviewed_at timestamptz
);
CREATE UNIQUE INDEX ix_review_pending_report ON company_review_reports(review_id,reporter_id,kind) WHERE status='pending';
COMMENT ON COLUMN company_reviews.author_id IS 'Private moderation identity. Never returned in public/company recruiter payloads or Candidate360.';
COMMIT;
