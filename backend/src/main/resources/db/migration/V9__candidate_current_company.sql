alter table candidates
    add column current_company varchar(180);

create index ix_candidates_current_company
    on candidates (current_company)
    where current_company is not null;
