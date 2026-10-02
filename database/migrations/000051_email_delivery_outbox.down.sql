BEGIN;
DROP TRIGGER IF EXISTS trg_email_outbox_touch ON email_outbox;
DROP FUNCTION IF EXISTS touch_email_outbox();
DROP TABLE IF EXISTS email_delivery_events;
DROP TABLE IF EXISTS email_outbox;
DROP TABLE IF EXISTS email_suppressions;
COMMIT;
