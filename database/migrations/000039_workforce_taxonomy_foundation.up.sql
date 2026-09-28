BEGIN;

CREATE SCHEMA IF NOT EXISTS workforce;
CREATE EXTENSION IF NOT EXISTS pg_trgm;

CREATE OR REPLACE FUNCTION workforce.normalize_term(value text)
RETURNS text
LANGUAGE sql
IMMUTABLE
PARALLEL SAFE
AS $$
  SELECT regexp_replace(
    regexp_replace(lower(btrim(coalesce(value,''))), '[^[:alnum:]+#]+', ' ', 'g'),
    '\s+', ' ', 'g'
  );
$$;

CREATE TABLE workforce.taxonomy_entities (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  entity_type text NOT NULL CHECK (entity_type IN (
    'industry','sector','functional_area','job_family','occupation','specialisation',
    'skill','competency','tool','technology','equipment','certification','licence',
    'qualification','language','domain_knowledge','regulatory_requirement','methodology'
  )),
  canonical_name varchar(180) NOT NULL CHECK (length(btrim(canonical_name)) BETWEEN 1 AND 180),
  normalized_name varchar(180) NOT NULL CHECK (normalized_name = workforce.normalize_term(canonical_name)),
  description text NOT NULL DEFAULT '' CHECK (length(description) <= 4000),
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active','deprecated')),
  country_scope varchar(2) NOT NULL DEFAULT '' CHECK (country_scope='' OR country_scope ~ '^[A-Z]{2}$'),
  language_code varchar(12) NOT NULL DEFAULT 'en' CHECK (language_code ~ '^[A-Za-z]{2,3}(?:-[A-Za-z0-9]{2,8})*$'),
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb CHECK (jsonb_typeof(metadata)='object'),
  usage_count bigint NOT NULL DEFAULT 0 CHECK (usage_count >= 0),
  created_by uuid REFERENCES users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX ux_workforce_entity_identity
  ON workforce.taxonomy_entities(entity_type,normalized_name,country_scope,language_code);
CREATE INDEX ix_workforce_entities_type_status
  ON workforce.taxonomy_entities(entity_type,status,usage_count DESC,canonical_name);
CREATE INDEX ix_workforce_entities_name_trgm
  ON workforce.taxonomy_entities USING gin(normalized_name gin_trgm_ops);
CREATE TRIGGER trg_workforce_entities_updated_at
  BEFORE UPDATE ON workforce.taxonomy_entities
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TABLE workforce.taxonomy_aliases (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  entity_id uuid NOT NULL REFERENCES workforce.taxonomy_entities(id) ON DELETE CASCADE,
  alias varchar(180) NOT NULL CHECK (length(btrim(alias)) BETWEEN 1 AND 180),
  normalized_alias varchar(180) NOT NULL CHECK (normalized_alias = workforce.normalize_term(alias)),
  source text NOT NULL DEFAULT 'manual' CHECK (source ~ '^[a-z][a-z0-9_.-]{1,63}$'),
  confidence numeric(5,4) NOT NULL DEFAULT 1.0000 CHECK (confidence BETWEEN 0 AND 1),
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active','deprecated')),
  created_by uuid REFERENCES users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(entity_id,normalized_alias)
);
CREATE INDEX ix_workforce_alias_normalized
  ON workforce.taxonomy_aliases(normalized_alias) WHERE status='active';
CREATE INDEX ix_workforce_alias_trgm
  ON workforce.taxonomy_aliases USING gin(normalized_alias gin_trgm_ops);
CREATE TRIGGER trg_workforce_aliases_updated_at
  BEFORE UPDATE ON workforce.taxonomy_aliases
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TABLE workforce.taxonomy_relationships (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  source_entity_id uuid NOT NULL REFERENCES workforce.taxonomy_entities(id) ON DELETE CASCADE,
  target_entity_id uuid NOT NULL REFERENCES workforce.taxonomy_entities(id) ON DELETE CASCADE,
  relationship_type text NOT NULL CHECK (relationship_type ~ '^[a-z][a-z0-9_]{1,63}$'),
  weight numeric(5,4) NOT NULL DEFAULT 1.0000 CHECK (weight BETWEEN 0 AND 1),
  source text NOT NULL DEFAULT 'manual' CHECK (source ~ '^[a-z][a-z0-9_.-]{1,63}$'),
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active','deprecated')),
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb CHECK (jsonb_typeof(metadata)='object'),
  created_by uuid REFERENCES users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  CHECK (source_entity_id <> target_entity_id),
  UNIQUE(source_entity_id,target_entity_id,relationship_type)
);
CREATE INDEX ix_workforce_rel_source ON workforce.taxonomy_relationships(source_entity_id,relationship_type) WHERE status='active';
CREATE INDEX ix_workforce_rel_target ON workforce.taxonomy_relationships(target_entity_id,relationship_type) WHERE status='active';

CREATE TABLE workforce.provisional_terms (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  raw_term varchar(180) NOT NULL CHECK (length(btrim(raw_term)) BETWEEN 1 AND 180),
  normalized_term varchar(180) NOT NULL CHECK (normalized_term = workforce.normalize_term(raw_term)),
  proposed_entity_type text NOT NULL CHECK (proposed_entity_type IN (
    'industry','sector','functional_area','job_family','occupation','specialisation',
    'skill','competency','tool','technology','equipment','certification','licence',
    'qualification','language','domain_knowledge','regulatory_requirement','methodology'
  )),
  country_scope varchar(2) NOT NULL DEFAULT '' CHECK (country_scope='' OR country_scope ~ '^[A-Z]{2}$'),
  source text NOT NULL CHECK (source ~ '^[a-z][a-z0-9_.-]{1,63}$'),
  source_context text NOT NULL DEFAULT '' CHECK (length(source_context) <= 120),
  occurrence_count bigint NOT NULL DEFAULT 0 CHECK (occurrence_count >= 0),
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','approved','merged','rejected')),
  resolved_entity_id uuid REFERENCES workforce.taxonomy_entities(id) ON DELETE SET NULL,
  created_by uuid REFERENCES users(id) ON DELETE SET NULL,
  reviewed_by uuid REFERENCES users(id) ON DELETE SET NULL,
  review_note text NOT NULL DEFAULT '' CHECK (length(review_note) <= 2000),
  first_seen_at timestamptz NOT NULL DEFAULT now(),
  last_seen_at timestamptz NOT NULL DEFAULT now(),
  reviewed_at timestamptz,
  UNIQUE(proposed_entity_type,normalized_term,country_scope,status)
);
CREATE INDEX ix_workforce_provisional_queue
  ON workforce.provisional_terms(status,occurrence_count DESC,last_seen_at DESC);

CREATE TABLE workforce.term_mappings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  source_type text NOT NULL CHECK (source_type ~ '^[a-z][a-z0-9_.-]{1,63}$'),
  source_id uuid NOT NULL,
  raw_value varchar(180) NOT NULL CHECK (length(btrim(raw_value)) BETWEEN 1 AND 180),
  normalized_value varchar(180) NOT NULL CHECK (normalized_value = workforce.normalize_term(raw_value)),
  entity_id uuid REFERENCES workforce.taxonomy_entities(id) ON DELETE RESTRICT,
  provisional_term_id uuid REFERENCES workforce.provisional_terms(id) ON DELETE RESTRICT,
  mapping_method text NOT NULL CHECK (mapping_method IN ('exact','alias','manual','import','provisional')),
  confidence numeric(5,4) NOT NULL CHECK (confidence BETWEEN 0 AND 1),
  source text NOT NULL CHECK (source ~ '^[a-z][a-z0-9_.-]{1,63}$'),
  created_by uuid REFERENCES users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CHECK ((entity_id IS NOT NULL) <> (provisional_term_id IS NOT NULL)),
  UNIQUE(source_type,source_id,normalized_value)
);
CREATE INDEX ix_workforce_mapping_entity ON workforce.term_mappings(entity_id) WHERE entity_id IS NOT NULL;
CREATE INDEX ix_workforce_mapping_provisional ON workforce.term_mappings(provisional_term_id) WHERE provisional_term_id IS NOT NULL;
CREATE INDEX ix_workforce_mapping_source ON workforce.term_mappings(source_type,source_id);
CREATE TRIGGER trg_workforce_mappings_updated_at
  BEFORE UPDATE ON workforce.term_mappings
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TABLE workforce.taxonomy_changes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_type text NOT NULL CHECK (event_type ~ '^[a-z][a-z0-9_.-]{1,79}$'),
  entity_id uuid REFERENCES workforce.taxonomy_entities(id) ON DELETE SET NULL,
  provisional_term_id uuid REFERENCES workforce.provisional_terms(id) ON DELETE SET NULL,
  actor_id uuid REFERENCES users(id) ON DELETE SET NULL,
  details jsonb NOT NULL DEFAULT '{}'::jsonb CHECK (jsonb_typeof(details)='object'),
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX ix_workforce_changes_recent ON workforce.taxonomy_changes(created_at DESC);
CREATE INDEX ix_workforce_changes_entity ON workforce.taxonomy_changes(entity_id,created_at DESC) WHERE entity_id IS NOT NULL;

