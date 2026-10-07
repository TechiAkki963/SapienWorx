BEGIN;
CREATE TABLE referral_invitations(
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), company_id uuid NOT NULL REFERENCES companies(id), recruiter_id uuid NOT NULL REFERENCES recruiter_profiles(user_id), job_id uuid REFERENCES jobs(id),
 first_name text NOT NULL CHECK(length(trim(first_name)) BETWEEN 1 AND 80), last_name text NOT NULL DEFAULT '' CHECK(length(last_name)<=80), candidate_email text NOT NULL CHECK(candidate_email=lower(trim(candidate_email))), candidate_phone text,
 referrer_name text NOT NULL CHECK(length(trim(referrer_name)) BETWEEN 1 AND 160), referrer_email text, source text NOT NULL CHECK(source IN ('employee','partner','recruiter','other')), relationship text NOT NULL DEFAULT '' CHECK(length(relationship)<=160), note text NOT NULL DEFAULT '' CHECK(length(note)<=5000),
 token_nonce uuid NOT NULL DEFAULT gen_random_uuid(), token_hash bytea NOT NULL, expires_at timestamptz NOT NULL, last_sent_at timestamptz NOT NULL DEFAULT now(), opened_at timestamptz,
 candidate_id uuid REFERENCES candidate_profiles(user_id) ON DELETE SET NULL, linked_at timestamptz, accepted_at timestamptz, declined_at timestamptz, cancelled_at timestamptz, applied_at timestamptz, application_id uuid UNIQUE REFERENCES applications(id) ON DELETE SET NULL,
 reward_status text NOT NULL DEFAULT 'not_eligible' CHECK(reward_status IN ('not_eligible','pending','approved','paid','cancelled')), reward_review_note text, reward_reviewed_by uuid REFERENCES users(id), reward_reviewed_at timestamptz,
 created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(), CHECK(expires_at>created_at)
);
CREATE UNIQUE INDEX ux_referral_invite_email_job ON referral_invitations(company_id,coalesce(job_id,'00000000-0000-0000-0000-000000000000'::uuid),candidate_email) WHERE cancelled_at IS NULL AND declined_at IS NULL;
CREATE UNIQUE INDEX ux_referral_invite_phone_job ON referral_invitations(company_id,coalesce(job_id,'00000000-0000-0000-0000-000000000000'::uuid),candidate_phone) WHERE candidate_phone IS NOT NULL AND cancelled_at IS NULL AND declined_at IS NULL;
CREATE INDEX ix_referral_invitation_company ON referral_invitations(company_id,updated_at DESC);
CREATE TABLE referral_invitation_events(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),referral_id uuid NOT NULL REFERENCES referral_invitations(id) ON DELETE CASCADE,actor_id uuid REFERENCES users(id),action text NOT NULL,created_at timestamptz NOT NULL DEFAULT now());
ALTER TABLE applications ADD COLUMN referral_id uuid REFERENCES referral_invitations(id) ON DELETE SET NULL;
CREATE UNIQUE INDEX ux_application_referral ON applications(referral_id) WHERE referral_id IS NOT NULL;
COMMIT;
