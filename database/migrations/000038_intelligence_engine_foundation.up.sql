BEGIN;

CREATE SCHEMA IF NOT EXISTS intelligence;

CREATE TABLE intelligence.events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_type text NOT NULL CHECK (event_type ~ '^[a-z0-9][a-z0-9._-]{2,119}$'),
  aggregate_type text NOT NULL CHECK (aggregate_type ~ '^[a-z0-9][a-z0-9._-]{1,79}$'),
  aggregate_id uuid,
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','processing','processed','failed')),
  attempts integer NOT NULL DEFAULT 0 CHECK (attempts >= 0),
  available_at timestamptz NOT NULL DEFAULT now(),
  locked_at timestamptz,
  processed_at timestamptz,
  last_error text CHECK (last_error IS NULL OR length(last_error) <= 2000),
  created_at timestamptz NOT NULL DEFAULT now(),
  CHECK (jsonb_typeof(payload)='object'),
  CHECK (NOT (payload ?| ARRAY['email','phone','phone_e164','full_name','message','message_text','content','cv','cv_text','resume','resume_text','password','token','secret','private_key']))
);
CREATE INDEX ix_intelligence_events_pending ON intelligence.events(status,available_at,created_at);
CREATE INDEX ix_intelligence_events_aggregate ON intelligence.events(aggregate_type,aggregate_id,created_at DESC);

