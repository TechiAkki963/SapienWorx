BEGIN;
ALTER TABLE jobs
 ADD COLUMN referral_deadline date,
 ADD COLUMN referral_reward_enabled boolean NOT NULL DEFAULT false,
 ADD COLUMN referral_terms text NOT NULL DEFAULT '',
 ADD COLUMN referral_eligibility text NOT NULL DEFAULT '',
 ADD CONSTRAINT jobs_referral_terms_length CHECK(length(referral_terms)<=4000 AND length(referral_eligibility)<=2000),
 ADD CONSTRAINT jobs_referral_reward_terms CHECK(NOT referral_reward_enabled OR (btrim(referral_terms)<>'' AND btrim(referral_eligibility)<>''));
-- Historical jobs keep their existing invitation behaviour and have no promised reward.
COMMIT;