CREATE OR REPLACE FUNCTION workforce.resolve_term(p_term text, p_types text[] DEFAULT NULL)
RETURNS TABLE(entity_id uuid, match_method text, confidence numeric)
LANGUAGE sql
STABLE
AS $$
  WITH n AS (
    SELECT workforce.normalize_term(p_term) AS value
  ),
  exact AS (
    SELECT e.id
    FROM workforce.taxonomy_entities e,n
    WHERE e.status='active'
      AND e.normalized_name=n.value
      AND (p_types IS NULL OR e.entity_type=ANY(p_types))
  ),
  alias_matches AS (
    SELECT DISTINCT a.entity_id,a.confidence
    FROM workforce.taxonomy_aliases a
    JOIN workforce.taxonomy_entities e ON e.id=a.entity_id
    JOIN n ON a.normalized_alias=n.value
    WHERE a.status='active' AND e.status='active'
      AND (p_types IS NULL OR e.entity_type=ANY(p_types))
  )
  SELECT e.id,'exact'::text,1.0000::numeric
  FROM exact e
  WHERE (SELECT count(*) FROM exact)=1
  UNION ALL
  SELECT a.entity_id,'alias'::text,a.confidence
  FROM alias_matches a
  WHERE NOT EXISTS (SELECT 1 FROM exact)
    AND (SELECT count(*) FROM alias_matches)=1
  LIMIT 1;
