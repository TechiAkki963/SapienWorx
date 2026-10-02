BEGIN;

DROP TABLE IF EXISTS outreach_delivery_log;
DROP TABLE IF EXISTS outreach_campaign_members;
DROP TABLE IF EXISTS outreach_campaign_steps;
DROP TABLE IF EXISTS outreach_campaigns;
DROP TABLE IF EXISTS outreach_sequence_steps;
DROP TABLE IF EXISTS outreach_sequences;

DROP TYPE IF EXISTS outreach_member_status;
DROP TYPE IF EXISTS outreach_campaign_status;
DROP TYPE IF EXISTS outreach_sequence_status;

COMMIT;
