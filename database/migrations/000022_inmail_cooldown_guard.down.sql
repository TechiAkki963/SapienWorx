BEGIN;
DROP TRIGGER IF EXISTS trg_chat_threads_inmail_cooldown ON chat_threads;
DROP FUNCTION IF EXISTS enforce_inmail_thread_cooldown();
COMMIT;
