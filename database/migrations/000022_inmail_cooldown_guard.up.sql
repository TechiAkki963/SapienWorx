BEGIN;

CREATE OR REPLACE FUNCTION enforce_inmail_thread_cooldown()
RETURNS trigger AS $$
DECLARE
  recent_exists boolean;
BEGIN
  -- Serialize concurrent outreach for the same recruiter/candidate pair.
  PERFORM pg_advisory_xact_lock(hashtext(NEW.recruiter_id::text), hashtext(NEW.candidate_id::text));

  SELECT EXISTS(
    SELECT 1
    FROM chat_threads t
    WHERE t.recruiter_id = NEW.recruiter_id
      AND t.candidate_id = NEW.candidate_id
      AND t.created_at >= now() - interval '14 days'
  ) INTO recent_exists;

  IF recent_exists THEN
    RAISE EXCEPTION 'inmail cooldown active for recruiter/candidate pair'
      USING ERRCODE = 'P0001';
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_chat_threads_inmail_cooldown ON chat_threads;
CREATE TRIGGER trg_chat_threads_inmail_cooldown
BEFORE INSERT ON chat_threads
FOR EACH ROW EXECUTE FUNCTION enforce_inmail_thread_cooldown();

COMMIT;
