BEGIN;
-- Refuse a lossy rollback once candidate invitations or multiple recommendations exist.
DO $$ BEGIN
 IF EXISTS(SELECT 1 FROM referral_invitations WHERE candidate_referrer_id IS NOT NULL) OR EXISTS(SELECT 1 FROM referral_invitations GROUP BY company_id,coalesce(job_id,'00000000-0000-0000-0000-000000000000'::uuid),candidate_email HAVING count(*) FILTER(WHERE cancelled_at IS NULL AND declined_at IS NULL)>1) OR EXISTS(SELECT 1 FROM referral_invitations WHERE application_id IS NOT NULL GROUP BY application_id HAVING count(*)>1) THEN RAISE EXCEPTION 'Candidate referral data requires preservation before rollback'; END IF;
END $$;
DROP TABLE application_referral_history;
DROP INDEX ix_candidate_referrals;
DROP INDEX ux_referral_invite_actor_email_job;
ALTER TABLE referral_invitations DROP CONSTRAINT referral_invitation_actor_check;
ALTER TABLE referral_invitations DROP COLUMN candidate_referrer_id;
ALTER TABLE referral_invitations ALTER COLUMN recruiter_id SET NOT NULL;
ALTER TABLE referral_invitations DROP CONSTRAINT referral_invitations_source_check;
ALTER TABLE referral_invitations ADD CONSTRAINT referral_invitations_source_check CHECK(source IN ('employee','partner','recruiter','other'));
ALTER TABLE referral_invitations ADD CONSTRAINT referral_invitations_application_id_key UNIQUE(application_id);
CREATE UNIQUE INDEX ux_referral_invite_email_job ON referral_invitations(company_id,coalesce(job_id,'00000000-0000-0000-0000-000000000000'::uuid),candidate_email) WHERE cancelled_at IS NULL AND declined_at IS NULL;
CREATE UNIQUE INDEX ux_referral_invite_phone_job ON referral_invitations(company_id,coalesce(job_id,'00000000-0000-0000-0000-000000000000'::uuid),candidate_phone) WHERE candidate_phone IS NOT NULL AND cancelled_at IS NULL AND declined_at IS NULL;
COMMIT;