$$;

CREATE OR REPLACE FUNCTION workforce.update_entity_usage()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF TG_OP='INSERT' THEN
    IF NEW.entity_id IS NOT NULL THEN
      UPDATE workforce.taxonomy_entities SET usage_count=usage_count+1 WHERE id=NEW.entity_id;
    END IF;
    RETURN NEW;
  ELSIF TG_OP='DELETE' THEN
    IF OLD.entity_id IS NOT NULL THEN
      UPDATE workforce.taxonomy_entities SET usage_count=greatest(usage_count-1,0) WHERE id=OLD.entity_id;
    END IF;
    RETURN OLD;
  END IF;

  IF OLD.entity_id IS DISTINCT FROM NEW.entity_id THEN
    IF OLD.entity_id IS NOT NULL THEN
      UPDATE workforce.taxonomy_entities SET usage_count=greatest(usage_count-1,0) WHERE id=OLD.entity_id;
    END IF;
    IF NEW.entity_id IS NOT NULL THEN
      UPDATE workforce.taxonomy_entities SET usage_count=usage_count+1 WHERE id=NEW.entity_id;
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_workforce_mapping_usage
AFTER INSERT OR UPDATE OF entity_id OR DELETE ON workforce.term_mappings
FOR EACH ROW EXECUTE FUNCTION workforce.update_entity_usage();

CREATE OR REPLACE FUNCTION workforce.update_provisional_usage()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF TG_OP='INSERT' THEN
    IF NEW.provisional_term_id IS NOT NULL THEN
      UPDATE workforce.provisional_terms SET occurrence_count=occurrence_count+1,last_seen_at=now() WHERE id=NEW.provisional_term_id;
    END IF;
    RETURN NEW;
  ELSIF TG_OP='DELETE' THEN
    IF OLD.provisional_term_id IS NOT NULL THEN
      UPDATE workforce.provisional_terms SET occurrence_count=greatest(occurrence_count-1,0) WHERE id=OLD.provisional_term_id;
    END IF;
    RETURN OLD;
  END IF;

  IF OLD.provisional_term_id IS DISTINCT FROM NEW.provisional_term_id THEN
    IF OLD.provisional_term_id IS NOT NULL THEN
      UPDATE workforce.provisional_terms SET occurrence_count=greatest(occurrence_count-1,0) WHERE id=OLD.provisional_term_id;
    END IF;
    IF NEW.provisional_term_id IS NOT NULL THEN
      UPDATE workforce.provisional_terms SET occurrence_count=occurrence_count+1,last_seen_at=now() WHERE id=NEW.provisional_term_id;
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_workforce_provisional_usage
AFTER INSERT OR UPDATE OF provisional_term_id OR DELETE ON workforce.term_mappings
FOR EACH ROW EXECUTE FUNCTION workforce.update_provisional_usage();