CREATE TABLE intelligence.skills (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  canonical_name text NOT NULL CHECK (length(btrim(canonical_name)) BETWEEN 1 AND 120),
  normalized_name text NOT NULL UNIQUE CHECK (normalized_name = lower(btrim(normalized_name))),
  category text NOT NULL DEFAULT 'skill' CHECK (length(category) BETWEEN 1 AND 60),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE intelligence.skill_aliases (
  alias text PRIMARY KEY CHECK (alias = lower(btrim(alias)) AND length(alias) BETWEEN 1 AND 120),
  skill_id uuid NOT NULL REFERENCES intelligence.skills(id) ON DELETE CASCADE
);
CREATE INDEX ix_intelligence_skill_aliases_skill ON intelligence.skill_aliases(skill_id);

CREATE TABLE intelligence.skill_relations (
  source_skill_id uuid NOT NULL REFERENCES intelligence.skills(id) ON DELETE CASCADE,
  target_skill_id uuid NOT NULL REFERENCES intelligence.skills(id) ON DELETE CASCADE,
  relation text NOT NULL CHECK (relation IN ('related','framework','tooling','runtime','superset')),
  weight numeric(5,4) NOT NULL DEFAULT 0.5000 CHECK (weight BETWEEN 0 AND 1),
  PRIMARY KEY (source_skill_id,target_skill_id,relation),
  CHECK (source_skill_id <> target_skill_id)
);

CREATE TABLE intelligence.candidate_features (
  candidate_id uuid PRIMARY KEY REFERENCES candidate_profiles(user_id) ON DELETE CASCADE,
  feature_version integer NOT NULL DEFAULT 1 CHECK (feature_version > 0),
  skills text[] NOT NULL DEFAULT '{}',
  experience jsonb NOT NULL DEFAULT '[]'::jsonb,
  education jsonb NOT NULL DEFAULT '[]'::jsonb,
  certifications jsonb NOT NULL DEFAULT '[]'::jsonb,
  projects jsonb NOT NULL DEFAULT '[]'::jsonb,
  domains text[] NOT NULL DEFAULT '{}',
  seniority text NOT NULL DEFAULT 'unknown' CHECK (seniority IN ('entry','junior','mid','senior','lead','executive','unknown')),
  headline text NOT NULL DEFAULT '',
  total_experience_months integer NOT NULL DEFAULT 0 CHECK (total_experience_months >= 0),
  city text,
  state text,
  country_code char(2),
  notice_period_days integer CHECK (notice_period_days IS NULL OR notice_period_days >= 0),
  confidence numeric(5,4) NOT NULL DEFAULT 0.5000 CHECK (confidence BETWEEN 0 AND 1),
  source_event_id uuid REFERENCES intelligence.events(id) ON DELETE SET NULL,
  generated_at timestamptz NOT NULL DEFAULT now(),
  CHECK (jsonb_typeof(experience)='array' AND jsonb_typeof(education)='array' AND jsonb_typeof(certifications)='array' AND jsonb_typeof(projects)='array')
);
CREATE INDEX ix_intelligence_candidate_skills ON intelligence.candidate_features USING gin(skills);
CREATE INDEX ix_intelligence_candidate_location ON intelligence.candidate_features(country_code,state,city);

CREATE TABLE intelligence.job_features (
  job_id uuid PRIMARY KEY REFERENCES jobs(id) ON DELETE CASCADE,
  feature_version integer NOT NULL DEFAULT 1 CHECK (feature_version > 0),
  title text NOT NULL,
  role_family text NOT NULL DEFAULT '',
  role_category text NOT NULL DEFAULT '',
  required_skills text[] NOT NULL DEFAULT '{}',
  min_experience_months integer NOT NULL DEFAULT 0 CHECK (min_experience_months >= 0),
  max_experience_months integer CHECK (max_experience_months IS NULL OR max_experience_months >= min_experience_months),
  employment_type text NOT NULL,
  work_mode text NOT NULL,
  city text,
  state text,
  country_code char(2),
  status text NOT NULL,
  source_event_id uuid REFERENCES intelligence.events(id) ON DELETE SET NULL,
  generated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX ix_intelligence_job_skills ON intelligence.job_features USING gin(required_skills);
CREATE INDEX ix_intelligence_job_status ON intelligence.job_features(status,generated_at DESC);

CREATE TABLE intelligence.model_versions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  engine_type text NOT NULL CHECK (engine_type IN ('candidate_intelligence','matching','resume_parser','recommendation','evaluation','platform_intelligence','ai_gateway')),
  version text NOT NULL CHECK (length(btrim(version)) BETWEEN 1 AND 80),
  provider text NOT NULL DEFAULT 'local' CHECK (length(btrim(provider)) BETWEEN 1 AND 80),
  model_ref text NOT NULL CHECK (length(btrim(model_ref)) BETWEEN 1 AND 200),
  config jsonb NOT NULL DEFAULT '{}'::jsonb,
  status text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','candidate','evaluating','approved','production','retired','rejected')),
  parent_model_id uuid REFERENCES intelligence.model_versions(id) ON DELETE SET NULL,
  approval_id uuid REFERENCES admin_approval_requests(id) ON DELETE SET NULL,
  created_by uuid REFERENCES users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  activated_at timestamptz,
  UNIQUE(engine_type,version),
  CHECK (jsonb_typeof(config)='object')
);
CREATE UNIQUE INDEX ux_intelligence_one_production_model ON intelligence.model_versions(engine_type) WHERE status='production';
CREATE INDEX ix_intelligence_models_status ON intelligence.model_versions(engine_type,status,created_at DESC);

CREATE TABLE intelligence.evaluations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  model_version_id uuid NOT NULL REFERENCES intelligence.model_versions(id) ON DELETE CASCADE,
  dataset_ref text NOT NULL DEFAULT 'observed-production-labels' CHECK (length(dataset_ref) BETWEEN 1 AND 240),
  metrics jsonb NOT NULL DEFAULT '{}'::jsonb,
  quality_gate_status text NOT NULL DEFAULT 'pending' CHECK (quality_gate_status IN ('pending','insufficient_data','passed','failed')),
  requested_by uuid REFERENCES users(id) ON DELETE SET NULL,
  started_at timestamptz NOT NULL DEFAULT now(),
  completed_at timestamptz,
  notes text NOT NULL DEFAULT '' CHECK (length(notes) <= 4000),
  CHECK (jsonb_typeof(metrics)='object')
);
CREATE INDEX ix_intelligence_evaluations_model ON intelligence.evaluations(model_version_id,started_at DESC);

CREATE TABLE intelligence.prompts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  prompt_key text NOT NULL CHECK (prompt_key ~ '^[a-z0-9][a-z0-9._-]{2,99}$'),
  version integer NOT NULL CHECK (version > 0),
  template text NOT NULL CHECK (length(template) BETWEEN 1 AND 20000),
  variables text[] NOT NULL DEFAULT '{}',
  status text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','active','retired')),
  model_version_id uuid REFERENCES intelligence.model_versions(id) ON DELETE SET NULL,
  created_by uuid REFERENCES users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(prompt_key,version)
);
CREATE UNIQUE INDEX ux_intelligence_active_prompt ON intelligence.prompts(prompt_key) WHERE status='active';

