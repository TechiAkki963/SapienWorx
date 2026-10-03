BEGIN;

-- P2.8 production hardening for the SapienWorx Intelligence runtime.
-- This migration keeps all new capabilities disabled by default and preserves
-- the core recruitment API as the authorization boundary.

CREATE TABLE intelligence.dead_letters (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id uuid NOT NULL UNIQUE REFERENCES intelligence.events(id) ON DELETE CASCADE,
  event_type text NOT NULL,
  aggregate_type text NOT NULL,
  aggregate_id uuid,
  payload jsonb NOT NULL DEFAULT '{}'::jsonb CHECK (jsonb_typeof(payload)='object'),
  attempts integer NOT NULL CHECK (attempts >= 0),
  last_error text NOT NULL DEFAULT '' CHECK (length(last_error) <= 2000),
  failed_at timestamptz NOT NULL DEFAULT now(),
  reviewed_by uuid REFERENCES users(id) ON DELETE SET NULL,
  reviewed_at timestamptz,
  review_note text NOT NULL DEFAULT '' CHECK (length(review_note) <= 2000),
  CHECK (NOT (payload ?| ARRAY['email','phone','phone_e164','full_name','message','message_text','content','cv','cv_text','resume','resume_text','password','token','secret','private_key']))
);
CREATE INDEX ix_intelligence_dead_letters_recent ON intelligence.dead_letters(failed_at DESC);
CREATE INDEX ix_intelligence_dead_letters_type ON intelligence.dead_letters(event_type,failed_at DESC);

CREATE TABLE intelligence.embedding_models (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  model_key text NOT NULL CHECK (model_key ~ '^[a-z0-9][a-z0-9._-]{2,99}$'),
  version text NOT NULL CHECK (length(btrim(version)) BETWEEN 1 AND 80),
  provider text NOT NULL DEFAULT 'local' CHECK (provider IN ('local','gateway')),
  model_ref text NOT NULL CHECK (length(btrim(model_ref)) BETWEEN 1 AND 200),
  dimensions integer NOT NULL CHECK (dimensions BETWEEN 8 AND 4096),
  status text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','candidate','active','retired','rejected')),
  config jsonb NOT NULL DEFAULT '{}'::jsonb CHECK (jsonb_typeof(config)='object'),
  approval_id uuid REFERENCES admin_approval_requests(id) ON DELETE SET NULL,
  created_by uuid REFERENCES users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  activated_at timestamptz,
  UNIQUE(model_key,version)
);
CREATE UNIQUE INDEX ux_intelligence_embedding_model_active
  ON intelligence.embedding_models(model_key) WHERE status='active';

CREATE TABLE intelligence.embedding_documents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  subject_type text NOT NULL CHECK (subject_type IN ('candidate','job','taxonomy')),
  subject_id uuid NOT NULL,
  model_id uuid NOT NULL REFERENCES intelligence.embedding_models(id) ON DELETE RESTRICT,
  content_hash text NOT NULL CHECK (content_hash ~ '^[a-f0-9]{64}$'),
  dimensions integer NOT NULL CHECK (dimensions BETWEEN 8 AND 4096),
  embedding real[] NOT NULL,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb CHECK (jsonb_typeof(metadata)='object'),
  generated_at timestamptz NOT NULL DEFAULT now(),
  CHECK (cardinality(embedding)=dimensions),
  CHECK (NOT (metadata ?| ARRAY['email','phone','phone_e164','full_name','message','message_text','content','cv','cv_text','resume','resume_text','password','token','secret','private_key'])),
  UNIQUE(subject_type,subject_id,model_id)
);
CREATE INDEX ix_intelligence_embedding_subject
  ON intelligence.embedding_documents(subject_type,subject_id,generated_at DESC);
CREATE INDEX ix_intelligence_embedding_model
  ON intelligence.embedding_documents(model_id,generated_at DESC);