INSERT INTO workforce.taxonomy_entities(entity_type,canonical_name,normalized_name,description,metadata)
VALUES
('occupation','Software Engineer',workforce.normalize_term('Software Engineer'),'Designs and builds software systems.','{"seed":"phase1"}'),
('occupation','Registered Nurse',workforce.normalize_term('Registered Nurse'),'Provides licensed nursing care.','{"seed":"phase1"}'),
('occupation','Area Sales Manager',workforce.normalize_term('Area Sales Manager'),'Leads sales performance across a territory.','{"seed":"phase1"}'),
('occupation','Chartered Accountant',workforce.normalize_term('Chartered Accountant'),'Accounting and finance professional.','{"seed":"phase1"}'),
('occupation','CNC Machine Operator',workforce.normalize_term('CNC Machine Operator'),'Operates computer numerical control machinery.','{"seed":"phase1"}'),
('occupation','School Teacher',workforce.normalize_term('School Teacher'),'Plans and delivers classroom learning.','{"seed":"phase1"}'),
('occupation','Warehouse Supervisor',workforce.normalize_term('Warehouse Supervisor'),'Supervises warehouse operations and teams.','{"seed":"phase1"}'),
('occupation','HR Manager',workforce.normalize_term('HR Manager'),'Leads human resources operations.','{"seed":"phase1"}'),
('occupation','Civil Engineer',workforce.normalize_term('Civil Engineer'),'Designs and supervises civil engineering work.','{"seed":"phase1"}'),
('occupation','Hotel Operations Manager',workforce.normalize_term('Hotel Operations Manager'),'Leads hotel operating functions.','{"seed":"phase1"}'),
('competency','Go',workforce.normalize_term('Go'),'Programming competency.','{"seed":"phase1"}'),
('competency','Java',workforce.normalize_term('Java'),'Programming competency.','{"seed":"phase1"}'),
('competency','SQL',workforce.normalize_term('SQL'),'Structured query language competency.','{"seed":"phase1"}'),
('competency','REST APIs',workforce.normalize_term('REST APIs'),'API design and integration competency.','{"seed":"phase1"}'),
('competency','React',workforce.normalize_term('React'),'User-interface development competency.','{"seed":"phase1"}'),
('competency','Patient Assessment',workforce.normalize_term('Patient Assessment'),'Clinical patient assessment competency.','{"seed":"phase1"}'),
('competency','Medication Administration',workforce.normalize_term('Medication Administration'),'Safe medication administration competency.','{"seed":"phase1"}'),
('competency','Clinical Documentation',workforce.normalize_term('Clinical Documentation'),'Clinical documentation competency.','{"seed":"phase1"}'),
('competency','Emergency Response',workforce.normalize_term('Emergency Response'),'Emergency-response competency.','{"seed":"phase1"}'),
('competency','Critical Care Nursing',workforce.normalize_term('Critical Care Nursing'),'Critical-care nursing competency.','{"seed":"phase1"}'),
('competency','Business Development',workforce.normalize_term('Business Development'),'Business development competency.','{"seed":"phase1"}'),
('competency','Negotiation',workforce.normalize_term('Negotiation'),'Negotiation competency.','{"seed":"phase1"}'),
('competency','Account Management',workforce.normalize_term('Account Management'),'Account management competency.','{"seed":"phase1"}'),
('competency','Forecasting',workforce.normalize_term('Forecasting'),'Forecasting competency.','{"seed":"phase1"}'),
('competency','Team Leadership',workforce.normalize_term('Team Leadership'),'Team leadership competency.','{"seed":"phase1"}'),
('competency','Financial Reporting',workforce.normalize_term('Financial Reporting'),'Financial reporting competency.','{"seed":"phase1"}'),
('competency','Audit',workforce.normalize_term('Audit'),'Audit competency.','{"seed":"phase1"}'),
('competency','Taxation',workforce.normalize_term('Taxation'),'Taxation competency.','{"seed":"phase1"}'),
('competency','Financial Analysis',workforce.normalize_term('Financial Analysis'),'Financial analysis competency.','{"seed":"phase1"}'),
('competency','Accounts Payable',workforce.normalize_term('Accounts Payable'),'Accounts-payable competency.','{"seed":"phase1"}'),
('competency','CNC Operation',workforce.normalize_term('CNC Operation'),'CNC machinery operation competency.','{"seed":"phase1"}'),
('competency','Blueprint Interpretation',workforce.normalize_term('Blueprint Interpretation'),'Reads and interprets technical blueprints.','{"seed":"phase1"}'),
('competency','Quality Inspection',workforce.normalize_term('Quality Inspection'),'Quality inspection competency.','{"seed":"phase1"}'),
('competency','Machine Setup',workforce.normalize_term('Machine Setup'),'Machine setup competency.','{"seed":"phase1"}'),
('competency','Forklift Operation',workforce.normalize_term('Forklift Operation'),'Forklift operation competency.','{"seed":"phase1"}'),
('competency','Classroom Management',workforce.normalize_term('Classroom Management'),'Classroom management competency.','{"seed":"phase1"}'),
('competency','Lesson Planning',workforce.normalize_term('Lesson Planning'),'Lesson planning competency.','{"seed":"phase1"}'),
('competency','Inventory Management',workforce.normalize_term('Inventory Management'),'Inventory management competency.','{"seed":"phase1"}'),
('competency','Warehouse Operations',workforce.normalize_term('Warehouse Operations'),'Warehouse operations competency.','{"seed":"phase1"}'),
('competency','Recruitment',workforce.normalize_term('Recruitment'),'Recruitment competency.','{"seed":"phase1"}'),
('competency','Employee Relations',workforce.normalize_term('Employee Relations'),'Employee relations competency.','{"seed":"phase1"}'),
('competency','Construction Management',workforce.normalize_term('Construction Management'),'Construction management competency.','{"seed":"phase1"}'),
('competency','Guest Services',workforce.normalize_term('Guest Services'),'Guest services competency.','{"seed":"phase1"}'),
('competency','Hotel Operations',workforce.normalize_term('Hotel Operations'),'Hotel operations competency.','{"seed":"phase1"}'),
('tool','Git',workforce.normalize_term('Git'),'Version-control tool.','{"seed":"phase1"}'),
('tool','Docker',workforce.normalize_term('Docker'),'Containerization tool.','{"seed":"phase1"}'),
('tool','CRM',workforce.normalize_term('CRM'),'Customer relationship management tool category.','{"seed":"phase1"}'),
('tool','SAP',workforce.normalize_term('SAP'),'Enterprise resource planning software.','{"seed":"phase1"}'),
('tool','Tally',workforce.normalize_term('Tally'),'Accounting software.','{"seed":"phase1"}'),
('tool','Excel',workforce.normalize_term('Excel'),'Spreadsheet software.','{"seed":"phase1"}'),
('technology','PostgreSQL',workforce.normalize_term('PostgreSQL'),'Relational database technology.','{"seed":"phase1"}'),
('technology','Kubernetes',workforce.normalize_term('Kubernetes'),'Container orchestration technology.','{"seed":"phase1"}'),
('equipment','CNC Lathe',workforce.normalize_term('CNC Lathe'),'Computer numerical control lathe.','{"seed":"phase1"}'),
('equipment','CNC Milling Machine',workforce.normalize_term('CNC Milling Machine'),'Computer numerical control milling machine.','{"seed":"phase1"}'),
('equipment','Forklift',workforce.normalize_term('Forklift'),'Material handling equipment.','{"seed":"phase1"}'),
('certification','BLS',workforce.normalize_term('BLS'),'Basic Life Support certification.','{"seed":"phase1"}'),
('certification','ACLS',workforce.normalize_term('ACLS'),'Advanced Cardiovascular Life Support certification.','{"seed":"phase1"}'),
('licence','Nursing Registration',workforce.normalize_term('Nursing Registration'),'Professional nursing registration/licence.','{"seed":"phase1"}'),
('qualification','Chartered Accountant',workforce.normalize_term('Chartered Accountant'),'Chartered Accountancy qualification.','{"seed":"phase1"}'),
('qualification','BSc Nursing',workforce.normalize_term('BSc Nursing'),'Bachelor of Science in Nursing qualification.','{"seed":"phase1"}')
ON CONFLICT DO NOTHING;

