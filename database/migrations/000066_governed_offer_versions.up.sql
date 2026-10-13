BEGIN;

-- Additive governance extends existing offer identities and preserves their
-- historical statuses. Legacy letters are explicitly marked as imported.
ALTER TABLE recruiter_offers
 ADD COLUMN active_version integer NOT NULL DEFAULT 1 CHECK(active_version>0),
 ALTER COLUMN annual_compensation TYPE numeric(20,6),
 DROP CONSTRAINT recruiter_offers_status_check;
ALTER TABLE recruiter_offers ADD CONSTRAINT recruiter_offers_status_check
 CHECK(status IN ('draft','awaiting_approval','approved','sent','viewed','accepted','declined','withdrawn','expired','superseded','cancelled'));
CREATE UNIQUE INDEX recruiter_offers_identity_company ON recruiter_offers(id,company_id);
DROP INDEX ux_recruiter_offers_open_application;
CREATE UNIQUE INDEX ux_recruiter_offers_open_application ON recruiter_offers(application_id)
 WHERE status IN ('draft','awaiting_approval','approved','sent','viewed','accepted');

CREATE TABLE company_offer_settings(
 company_id uuid PRIMARY KEY REFERENCES companies(id) ON DELETE CASCADE,
 revision bigint NOT NULL DEFAULT 1 CHECK(revision>0),
 approval_policy jsonb NOT NULL DEFAULT '{"mode":"none","steps":[],"rules":[]}' CHECK(jsonb_typeof(approval_policy)='object'),
 branding jsonb NOT NULL DEFAULT '{}' CHECK(jsonb_typeof(branding)='object'),
 updated_by uuid REFERENCES users(id) ON DELETE SET NULL,
 updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE company_offer_permissions(
 company_id uuid NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
 user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
 permission text NOT NULL CHECK(permission IN ('offer.view','offer.create','offer.edit','offer.send','offer.withdraw','offer.approve','offer.view_compensation','offer.manage_templates','offer.manage_formulas','offer.manage_approval_policy','offer.download_documents','offer.view_audit')),
 allowed boolean NOT NULL,
 updated_by uuid NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
 updated_at timestamptz NOT NULL DEFAULT now(),
 PRIMARY KEY(company_id,user_id,permission)
);
CREATE TABLE company_offer_policy_audit(
 id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
 company_id uuid NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
 actor_id uuid NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
 action text NOT NULL,
 detail jsonb NOT NULL DEFAULT '{}' CHECK(jsonb_typeof(detail)='object'),
 occurred_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX company_offer_policy_audit_tenant ON company_offer_policy_audit(company_id,occurred_at DESC,id DESC);

CREATE TABLE offer_templates(
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 company_id uuid NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
 name varchar(160) NOT NULL CHECK(length(trim(name))>0),
 archived boolean NOT NULL DEFAULT false,
 created_by uuid NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
 created_at timestamptz NOT NULL DEFAULT now(),
 UNIQUE(id,company_id)
);
CREATE INDEX offer_templates_tenant ON offer_templates(company_id,created_at DESC);
CREATE TABLE offer_template_versions(
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 template_id uuid NOT NULL,
 company_id uuid NOT NULL,
 version integer NOT NULL CHECK(version>0),
 status text NOT NULL CHECK(status IN ('draft','in_review','published','archived')),
 definition jsonb NOT NULL CHECK(jsonb_typeof(definition)='object'),
 definition_hash char(64) NOT NULL,
 created_by uuid NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
 created_at timestamptz NOT NULL DEFAULT now(),
 published_at timestamptz,
 FOREIGN KEY(template_id,company_id) REFERENCES offer_templates(id,company_id) ON DELETE CASCADE,
 UNIQUE(template_id,version),UNIQUE(id,company_id)
);
CREATE INDEX offer_template_version_tenant ON offer_template_versions(company_id,template_id,version DESC);

CREATE TABLE governed_offer_versions(
 offer_id uuid NOT NULL,
 company_id uuid NOT NULL,
 version integer NOT NULL CHECK(version>0),
 revision bigint NOT NULL DEFAULT 1 CHECK(revision>0),
 status text NOT NULL CHECK(status IN ('draft','awaiting_approval','approved','sent','viewed','accepted','declined','withdrawn','expired','superseded','cancelled')),
 template_version_id uuid,
 snapshot jsonb NOT NULL CHECK(jsonb_typeof(snapshot)='object'),
 terms_hash char(64) NOT NULL,
 approval_policy jsonb NOT NULL CHECK(jsonb_typeof(approval_policy)='object'),
 created_by uuid NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
 created_at timestamptz NOT NULL DEFAULT now(),
 sent_at timestamptz,
 viewed_at timestamptz,
 responded_at timestamptz,
 expires_at date,
 response_evidence jsonb CHECK(response_evidence IS NULL OR jsonb_typeof(response_evidence)='object'),
 PRIMARY KEY(offer_id,version),UNIQUE(offer_id,version,company_id),
 FOREIGN KEY(offer_id,company_id) REFERENCES recruiter_offers(id,company_id) ON DELETE CASCADE,
 FOREIGN KEY(template_version_id,company_id) REFERENCES offer_template_versions(id,company_id) ON DELETE RESTRICT
);
CREATE INDEX governed_offer_company_status ON governed_offer_versions(company_id,status,created_at DESC);
CREATE INDEX governed_offer_expiry ON governed_offer_versions(expires_at,offer_id,version) WHERE status IN ('sent','viewed');

WITH legacy AS (
 SELECT o.*,jsonb_build_object('provenance','legacy_import','title',o.title,'currency',o.currency,'annual_compensation',o.annual_compensation::text,'joining_date',o.joining_date,'expires_at',o.expires_at,'letter_text',COALESCE(o.notes,''),'candidate_name',COALESCE(cp.full_name,'Candidate profile unavailable'),'job_title',j.title,'job_id',j.id,'company_name',c.display_name) AS captured
 FROM recruiter_offers o JOIN applications a ON a.id=o.application_id JOIN jobs j ON j.id=a.job_id LEFT JOIN candidate_profiles cp ON cp.user_id=a.candidate_id JOIN companies c ON c.id=o.company_id
)
INSERT INTO governed_offer_versions(offer_id,company_id,version,status,snapshot,terms_hash,approval_policy,created_by,created_at,sent_at,responded_at,expires_at)
 SELECT id,company_id,1,status,captured,encode(digest(captured::text,'sha256'),'hex'),'{"mode":"none","steps":[],"rules":[]}',recruiter_id,created_at,sent_at,responded_at,expires_at FROM legacy;

CREATE TABLE offer_approval_requests(
 offer_id uuid NOT NULL,version integer NOT NULL,company_id uuid NOT NULL,
 step integer NOT NULL CHECK(step>=1 AND step<=20),
 approver_id uuid NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
 decision text NOT NULL DEFAULT 'pending' CHECK(decision IN ('pending','approved','rejected','changes_requested')),
 reason varchar(2000) NOT NULL DEFAULT '',
 acted_at timestamptz,
 PRIMARY KEY(offer_id,version,step,approver_id),
 FOREIGN KEY(offer_id,version,company_id) REFERENCES governed_offer_versions(offer_id,version,company_id) ON DELETE CASCADE
);
CREATE INDEX offer_approval_pending ON offer_approval_requests(approver_id,decision,offer_id,version);
CREATE TABLE offer_document_objects(
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 company_id uuid NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
 offer_id uuid NOT NULL,version integer NOT NULL,
 kind text NOT NULL CHECK(kind IN ('letter','annexure')),
 object_key text NOT NULL CHECK(object_key LIKE 'companies/'||company_id::text||'/%'),
 filename varchar(160) NOT NULL,
 sha256 char(64) NOT NULL,
 bytes bigint NOT NULL CHECK(bytes>0 AND bytes<=10485760),
 content_type text NOT NULL DEFAULT 'application/pdf' CHECK(content_type='application/pdf'),
 created_by uuid NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
 created_at timestamptz NOT NULL DEFAULT now(),
 FOREIGN KEY(offer_id,version,company_id) REFERENCES governed_offer_versions(offer_id,version,company_id) ON DELETE CASCADE,
 UNIQUE(offer_id,version,kind,object_key)
);
CREATE UNIQUE INDEX offer_single_version_letter ON offer_document_objects(offer_id,version) WHERE kind='letter';
CREATE INDEX offer_document_version ON offer_document_objects(offer_id,version,created_at);
CREATE TABLE offer_attachment_uploads(
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 company_id uuid NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
 application_id uuid NOT NULL REFERENCES applications(id) ON DELETE CASCADE,
 uploader_id uuid NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
 object_key text NOT NULL UNIQUE CHECK(object_key LIKE 'companies/'||company_id::text||'/%'),
 filename varchar(160) NOT NULL,
 sha256 char(64) NOT NULL,
 bytes bigint NOT NULL CHECK(bytes>0 AND bytes<=1536000),
 created_at timestamptz NOT NULL DEFAULT now(),
 consumed_at timestamptz,
 UNIQUE(company_id,application_id,sha256,filename)
);
CREATE INDEX offer_attachment_tenant_application ON offer_attachment_uploads(company_id,application_id,created_at);
CREATE TABLE governed_offer_events(
 id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
 company_id uuid NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
 offer_id uuid NOT NULL,version integer NOT NULL,
 actor_id uuid REFERENCES users(id) ON DELETE SET NULL,
 kind text NOT NULL,
 detail jsonb NOT NULL DEFAULT '{}' CHECK(jsonb_typeof(detail)='object'),
 occurred_at timestamptz NOT NULL DEFAULT now(),
 FOREIGN KEY(offer_id,version,company_id) REFERENCES governed_offer_versions(offer_id,version,company_id) ON DELETE CASCADE
);
CREATE INDEX governed_offer_audit ON governed_offer_events(company_id,offer_id,version,occurred_at DESC,id DESC);
CREATE TABLE offer_command_results(
 company_id uuid NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
 actor_id uuid NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
 command_key varchar(128) NOT NULL CHECK(length(command_key)>=8),
 request_hash char(64) NOT NULL,
 result jsonb NOT NULL CHECK(jsonb_typeof(result)='object'),
 created_at timestamptz NOT NULL DEFAULT now(),
 PRIMARY KEY(company_id,actor_id,command_key)
);

CREATE FUNCTION immutable_offer_snapshot() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 IF TG_TABLE_NAME='offer_template_versions' THEN
  IF OLD.id IS DISTINCT FROM NEW.id OR OLD.template_id IS DISTINCT FROM NEW.template_id OR OLD.company_id IS DISTINCT FROM NEW.company_id OR OLD.version IS DISTINCT FROM NEW.version OR OLD.created_by IS DISTINCT FROM NEW.created_by OR OLD.created_at IS DISTINCT FROM NEW.created_at THEN RAISE EXCEPTION 'template version identity is immutable'; END IF;
  IF OLD.definition IS DISTINCT FROM NEW.definition OR OLD.definition_hash IS DISTINCT FROM NEW.definition_hash THEN RAISE EXCEPTION 'create a new template version for material changes'; END IF;
 ELSE
  IF OLD.offer_id IS DISTINCT FROM NEW.offer_id OR OLD.company_id IS DISTINCT FROM NEW.company_id OR OLD.version IS DISTINCT FROM NEW.version OR OLD.created_by IS DISTINCT FROM NEW.created_by OR OLD.created_at IS DISTINCT FROM NEW.created_at THEN RAISE EXCEPTION 'offer version identity is immutable'; END IF;
  IF OLD.responded_at IS NOT NULL AND (OLD.responded_at IS DISTINCT FROM NEW.responded_at OR OLD.response_evidence IS DISTINCT FROM NEW.response_evidence) THEN RAISE EXCEPTION 'candidate response evidence is immutable'; END IF;
  IF OLD.snapshot IS DISTINCT FROM NEW.snapshot OR OLD.terms_hash IS DISTINCT FROM NEW.terms_hash OR OLD.template_version_id IS DISTINCT FROM NEW.template_version_id OR OLD.approval_policy IS DISTINCT FROM NEW.approval_policy OR OLD.expires_at IS DISTINCT FROM NEW.expires_at THEN RAISE EXCEPTION 'create a new offer version for material changes'; END IF;
 END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER offer_template_snapshot_guard BEFORE UPDATE ON offer_template_versions FOR EACH ROW EXECUTE FUNCTION immutable_offer_snapshot();
CREATE TRIGGER governed_offer_snapshot_guard BEFORE UPDATE ON governed_offer_versions FOR EACH ROW EXECUTE FUNCTION immutable_offer_snapshot();

CREATE FUNCTION immutable_offer_evidence() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 RAISE EXCEPTION 'offer evidence is append-only';
END $$;
CREATE TRIGGER offer_document_evidence_guard BEFORE UPDATE ON offer_document_objects FOR EACH ROW EXECUTE FUNCTION immutable_offer_evidence();
CREATE TRIGGER offer_event_evidence_guard BEFORE UPDATE ON governed_offer_events FOR EACH ROW EXECUTE FUNCTION immutable_offer_evidence();
CREATE TRIGGER offer_policy_evidence_guard BEFORE UPDATE ON company_offer_policy_audit FOR EACH ROW EXECUTE FUNCTION immutable_offer_evidence();

CREATE FUNCTION validate_offer_tenant() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 IF NOT EXISTS(SELECT 1 FROM applications a JOIN jobs j ON j.id=a.job_id WHERE a.id=NEW.application_id AND j.company_id=NEW.company_id) THEN RAISE EXCEPTION 'offer application belongs to a different company'; END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER offer_tenant_guard BEFORE INSERT OR UPDATE OF application_id,company_id ON recruiter_offers FOR EACH ROW EXECUTE FUNCTION validate_offer_tenant();
CREATE TRIGGER offer_attachment_tenant_guard BEFORE INSERT OR UPDATE OF application_id,company_id ON offer_attachment_uploads FOR EACH ROW EXECUTE FUNCTION validate_offer_tenant();
COMMIT;