CREATE OR REPLACE FUNCTION intelligence.cosine_similarity(a real[], b real[])
RETURNS real
LANGUAGE sql
IMMUTABLE
PARALLEL SAFE
AS $$
  SELECT CASE
    WHEN a IS NULL OR b IS NULL OR cardinality(a)=0 OR cardinality(a)<>cardinality(b) THEN NULL
    ELSE (
      SELECT CASE
        WHEN sqrt(sum(x.v*x.v))*sqrt(sum(y.v*y.v))=0 THEN 0::real
        ELSE (sum(x.v*y.v)/(sqrt(sum(x.v*x.v))*sqrt(sum(y.v*y.v))))::real
      END
      FROM unnest(a) WITH ORDINALITY x(v,n)
      JOIN unnest(b) WITH ORDINALITY y(v,n) USING(n)
    )
  END;
$$;

CREATE TABLE intelligence.human_review_queue (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  review_type text NOT NULL CHECK (review_type IN ('match_quality','taxonomy','model_evaluation','event_failure','recommendation_quality')),
  subject_type text NOT NULL CHECK (subject_type IN ('candidate','job','match','taxonomy','model','event')),
  subject_id uuid,
  priority text NOT NULL DEFAULT 'normal' CHECK (priority IN ('low','normal','high','critical')),
  reason_code text NOT NULL CHECK (reason_code ~ '^[a-z0-9][a-z0-9._-]{2,119}$'),
  evidence jsonb NOT NULL DEFAULT '{}'::jsonb CHECK (jsonb_typeof(evidence)='object'),
  recommendation jsonb NOT NULL DEFAULT '{}'::jsonb CHECK (jsonb_typeof(recommendation)='object'),
  status text NOT NULL DEFAULT 'open' CHECK (status IN ('open','in_review','resolved','dismissed')),
  assigned_to uuid REFERENCES users(id) ON DELETE SET NULL,
  reviewed_by uuid REFERENCES users(id) ON DELETE SET NULL,
  review_note text NOT NULL DEFAULT '' CHECK (length(review_note) <= 4000),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  reviewed_at timestamptz,
  CHECK (NOT (evidence ?| ARRAY['email','phone','phone_e164','full_name','message','message_text','content','cv','cv_text','resume','resume_text','password','token','secret','private_key']))
);
CREATE INDEX ix_intelligence_review_queue_status
  ON intelligence.human_review_queue(status,priority,created_at);
CREATE INDEX ix_intelligence_review_queue_subject
  ON intelligence.human_review_queue(subject_type,subject_id,created_at DESC);

INSERT INTO intelligence.engine_switches(switch_key,enabled,requires_approval_to_enable,description) VALUES
('job_intelligence',false,true,'Generate normalized job feature records from approved recruitment-domain contracts.'),
('embedding_generation',false,true,'Generate governed local or AI-Gateway embeddings for candidate, job and taxonomy search documents.'),
('semantic_search',false,true,'Use approved embeddings as an additional retrieval signal; lexical and structured search remain available as fallback.'),
('human_review_queue',false,true,'Create Intelligence review cases for low-confidence or failed advisory outputs. Master Admin remains the review boundary.')
ON CONFLICT(switch_key) DO NOTHING;

DO $grant$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname='sapienworx_app') THEN
    EXECUTE 'GRANT SELECT ON intelligence.dead_letters, intelligence.embedding_models, intelligence.embedding_documents, intelligence.human_review_queue TO sapienworx_app';
    EXECUTE 'GRANT INSERT, UPDATE ON intelligence.embedding_models, intelligence.human_review_queue TO sapienworx_app';
    EXECUTE 'GRANT EXECUTE ON FUNCTION intelligence.cosine_similarity(real[],real[]) TO sapienworx_app';
  END IF;
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname='sapienworx_intelligence') THEN
    EXECUTE 'GRANT SELECT, INSERT, UPDATE ON intelligence.dead_letters, intelligence.embedding_documents, intelligence.human_review_queue TO sapienworx_intelligence';
    EXECUTE 'GRANT SELECT ON intelligence.embedding_models TO sapienworx_intelligence';
    EXECUTE 'GRANT EXECUTE ON FUNCTION intelligence.cosine_similarity(real[],real[]) TO sapienworx_intelligence';
  END IF;
END $grant$;

COMMIT;
