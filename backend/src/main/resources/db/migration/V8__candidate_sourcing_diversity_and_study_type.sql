alter table candidates
    add column gender varchar(20);

alter table candidate_educations
    add column study_type varchar(32) not null default 'FULL_TIME',
    add constraint ck_candidate_educations_study_type check (
        study_type in ('FULL_TIME', 'PART_TIME', 'CORRESPONDENCE')
    );

create index ix_candidate_educations_study_type
    on candidate_educations (study_type);

create index ix_candidates_gender
    on candidates (gender)
    where gender is not null;