-- Import the accepted Intelligence V1 skill registry as seed input, while keeping
-- the workforce schema as the canonical product-owned source of truth.
INSERT INTO workforce.taxonomy_entities(entity_type,canonical_name,normalized_name,description,metadata)
SELECT 'competency',s.canonical_name,workforce.normalize_term(s.canonical_name),
       'Imported from Intelligence V1 skill registry.',
       jsonb_build_object('source','intelligence_v1','legacy_category',s.category)
FROM intelligence.skills s
WHERE NOT EXISTS (
  SELECT 1 FROM workforce.taxonomy_entities e
  WHERE e.normalized_name=workforce.normalize_term(s.canonical_name)
    AND e.entity_type IN ('skill','competency','tool','technology','equipment')
)
ON CONFLICT DO NOTHING;

WITH alias_seed(alias,canonical_name,entity_type,confidence) AS (
  VALUES
  ('Golang','Go','competency',1.0000::numeric),
  ('Go Lang','Go','competency',0.9900::numeric),
  ('ReactJS','React','competency',1.0000::numeric),
  ('React.js','React','competency',1.0000::numeric),
  ('React JS','React','competency',1.0000::numeric),
  ('Postgres','PostgreSQL','technology',1.0000::numeric),
  ('Amazon RDS PostgreSQL','PostgreSQL','technology',0.9500::numeric),
  ('AP','Accounts Payable','competency',0.9700::numeric),
  ('A/P','Accounts Payable','competency',0.9700::numeric),
  ('Customer Relationship Management','CRM','tool',1.0000::numeric),
  ('CRM Software','CRM','tool',0.9500::numeric),
  ('Fork Lift Operation','Forklift Operation','competency',1.0000::numeric),
  ('Fork Lift Driving','Forklift Operation','competency',0.9800::numeric),
  ('Forklift Driving','Forklift Operation','competency',0.9800::numeric),
  ('ICU Nursing','Critical Care Nursing','competency',1.0000::numeric),
  ('Intensive Care Nursing','Critical Care Nursing','competency',1.0000::numeric),
  ('Basic Life Support','BLS','certification',1.0000::numeric),
  ('Advanced Cardiovascular Life Support','ACLS','certification',1.0000::numeric),
  ('RN Registration','Nursing Registration','licence',0.9500::numeric),
  ('CA','Chartered Accountant','qualification',0.9000::numeric)
)
INSERT INTO workforce.taxonomy_aliases(entity_id,alias,normalized_alias,source,confidence)
SELECT e.id,a.alias,workforce.normalize_term(a.alias),'phase1.seed',a.confidence
FROM alias_seed a
JOIN workforce.taxonomy_entities e
  ON e.canonical_name=a.canonical_name AND e.entity_type=a.entity_type
ON CONFLICT DO NOTHING;

-- Carry forward Intelligence V1 aliases into the core taxonomy where the
-- canonical skill can be resolved unambiguously.
INSERT INTO workforce.taxonomy_aliases(entity_id,alias,normalized_alias,source,confidence)
SELECT target.id,a.alias,workforce.normalize_term(a.alias),'intelligence_v1',0.9500
FROM intelligence.skill_aliases a
JOIN intelligence.skills s ON s.id=a.skill_id
JOIN LATERAL (
  SELECT e.id
  FROM workforce.taxonomy_entities e
  WHERE e.normalized_name=workforce.normalize_term(s.canonical_name)
    AND e.entity_type IN ('skill','competency','tool','technology','equipment')
  ORDER BY CASE e.entity_type WHEN 'competency' THEN 0 WHEN 'skill' THEN 1 WHEN 'technology' THEN 2 WHEN 'tool' THEN 3 ELSE 4 END
  LIMIT 1
) target ON true
ON CONFLICT DO NOTHING;

