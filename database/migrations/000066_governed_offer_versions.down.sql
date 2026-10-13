BEGIN;
-- Refuse a lossy rollback while governed-only states or currency precision are
-- present. Roll back the application first, then explicitly retain/export these
-- records before a separately reviewed schema reversal.
DO $$ BEGIN
 IF EXISTS(SELECT 1 FROM recruiter_offers WHERE status NOT IN ('draft','sent','accepted','declined','withdrawn','expired') OR annual_compensation<>round(annual_compensation,2) OR active_version<>1)
 OR EXISTS(SELECT 1 FROM governed_offer_versions WHERE snapshot->>'provenance' IS DISTINCT FROM 'legacy_import')
 OR EXISTS(SELECT 1 FROM offer_templates)
 OR EXISTS(SELECT 1 FROM company_offer_settings)
 OR EXISTS(SELECT 1 FROM company_offer_permissions)
 OR EXISTS(SELECT 1 FROM company_offer_policy_audit)
 OR EXISTS(SELECT 1 FROM offer_approval_requests)
 OR EXISTS(SELECT 1 FROM offer_document_objects)
 OR EXISTS(SELECT 1 FROM offer_attachment_uploads)
 OR EXISTS(SELECT 1 FROM governed_offer_events)
 OR EXISTS(SELECT 1 FROM offer_command_results)
 THEN RAISE EXCEPTION 'governed offer data must be retained before schema reversal'; END IF;
END $$;
DROP TRIGGER offer_tenant_guard ON recruiter_offers;
DROP TRIGGER offer_attachment_tenant_guard ON offer_attachment_uploads;
DROP FUNCTION validate_offer_tenant();
DROP TABLE offer_command_results;
DROP TABLE governed_offer_events;
DROP TABLE offer_document_objects;
DROP TABLE offer_attachment_uploads;
DROP TABLE offer_approval_requests;
DROP TABLE governed_offer_versions;
DROP TABLE offer_template_versions;
DROP TABLE offer_templates;
DROP FUNCTION immutable_offer_snapshot();
DROP TABLE company_offer_policy_audit;
DROP TABLE company_offer_permissions;
DROP TABLE company_offer_settings;
DROP FUNCTION immutable_offer_evidence();
DROP INDEX recruiter_offers_identity_company;
DROP INDEX ux_recruiter_offers_open_application;
ALTER TABLE recruiter_offers DROP COLUMN active_version,ALTER COLUMN annual_compensation TYPE numeric(14,2),DROP CONSTRAINT recruiter_offers_status_check;
ALTER TABLE recruiter_offers ADD CONSTRAINT recruiter_offers_status_check CHECK(status IN ('draft','sent','accepted','declined','withdrawn','expired'));
CREATE UNIQUE INDEX ux_recruiter_offers_open_application ON recruiter_offers(application_id) WHERE status IN ('draft','sent','accepted');
COMMIT;