CREATE TABLE intelligence.match_results (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  candidate_id uuid NOT NULL REFERENCES candidate_profiles(user_id) ON DELETE CASCADE,
  job_id uuid NOT NULL REFERENCES jobs(id) ON DELETE CASCADE,
  model_version_id uuid NOT NULL REFERENCES intelligence.model_versions(id) ON DELETE RESTRICT,
  eligible boolean NOT NULL,
  score numeric(6,3) NOT NULL CHECK (score BETWEEN 0 AND 100),
  components jsonb NOT NULL DEFAULT '{}'::jsonb,
  explanation jsonb NOT NULL DEFAULT '{}'::jsonb,
  generated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(candidate_id,job_id,model_version_id),
  CHECK (jsonb_typeof(components)='object' AND jsonb_typeof(explanation)='object')
);
CREATE INDEX ix_intelligence_match_candidate_score ON intelligence.match_results(candidate_id,score DESC);
CREATE INDEX ix_intelligence_match_job_score ON intelligence.match_results(job_id,score DESC);

CREATE TABLE intelligence.recommendations (
  candidate_id uuid NOT NULL REFERENCES candidate_profiles(user_id) ON DELETE CASCADE,
  job_id uuid NOT NULL REFERENCES jobs(id) ON DELETE CASCADE,
  model_version_id uuid NOT NULL REFERENCES intelligence.model_versions(id) ON DELETE RESTRICT,
  score numeric(6,3) NOT NULL CHECK (score BETWEEN 0 AND 100),
  rank integer NOT NULL DEFAULT 0 CHECK (rank >= 0),
  explanation jsonb NOT NULL DEFAULT '{}'::jsonb,
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active','accepted','dismissed','expired')),
  generated_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz,
  PRIMARY KEY(candidate_id,job_id),
  CHECK (jsonb_typeof(explanation)='object')
);
CREATE INDEX ix_intelligence_recommendations_candidate_rank ON intelligence.recommendations(candidate_id,status,rank,score DESC);

CREATE TABLE intelligence.feedback_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_type text NOT NULL CHECK (event_type ~ '^[a-z0-9][a-z0-9._-]{2,119}$'),
  candidate_id uuid REFERENCES candidate_profiles(user_id) ON DELETE CASCADE,
  job_id uuid REFERENCES jobs(id) ON DELETE CASCADE,
  application_id uuid REFERENCES applications(id) ON DELETE CASCADE,
  actor_id uuid REFERENCES users(id) ON DELETE SET NULL,
  label numeric(5,2),
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  occurred_at timestamptz NOT NULL DEFAULT now(),
  source_event_id uuid UNIQUE REFERENCES intelligence.events(id) ON DELETE SET NULL,
  CHECK (jsonb_typeof(metadata)='object'),
  CHECK (NOT (metadata ?| ARRAY['email','phone','phone_e164','full_name','message','message_text','content','cv','cv_text','resume','resume_text','password','token','secret','private_key']))
);
CREATE INDEX ix_intelligence_feedback_candidate_job ON intelligence.feedback_events(candidate_id,job_id,occurred_at DESC);
CREATE INDEX ix_intelligence_feedback_type ON intelligence.feedback_events(event_type,occurred_at DESC);