WITH rel_seed(source_name,source_type,target_name,target_type,relationship_type,weight) AS (
  VALUES
  ('Software Engineer','occupation','Go','competency','occupation_competency',0.9000::numeric),
  ('Software Engineer','occupation','SQL','competency','occupation_competency',0.8500::numeric),
  ('Software Engineer','occupation','REST APIs','competency','occupation_competency',0.8500::numeric),
  ('Registered Nurse','occupation','Patient Assessment','competency','occupation_competency',1.0000::numeric),
  ('Registered Nurse','occupation','Medication Administration','competency','occupation_competency',1.0000::numeric),
  ('Registered Nurse','occupation','Clinical Documentation','competency','occupation_competency',0.9000::numeric),
  ('Registered Nurse','occupation','Nursing Registration','licence','occupation_credential',1.0000::numeric),
  ('Area Sales Manager','occupation','Negotiation','competency','occupation_competency',0.9000::numeric),
  ('Area Sales Manager','occupation','Account Management','competency','occupation_competency',0.9000::numeric),
  ('Area Sales Manager','occupation','Forecasting','competency','occupation_competency',0.8000::numeric),
  ('Chartered Accountant','occupation','Financial Reporting','competency','occupation_competency',1.0000::numeric),
  ('Chartered Accountant','occupation','Audit','competency','occupation_competency',0.9500::numeric),
  ('CNC Machine Operator','occupation','CNC Operation','competency','occupation_competency',1.0000::numeric),
  ('CNC Machine Operator','occupation','Blueprint Interpretation','competency','occupation_competency',0.8500::numeric),
  ('School Teacher','occupation','Classroom Management','competency','occupation_competency',0.9000::numeric),
  ('Warehouse Supervisor','occupation','Warehouse Operations','competency','occupation_competency',1.0000::numeric),
  ('HR Manager','occupation','Employee Relations','competency','occupation_competency',0.9000::numeric),
  ('Civil Engineer','occupation','Construction Management','competency','occupation_competency',0.8000::numeric),
  ('Hotel Operations Manager','occupation','Hotel Operations','competency','occupation_competency',1.0000::numeric),
  ('Hotel Operations Manager','occupation','Guest Services','competency','occupation_competency',0.8500::numeric)
)
INSERT INTO workforce.taxonomy_relationships(source_entity_id,target_entity_id,relationship_type,weight,source)
SELECT s.id,t.id,r.relationship_type,r.weight,'phase1.seed'
FROM rel_seed r
JOIN workforce.taxonomy_entities s ON s.canonical_name=r.source_name AND s.entity_type=r.source_type
JOIN workforce.taxonomy_entities t ON t.canonical_name=r.target_name AND t.entity_type=r.target_type
ON CONFLICT DO NOTHING;

-- Backfill legacy job/candidate raw terms. Exact/alias resolutions become
-- canonical mappings; unknown terms become provisional without blocking users.
WITH raw_terms AS (
  SELECT 'job_required_skill'::text AS source_type,j.id AS source_id,btrim(v)::text AS raw_value
  FROM jobs j CROSS JOIN LATERAL unnest(j.required_skills) v
  WHERE btrim(v)<>''
  UNION ALL
  SELECT 'candidate_skill',cp.user_id,
    btrim(CASE jsonb_typeof(v) WHEN 'object' THEN coalesce(v->>'name','') WHEN 'string' THEN trim(both '"' from v::text) ELSE '' END)
  FROM candidate_profiles cp
  CROSS JOIN LATERAL jsonb_array_elements(CASE WHEN jsonb_typeof(cp.profile_details->'it_skills')='array' THEN cp.profile_details->'it_skills' ELSE '[]'::jsonb END) v
  WHERE btrim(CASE jsonb_typeof(v) WHEN 'object' THEN coalesce(v->>'name','') WHEN 'string' THEN trim(both '"' from v::text) ELSE '' END)<>''
),
resolved AS (
  SELECT r.*,x.entity_id,x.match_method,x.confidence
  FROM raw_terms r
  LEFT JOIN LATERAL workforce.resolve_term(r.raw_value,ARRAY['skill','competency','tool','technology','equipment','certification','licence','qualification','domain_knowledge','methodology']) x ON true
)
INSERT INTO workforce.term_mappings(source_type,source_id,raw_value,normalized_value,entity_id,mapping_method,confidence,source)
SELECT source_type,source_id,raw_value,workforce.normalize_term(raw_value),entity_id,match_method,confidence,'migration.000039'
FROM resolved
WHERE entity_id IS NOT NULL
ON CONFLICT DO NOTHING;

