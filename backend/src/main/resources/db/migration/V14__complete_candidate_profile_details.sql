-- Rich candidate-owned information stays in a protected JSON document while
-- searchable skills and education retain their normalised queryable fields.
alter table candidates
    add column profile_details jsonb not null default '{}'::jsonb;

alter table candidate_skills
    add column experience_months integer,
    add column software_version varchar(80),
    add column last_used_year integer,
    add constraint ck_candidate_skills_experience_months check (experience_months is null or experience_months between 0 and 11),
    add constraint ck_candidate_skills_last_used_year check (last_used_year is null or last_used_year between 1900 and 2200);

alter table candidate_educations
    add column course_start_year integer,
    add column specialization varchar(180),
    drop constraint if exists ck_candidate_educations_level,
    add constraint ck_candidate_educations_level check (level in ('SECONDARY', 'SENIOR_SECONDARY', 'DIPLOMA', 'BACHELORS', 'MASTERS', 'POST_GRADUATION', 'DOCTORATE', 'OTHER')),
    add constraint ck_candidate_educations_course_start_year check (course_start_year is null or course_start_year between 1900 and 2200),
    add constraint ck_candidate_educations_course_year_range check (course_start_year is null or graduation_year is null or course_start_year <= graduation_year);
