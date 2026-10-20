BEGIN;
-- Removing a required control fails closed in the new gateway.
DELETE FROM intelligence.engine_switches WHERE switch_key IN ('openai_provider','cv_ai_parse','job_ai_parse','jd_ai_generation');
COMMIT;
