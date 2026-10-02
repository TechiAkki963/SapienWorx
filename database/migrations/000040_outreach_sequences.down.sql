BEGIN;
DROP TRIGGER IF EXISTS trg_outreach_sequence_step_touch ON outreach_sequence_steps;
DROP TRIGGER IF EXISTS trg_outreach_sequence_touch ON outreach_sequences;
DROP FUNCTION IF EXISTS touch_outreach_sequence();
DROP TABLE IF EXISTS outreach_sequence_launches;
DROP TABLE IF EXISTS outreach_sequence_steps;
DROP TABLE IF EXISTS outreach_sequences;
COMMIT;
