BEGIN;

DROP TRIGGER IF EXISTS trg_outreach_enrollments_touch ON outreach_campaign_enrollments;
DROP TRIGGER IF EXISTS trg_outreach_campaigns_touch ON outreach_campaigns;
DROP TRIGGER IF EXISTS trg_outreach_sequences_touch ON outreach_sequences;
DROP FUNCTION IF EXISTS touch_outreach_updated_at();

DROP TABLE IF EXISTS outreach_campaign_enrollments;
DROP TABLE IF EXISTS outreach_campaigns;
DROP TABLE IF EXISTS outreach_sequence_steps;
DROP TABLE IF EXISTS outreach_sequences;

DROP TYPE IF EXISTS outreach_enrollment_status;
DROP TYPE IF EXISTS outreach_campaign_status;
DROP TYPE IF EXISTS outreach_sequence_status;

COMMIT;