WITH raw_terms AS (
  SELECT 'job_required_skill'::text AS source_type,j.id AS source_id,btrim(v)::text AS raw_value
  FROM jobs j CROSS JOIN LATERAL unnest(j.required_skills) v
  WHERE btrim(v)<>''
  UNION ALL
  SELECT 'candidate_skill',cp.user_id,
    btrim(CASE jsonb_typeof(v) WHEN 'object' THEN coalesce(v->>'name','') WHEN 'string' THEN trim(both '"' from v::text) ELSE '' END)
  FROM candidate_profiles cp
  CROSS JOIN LATERAL jsonb_array_elements(CASE WHEN jsonb_typeof(cp.profile_details->'it_skills')='array' THEN cp.profile_details->'it_skills' ELSE '[]'::jsonb END) v
  WHERE btrim(CASE jsonb_typeof(v) WHEN 'object' THEN coalesce(v->>'name','') WHEN 'string' THEN trim(both '"' from v::text) ELSE '' END)<>''
),
unknown AS (
  SELECT r.raw_value,workforce.normalize_term(r.raw_value) normalized_term,count(*) occurrence_count
  FROM raw_terms r
  WHERE NOT EXISTS (
    SELECT 1 FROM workforce.resolve_term(r.raw_value,ARRAY['skill','competency','tool','technology','equipment','certification','licence','qualification','domain_knowledge','methodology'])
  )
  GROUP BY r.raw_value,workforce.normalize_term(r.raw_value)
)
INSERT INTO workforce.provisional_terms(raw_term,normalized_term,proposed_entity_type,source,source_context,occurrence_count)
SELECT min(raw_value),normalized_term,'competency','migration.000039','legacy_skill_backfill',0
FROM unknown
GROUP BY normalized_term
ON CONFLICT (proposed_entity_type,normalized_term,country_scope,status)
DO UPDATE SET last_seen_at=now();

WITH raw_terms AS (
  SELECT 'job_required_skill'::text AS source_type,j.id AS source_id,btrim(v)::text AS raw_value
  FROM jobs j CROSS JOIN LATERAL unnest(j.required_skills) v
  WHERE btrim(v)<>''
  UNION ALL
  SELECT 'candidate_skill',cp.user_id,
    btrim(CASE jsonb_typeof(v) WHEN 'object' THEN coalesce(v->>'name','') WHEN 'string' THEN trim(both '"' from v::text) ELSE '' END)
  FROM candidate_profiles cp
  CROSS JOIN LATERAL jsonb_array_elements(CASE WHEN jsonb_typeof(cp.profile_details->'it_skills')='array' THEN cp.profile_details->'it_skills' ELSE '[]'::jsonb END) v
  WHERE btrim(CASE jsonb_typeof(v) WHEN 'object' THEN coalesce(v->>'name','') WHEN 'string' THEN trim(both '"' from v::text) ELSE '' END)<>''
)
INSERT INTO workforce.term_mappings(source_type,source_id,raw_value,normalized_value,provisional_term_id,mapping_method,confidence,source)
SELECT r.source_type,r.source_id,r.raw_value,workforce.normalize_term(r.raw_value),p.id,'provisional',0.0000,'migration.000039'
FROM raw_terms r
JOIN workforce.provisional_terms p
  ON p.proposed_entity_type='competency'
 AND p.normalized_term=workforce.normalize_term(r.raw_value)
 AND p.country_scope=''
 AND p.status='pending'
WHERE NOT EXISTS (
  SELECT 1 FROM workforce.term_mappings m
  WHERE m.source_type=r.source_type AND m.source_id=r.source_id AND m.normalized_value=workforce.normalize_term(r.raw_value)
)
ON CONFLICT DO NOTHING;

