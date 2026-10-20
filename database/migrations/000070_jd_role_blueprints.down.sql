BEGIN;
-- Remove only this version's enrichment. Keep taxonomy names that jobs may use.
UPDATE workforce.taxonomy_entities SET metadata=metadata-'jd_generation_blueprint_v1_1' WHERE metadata ? 'jd_generation_blueprint_v1_1';
DELETE FROM workforce.taxonomy_relationships WHERE source='jd_blueprint_v1_1';
UPDATE workforce.taxonomy_relationships SET metadata=metadata-ARRAY['jd_generation_v1_1_core_skills','jd_generation_v1_1_optional_skills','jd_generation_v1_1_common_tools','jd_generation_v1_1_common_competencies','jd_generation_v1_1_job_family','jd_generation_v1_1_functional_area','jd_generation_v1_1_industry_context'] WHERE metadata ?| ARRAY['jd_generation_v1_1_core_skills','jd_generation_v1_1_optional_skills','jd_generation_v1_1_common_tools','jd_generation_v1_1_common_competencies','jd_generation_v1_1_job_family','jd_generation_v1_1_functional_area','jd_generation_v1_1_industry_context'];
COMMIT;
