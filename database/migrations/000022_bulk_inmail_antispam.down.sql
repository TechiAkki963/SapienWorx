BEGIN;

DROP INDEX IF EXISTS ix_chat_messages_recruiter_recent;
DROP INDEX IF EXISTS ix_chat_threads_recruiter_candidate;

COMMIT;
