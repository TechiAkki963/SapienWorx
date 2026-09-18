BEGIN;

-- The bulk anti-spam check filters recruiter-authored messages by sender and
-- recency, then joins through recruiter/candidate threads. These indexes keep
-- the 14-day cooldown check bounded as messaging volume grows.
CREATE INDEX ix_chat_threads_recruiter_candidate
  ON chat_threads (recruiter_id, candidate_id, id);

CREATE INDEX ix_chat_messages_recruiter_recent
  ON chat_messages (sender_id, created_at DESC, thread_id)
  WHERE sender_type='recruiter';

COMMIT;