CREATE TABLE intelligence.engine_switches (
  switch_key text PRIMARY KEY CHECK (switch_key ~ '^[a-z0-9][a-z0-9._-]{2,99}$'),
  enabled boolean NOT NULL DEFAULT false,
  requires_approval_to_enable boolean NOT NULL DEFAULT true,
  description text NOT NULL DEFAULT '' CHECK (length(description) <= 1000),
  changed_by uuid REFERENCES users(id) ON DELETE SET NULL,
  approval_id uuid REFERENCES admin_approval_requests(id) ON DELETE SET NULL,
  changed_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE intelligence.gateway_requests (
  id bigserial PRIMARY KEY,
  request_type text NOT NULL CHECK (length(request_type) BETWEEN 2 AND 100),
  provider text NOT NULL CHECK (length(provider) BETWEEN 1 AND 80),
  model_ref text NOT NULL CHECK (length(model_ref) BETWEEN 1 AND 200),
  prompt_key text,
  status text NOT NULL CHECK (status IN ('ok','blocked','failed','disabled')),
  latency_ms integer NOT NULL DEFAULT 0 CHECK (latency_ms >= 0),
  estimated_cost numeric(14,8) NOT NULL DEFAULT 0 CHECK (estimated_cost >= 0),
  input_chars integer NOT NULL DEFAULT 0 CHECK (input_chars >= 0),
  output_chars integer NOT NULL DEFAULT 0 CHECK (output_chars >= 0),
  redaction_count integer NOT NULL DEFAULT 0 CHECK (redaction_count >= 0),
  reference_id text CHECK (reference_id IS NULL OR length(reference_id) <= 200),
  occurred_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX ix_intelligence_gateway_time ON intelligence.gateway_requests(occurred_at DESC,status);

CREATE TABLE intelligence.engine_heartbeats (
  engine_key text PRIMARY KEY CHECK (engine_key ~ '^[a-z0-9][a-z0-9._-]{2,99}$'),
  status text NOT NULL CHECK (status IN ('starting','healthy','degraded','stopped')),
  version text NOT NULL CHECK (length(version) BETWEEN 1 AND 80),
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  last_seen_at timestamptz NOT NULL DEFAULT now(),
  CHECK (jsonb_typeof(metadata)='object')
);

CREATE TABLE intelligence.audit_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  actor_id uuid REFERENCES users(id) ON DELETE SET NULL,
  event_type text NOT NULL CHECK (event_type ~ '^[a-z0-9][a-z0-9._-]{2,119}$'),
  target_type text NOT NULL CHECK (length(target_type) BETWEEN 1 AND 80),
  target_id uuid,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  CHECK (jsonb_typeof(metadata)='object'),
  CHECK (NOT (metadata ?| ARRAY['password','token','secret','private_key','cv','resume','message','content']))
);
CREATE INDEX ix_intelligence_audit_created ON intelligence.audit_events(created_at DESC,event_type);

CREATE OR REPLACE FUNCTION intelligence.enqueue_event(p_event_type text,p_aggregate_type text,p_aggregate_id uuid,p_payload jsonb DEFAULT '{}'::jsonb)
RETURNS uuid
LANGUAGE plpgsql
AS $$
DECLARE v_id uuid;
BEGIN
  INSERT INTO intelligence.events(event_type,aggregate_type,aggregate_id,payload)
  VALUES(p_event_type,p_aggregate_type,p_aggregate_id,COALESCE(p_payload,'{}'::jsonb))
  RETURNING id INTO v_id;
  RETURN v_id;
END;
$$;

CREATE OR REPLACE FUNCTION intelligence.job_event_trigger()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF TG_OP='INSERT' THEN
    PERFORM intelligence.enqueue_event('job.created','job',NEW.id,jsonb_build_object('company_id',NEW.company_id,'status',NEW.status::text));
  ELSIF NEW.title IS DISTINCT FROM OLD.title
     OR NEW.required_skills IS DISTINCT FROM OLD.required_skills
     OR NEW.min_experience_months IS DISTINCT FROM OLD.min_experience_months
     OR NEW.max_experience_months IS DISTINCT FROM OLD.max_experience_months
     OR NEW.city IS DISTINCT FROM OLD.city
     OR NEW.state IS DISTINCT FROM OLD.state
     OR NEW.country_code IS DISTINCT FROM OLD.country_code
     OR NEW.work_mode IS DISTINCT FROM OLD.work_mode
     OR NEW.status IS DISTINCT FROM OLD.status THEN
    PERFORM intelligence.enqueue_event('job.updated','job',NEW.id,jsonb_build_object('company_id',NEW.company_id,'status',NEW.status::text));
  END IF;
  RETURN NEW;
END;
$$;
CREATE TRIGGER trg_intelligence_job_event AFTER INSERT OR UPDATE ON jobs FOR EACH ROW EXECUTE FUNCTION intelligence.job_event_trigger();

CREATE OR REPLACE FUNCTION intelligence.candidate_event_trigger()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF TG_OP='INSERT' THEN
    PERFORM intelligence.enqueue_event('candidate.profile_created','candidate',NEW.user_id,jsonb_build_object('profile_completion',NEW.profile_completion));
  ELSIF NEW.cv_uploaded_at IS DISTINCT FROM OLD.cv_uploaded_at AND NEW.cv_uploaded_at IS NOT NULL THEN
    PERFORM intelligence.enqueue_event('candidate.cv_uploaded','candidate',NEW.user_id,jsonb_build_object('profile_completion',NEW.profile_completion));
  ELSIF NEW.profile_details IS DISTINCT FROM OLD.profile_details
     OR NEW.headline IS DISTINCT FROM OLD.headline
     OR NEW.total_experience_months IS DISTINCT FROM OLD.total_experience_months
     OR NEW.current_city IS DISTINCT FROM OLD.current_city
     OR NEW.current_state IS DISTINCT FROM OLD.current_state
     OR NEW.country_code IS DISTINCT FROM OLD.country_code
     OR NEW.notice_period_days IS DISTINCT FROM OLD.notice_period_days THEN
    PERFORM intelligence.enqueue_event('candidate.profile_updated','candidate',NEW.user_id,jsonb_build_object('profile_completion',NEW.profile_completion));
  END IF;
  RETURN NEW;
END;
$$;
CREATE TRIGGER trg_intelligence_candidate_event AFTER INSERT OR UPDATE ON candidate_profiles FOR EACH ROW EXECUTE FUNCTION intelligence.candidate_event_trigger();

CREATE OR REPLACE FUNCTION intelligence.application_event_trigger()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF TG_OP='INSERT' THEN
    PERFORM intelligence.enqueue_event('application.created','application',NEW.id,jsonb_build_object('candidate_id',NEW.candidate_id,'job_id',NEW.job_id,'stage',NEW.stage::text));
  ELSIF NEW.stage IS DISTINCT FROM OLD.stage THEN
    PERFORM intelligence.enqueue_event('application.stage_changed','application',NEW.id,jsonb_build_object('candidate_id',NEW.candidate_id,'job_id',NEW.job_id,'previous_stage',OLD.stage::text,'stage',NEW.stage::text));
  END IF;
  RETURN NEW;
END;
$$;
CREATE TRIGGER trg_intelligence_application_event AFTER INSERT OR UPDATE ON applications FOR EACH ROW EXECUTE FUNCTION intelligence.application_event_trigger();

CREATE OR REPLACE FUNCTION intelligence.saved_job_event_trigger()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF TG_OP='INSERT' THEN
    PERFORM intelligence.enqueue_event('candidate.job_saved','saved_job',NEW.job_id,jsonb_build_object('candidate_id',NEW.candidate_id,'job_id',NEW.job_id));
    RETURN NEW;
  END IF;
  PERFORM intelligence.enqueue_event('candidate.job_unsaved','saved_job',OLD.job_id,jsonb_build_object('candidate_id',OLD.candidate_id,'job_id',OLD.job_id));
  RETURN OLD;
END;
$$;
CREATE TRIGGER trg_intelligence_saved_job_event AFTER INSERT OR DELETE ON saved_jobs FOR EACH ROW EXECUTE FUNCTION intelligence.saved_job_event_trigger();

-- Initial bounded backfill. Only identifiers and non-sensitive workflow metadata
-- are placed into the event stream; feature workers read permitted normalized fields.
INSERT INTO intelligence.events(event_type,aggregate_type,aggregate_id,payload)
SELECT 'candidate.profile_updated','candidate',user_id,jsonb_build_object('profile_completion',profile_completion)
FROM candidate_profiles;

INSERT INTO intelligence.events(event_type,aggregate_type,aggregate_id,payload)
SELECT 'job.updated','job',id,jsonb_build_object('company_id',company_id,'status',status::text)
FROM jobs;

INSERT INTO intelligence.events(event_type,aggregate_type,aggregate_id,payload)
SELECT 'application.created','application',id,jsonb_build_object('candidate_id',candidate_id,'job_id',job_id,'stage',stage::text)
FROM applications;

INSERT INTO intelligence.skills(canonical_name,normalized_name,category) VALUES
('Go','go','language'),('Java','java','language'),('Python','python','language'),('JavaScript','javascript','language'),
('TypeScript','typescript','language'),('React','react','framework'),('Next.js','next.js','framework'),('PostgreSQL','postgresql','database'),
('SQL','sql','database'),('Docker','docker','platform'),('Kubernetes','kubernetes','platform'),('AWS','aws','cloud'),
('Spring Boot','spring boot','framework'),('Hibernate','hibernate','framework'),('Maven','maven','tooling'),('Gin','gin','framework'),
('Fiber','fiber','framework'),('gRPC','grpc','protocol'),('Figma','figma','tool'),('User Research','user research','design'),
('Product Design','product design','design'),('Talent Acquisition','talent acquisition','recruitment'),
('Technical Recruitment','technical recruitment','recruitment'),('Candidate Sourcing','candidate sourcing','recruitment'),
('Boolean Search','boolean search','recruitment'),('Stakeholder Management','stakeholder management','business'),('ATS','ats','recruitment')
ON CONFLICT(normalized_name) DO NOTHING;

INSERT INTO intelligence.skill_aliases(alias,skill_id)
SELECT v.alias,s.id FROM (VALUES
('golang','go'),('go lang','go'),('postgres','postgresql'),('postgresql','postgresql'),('js','javascript'),('javascript','javascript'),
('ts','typescript'),('typescript','typescript'),('react.js','react'),('react','react'),('nextjs','next.js'),('next.js','next.js'),
('amazon web services','aws'),('aws','aws'),('springboot','spring boot'),('spring boot','spring boot'),
('technical recruiting','technical recruitment'),('technical recruitment','technical recruitment'),
('applicant tracking system','ats'),('ats','ats')
) AS v(alias,normalized_name)
JOIN intelligence.skills s ON s.normalized_name=v.normalized_name
ON CONFLICT(alias) DO NOTHING;

INSERT INTO intelligence.skill_relations(source_skill_id,target_skill_id,relation,weight)
SELECT a.id,b.id,v.relation,v.weight
FROM (VALUES
('java','spring boot','framework',0.85::numeric),('java','hibernate','framework',0.75::numeric),('java','maven','tooling',0.65::numeric),
('go','gin','framework',0.80::numeric),('go','fiber','framework',0.80::numeric),('go','grpc','related',0.70::numeric),
('javascript','typescript','related',0.70::numeric),('javascript','react','framework',0.75::numeric),('typescript','next.js','framework',0.75::numeric)
) AS v(source_name,target_name,relation,weight)
JOIN intelligence.skills a ON a.normalized_name=v.source_name
JOIN intelligence.skills b ON b.normalized_name=v.target_name
ON CONFLICT DO NOTHING;

INSERT INTO intelligence.model_versions(engine_type,version,provider,model_ref,config,status,activated_at) VALUES
('candidate_intelligence','1.0.0','local','candidate-feature-extractor-v1','{"candidate_confirmation_required":true,"raw_cv_persistence":false}'::jsonb,'production',now()),
('matching','1.0.0','local','deterministic-weighted-v1','{"weights":{"skills":0.45,"experience":0.20,"location":0.10,"availability":0.10,"semantic":0.15},"minimum_recommendation_score":55}'::jsonb,'production',now()),
('resume_parser','1.0.0','local','heuristic-parser-v1','{"candidate_confirmation_required":true}'::jsonb,'production',now()),
('recommendation','1.0.0','local','deterministic-explainer-v1','{"explanations":"evidence_only"}'::jsonb,'production',now()),
('platform_intelligence','1.0.0','local','rules-v1','{"autonomous_actions":false}'::jsonb,'production',now()),
('ai_gateway','1.0.0','local','gateway-policy-v1','{"external_providers_enabled":false}'::jsonb,'production',now());

INSERT INTO intelligence.engine_switches(switch_key,enabled,requires_approval_to_enable,description) VALUES
('global_intelligence',false,true,'Master switch for intelligence processing.'),
('candidate_intelligence',false,true,'Generate normalized candidate feature records from verified/profile data.'),
('cv_intelligence',false,true,'Allow CV-derived candidate intelligence after malware scanning and candidate confirmation.'),
('matching',false,true,'Generate deterministic candidate-job match results.'),
('learning_collection',false,true,'Collect non-sensitive outcome and correction feedback for offline evaluation.'),
('automated_recommendations',false,true,'Allow intelligence-generated recommendations to become user-facing defaults.'),
('ai_gateway',false,true,'Allow external or generative model routing through the governed AI Gateway.'),
('model_deployment',false,true,'Allow an evaluated and approved candidate model to be promoted to production.')
ON CONFLICT(switch_key) DO NOTHING;

INSERT INTO intelligence.prompts(prompt_key,version,template,variables,status)
VALUES('match.explanation',1,'Explain the deterministic match using only supplied evidence. Do not infer protected traits or unsupported facts.',ARRAY['match_components','job_title','candidate_headline'],'active')
ON CONFLICT(prompt_key,version) DO NOTHING;

COMMIT;
