BEGIN;
ALTER TABLE referral_invitations ALTER COLUMN recruiter_id DROP NOT NULL;
ALTER TABLE referral_invitations ADD COLUMN candidate_referrer_id uuid REFERENCES candidate_profiles(user_id);
ALTER TABLE referral_invitations DROP CONSTRAINT referral_invitations_source_check;
ALTER TABLE referral_invitations ADD CONSTRAINT referral_invitations_source_check CHECK(source IN ('candidate','employee','partner','recruiter','other'));
ALTER TABLE referral_invitations ADD CONSTRAINT referral_invitation_actor_check CHECK((recruiter_id IS NOT NULL AND candidate_referrer_id IS NULL AND source<>'candidate') OR (recruiter_id IS NULL AND candidate_referrer_id IS NOT NULL AND source='candidate' AND job_id IS NOT NULL));
DROP INDEX ux_referral_invite_email_job;
DROP INDEX ux_referral_invite_phone_job;
CREATE UNIQUE INDEX ux_referral_invite_actor_email_job ON referral_invitations(coalesce(recruiter_id,candidate_referrer_id),coalesce(job_id,'00000000-0000-0000-0000-000000000000'::uuid),candidate_email) WHERE cancelled_at IS NULL AND declined_at IS NULL;
CREATE INDEX ix_candidate_referrals ON referral_invitations(candidate_referrer_id,created_at DESC,id) WHERE candidate_referrer_id IS NOT NULL;
ALTER TABLE referral_invitations DROP CONSTRAINT referral_invitations_application_id_key;
-- The canonical application source remains immutable; additional consented recommendations are history.
CREATE TABLE application_referral_history(referral_id uuid PRIMARY KEY REFERENCES referral_invitations(id),application_id uuid NOT NULL REFERENCES applications(id),consented_by uuid NOT NULL REFERENCES candidate_profiles(user_id),consented_at timestamptz NOT NULL DEFAULT now());
CREATE INDEX ix_application_referral_history ON application_referral_history(application_id,consented_at,referral_id);
INSERT INTO application_referral_history(referral_id,application_id,consented_by,consented_at) SELECT id,application_id,candidate_id,applied_at FROM referral_invitations WHERE application_id IS NOT NULL AND candidate_id IS NOT NULL;
COMMIT;
