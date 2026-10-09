BEGIN;
ALTER TABLE jobs DROP CONSTRAINT jobs_referral_reward_terms,DROP CONSTRAINT jobs_referral_terms_length,
 DROP COLUMN referral_deadline,DROP COLUMN referral_reward_enabled,DROP COLUMN referral_terms,DROP COLUMN referral_eligibility;
COMMIT;
