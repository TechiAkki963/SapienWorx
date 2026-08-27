-- A self-selected career stage is collected before OTP verification so entry-level
-- and experienced candidates can receive an appropriate onboarding and matching path.
alter table candidates
    add column career_stage varchar(16) not null default 'EXPERIENCED',
    add constraint ck_candidates_career_stage check (career_stage in ('FRESHER', 'EXPERIENCED'));
