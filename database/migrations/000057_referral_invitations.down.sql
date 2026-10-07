BEGIN;
ALTER TABLE applications DROP COLUMN referral_id;
DROP TABLE referral_invitation_events;
DROP TABLE referral_invitations;
COMMIT;
