BEGIN;
CREATE TABLE intelligence_runs (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 run_type text NOT NULL DEFAULT 'platform_analysis' CHECK (run_type='platform_analysis'),
 engine_version text NOT NULL CHECK (length(btrim(engine_version)) BETWEEN 1 AND 80),
 status text NOT NULL DEFAULT 'completed' CHECK (status IN ('completed','failed')),
 metrics jsonb NOT NULL DEFAULT '{}'::jsonb,
 requested_by uuid NOT NULL REFERENCES users(id),
 started_at timestamptz NOT NULL DEFAULT now(),
 completed_at timestamptz NOT NULL DEFAULT now(),
 CHECK (NOT (metrics ?| ARRAY['email','phone','name','message','content','cv','resume','password','token','secret']))
);
CREATE INDEX ix_intelligence_runs_completed ON intelligence_runs(completed_at DESC);
CREATE TABLE intelligence_insights (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 run_id uuid NOT NULL REFERENCES intelligence_runs(id) ON DELETE CASCADE,
 domain text NOT NULL CHECK (domain IN ('recruitment','quality','operations','privacy','governance')),
 insight_key text NOT NULL CHECK (insight_key ~ '^[a-z0-9][a-z0-9._-]{2,99}$'),
 severity text NOT NULL CHECK (severity IN ('info','watch','high')),
 title text NOT NULL CHECK (length(btrim(title)) BETWEEN 3 AND 240),
 rationale text NOT NULL CHECK (length(btrim(rationale)) BETWEEN 3 AND 4000),
 evidence jsonb NOT NULL DEFAULT '{}'::jsonb,
 recommendation text NOT NULL DEFAULT '' CHECK (length(recommendation) <= 2000),
 confidence numeric(5,4) NOT NULL CHECK (confidence BETWEEN 0 AND 1),
 status text NOT NULL DEFAULT 'new' CHECK (status IN ('new','reviewed','dismissed','actioned')),
 reviewed_by uuid REFERENCES users(id),
 reviewed_at timestamptz,
 created_at timestamptz NOT NULL DEFAULT now(),
 CHECK (NOT (evidence ?| ARRAY['email','phone','name','message','content','cv','resume','password','token','secret']))
);
CREATE INDEX ix_intelligence_insights_status ON intelligence_insights(status,severity,created_at DESC);
CREATE INDEX ix_intelligence_insights_run ON intelligence_insights(run_id);
CREATE TABLE intelligence_feedback (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 insight_id uuid NOT NULL REFERENCES intelligence_insights(id) ON DELETE CASCADE,
 admin_id uuid NOT NULL REFERENCES users(id),
 outcome text NOT NULL CHECK (outcome IN ('accepted','rejected','needs_more_data')),
 note text NOT NULL DEFAULT '' CHECK (length(note) <= 2000),
 created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX ix_intelligence_feedback_insight ON intelligence_feedback(insight_id,created_at DESC);
COMMIT;
