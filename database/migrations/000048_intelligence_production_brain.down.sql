BEGIN;
DELETE FROM intelligence.engine_switches
WHERE switch_key IN ('job_intelligence','embedding_generation','semantic_search','human_review_queue');
DROP FUNCTION IF EXISTS intelligence.cosine_similarity(real[],real[]);
DROP TABLE IF EXISTS intelligence.human_review_queue;
DROP TABLE IF EXISTS intelligence.embedding_documents;
DROP TABLE IF EXISTS intelligence.embedding_models;
DROP TABLE IF EXISTS intelligence.dead_letters;
COMMIT;
