BEGIN;

DROP INDEX IF EXISTS workforce.ix_workforce_job_mapping_entity_source;
DROP INDEX IF EXISTS ix_jobs_role_category_trgm;
DROP INDEX IF EXISTS ix_jobs_active_discovery_facets;

COMMIT;