CREATE OR REPLACE FUNCTION workforce.sync_source_terms(
  p_source_type text,
  p_source_id uuid,
  p_values text[],
  p_entity_type text DEFAULT 'competency',
  p_source text DEFAULT 'runtime.sync'
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public, workforce
AS $$
DECLARE
  raw_term text;
  normalized text;
  resolved_entity uuid;
  resolved_method text;
  resolved_confidence numeric;
  provisional_id uuid;
BEGIN
  DELETE FROM workforce.term_mappings
  WHERE source_type=p_source_type AND source_id=p_source_id;

  FOREACH raw_term IN ARRAY coalesce(p_values,'{}'::text[]) LOOP
    raw_term := btrim(raw_term);
    normalized := workforce.normalize_term(raw_term);
    IF normalized='' THEN
      CONTINUE;
    END IF;

    SELECT r.entity_id,r.match_method,r.confidence
      INTO resolved_entity,resolved_method,resolved_confidence
    FROM workforce.resolve_term(
      raw_term,
      ARRAY['skill','competency','tool','technology','equipment','certification','licence','qualification','domain_knowledge','methodology']
    ) r
    LIMIT 1;

    IF resolved_entity IS NOT NULL THEN
      INSERT INTO workforce.term_mappings(
        source_type,source_id,raw_value,normalized_value,entity_id,mapping_method,confidence,source
      ) VALUES (
        p_source_type,p_source_id,raw_term,normalized,resolved_entity,resolved_method,resolved_confidence,p_source
      )
      ON CONFLICT (source_type,source_id,normalized_value)
      DO UPDATE SET raw_value=EXCLUDED.raw_value,entity_id=EXCLUDED.entity_id,
        provisional_term_id=NULL,mapping_method=EXCLUDED.mapping_method,
        confidence=EXCLUDED.confidence,source=EXCLUDED.source,updated_at=now();
      CONTINUE;
    END IF;

    INSERT INTO workforce.provisional_terms(
      raw_term,normalized_term,proposed_entity_type,source,source_context
    ) VALUES (
      raw_term,normalized,p_entity_type,p_source,p_source_type
    )
    ON CONFLICT (proposed_entity_type,normalized_term,country_scope,status)
    DO UPDATE SET last_seen_at=now()
    RETURNING id INTO provisional_id;

    INSERT INTO workforce.term_mappings(
      source_type,source_id,raw_value,normalized_value,provisional_term_id,mapping_method,confidence,source
    ) VALUES (
      p_source_type,p_source_id,raw_term,normalized,provisional_id,'provisional',0.0000,p_source
    )
    ON CONFLICT (source_type,source_id,normalized_value)
    DO UPDATE SET raw_value=EXCLUDED.raw_value,entity_id=NULL,
      provisional_term_id=EXCLUDED.provisional_term_id,mapping_method='provisional',
      confidence=0.0000,source=EXCLUDED.source,updated_at=now();
  END LOOP;
END;
$$;

CREATE OR REPLACE FUNCTION workforce.sync_job_required_skills()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public, workforce
AS $$
BEGIN
  PERFORM workforce.sync_source_terms('job_required_skill',NEW.id,NEW.required_skills,'competency','job.write');
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION workforce.sync_candidate_competencies()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public, workforce
AS $$
DECLARE
  values text[];
BEGIN
  IF TG_OP='UPDATE' AND (OLD.profile_details->'it_skills') IS NOT DISTINCT FROM (NEW.profile_details->'it_skills') THEN
    RETURN NEW;
  END IF;

  SELECT coalesce(array_agg(term),'{}'::text[]) INTO values
  FROM (
    SELECT btrim(CASE jsonb_typeof(v)
      WHEN 'object' THEN coalesce(v->>'name','')
      WHEN 'string' THEN trim(both '"' from v::text)
      ELSE ''
    END) AS term
    FROM jsonb_array_elements(
      CASE WHEN jsonb_typeof(NEW.profile_details->'it_skills')='array'
        THEN NEW.profile_details->'it_skills' ELSE '[]'::jsonb END
    ) v
  ) q
  WHERE term<>'';

  PERFORM workforce.sync_source_terms('candidate_skill',NEW.user_id,values,'competency','candidate.profile.write');
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_workforce_sync_job_required_skills
AFTER INSERT OR UPDATE OF required_skills ON jobs
FOR EACH ROW EXECUTE FUNCTION workforce.sync_job_required_skills();

CREATE TRIGGER trg_workforce_sync_candidate_competencies
AFTER INSERT OR UPDATE OF profile_details ON candidate_profiles
FOR EACH ROW EXECUTE FUNCTION workforce.sync_candidate_competencies();

REVOKE ALL ON FUNCTION workforce.sync_source_terms(text,uuid,text[],text,text) FROM PUBLIC;
REVOKE ALL ON FUNCTION workforce.sync_job_required_skills() FROM PUBLIC;
REVOKE ALL ON FUNCTION workforce.sync_candidate_competencies() FROM PUBLIC;

DO $workforce$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname='sapienworx_app') THEN
    EXECUTE 'GRANT USAGE ON SCHEMA workforce TO sapienworx_app';
    EXECUTE 'GRANT SELECT ON workforce.taxonomy_entities, workforce.taxonomy_aliases, workforce.taxonomy_relationships, workforce.provisional_terms, workforce.term_mappings, workforce.taxonomy_changes TO sapienworx_app';
    EXECUTE 'GRANT INSERT, UPDATE ON workforce.taxonomy_entities, workforce.taxonomy_aliases, workforce.provisional_terms, workforce.term_mappings TO sapienworx_app';
    EXECUTE 'GRANT INSERT ON workforce.taxonomy_changes TO sapienworx_app';
    EXECUTE 'GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA workforce TO sapienworx_app';
    EXECUTE 'GRANT EXECUTE ON FUNCTION workforce.normalize_term(text) TO sapienworx_app';
    EXECUTE 'GRANT EXECUTE ON FUNCTION workforce.resolve_term(text,text[]) TO sapienworx_app';
  END IF;
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname='sapienworx_intelligence') THEN
    EXECUTE 'GRANT USAGE ON SCHEMA workforce TO sapienworx_intelligence';
    EXECUTE 'GRANT SELECT ON workforce.taxonomy_entities, workforce.taxonomy_aliases, workforce.taxonomy_relationships TO sapienworx_intelligence';
    EXECUTE 'GRANT EXECUTE ON FUNCTION workforce.normalize_term(text) TO sapienworx_intelligence';
    EXECUTE 'GRANT EXECUTE ON FUNCTION workforce.resolve_term(text,text[]) TO sapienworx_intelligence';
  END IF;
END
$workforce$;

COMMIT;
