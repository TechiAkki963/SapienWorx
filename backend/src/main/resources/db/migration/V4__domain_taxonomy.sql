alter table candidates
    add column domain_category varchar(20) not null default 'UNASSIGNED',
    add constraint ck_candidates_domain_category check (
        domain_category in ('TECH', 'NON_TECH', 'MIXED_AMBIGUOUS', 'UNASSIGNED')
    );

alter table jobs
    add column domain_category varchar(20) not null default 'UNASSIGNED',
    add constraint ck_jobs_domain_category check (
        domain_category in ('TECH', 'NON_TECH', 'MIXED_AMBIGUOUS', 'UNASSIGNED')
    );

create index ix_candidates_domain_category on candidates (domain_category);
create index ix_jobs_domain_category on jobs (domain_category);

create table taxonomy_keywords (
    id uuid primary key,
    keyword varchar(120) not null,
    domain varchar(16) not null,
    weight integer not null,
    constraint uk_taxonomy_keywords_keyword unique (keyword),
    constraint ck_taxonomy_keywords_lowercase check (keyword = lower(keyword) and btrim(keyword) <> ''),
    constraint ck_taxonomy_keywords_domain check (domain in ('TECH', 'NON_TECH')),
    constraint ck_taxonomy_keywords_weight check (weight > 0)
);

create index ix_taxonomy_keywords_domain on taxonomy_keywords (domain);

-- Seed terms establish a useful baseline; master administrators can alter the
-- dictionary and weights without a deployment.
insert into taxonomy_keywords (id, keyword, domain, weight) values
    ('00000000-0000-0000-0000-000000000001', 'java', 'TECH', 10),
    ('00000000-0000-0000-0000-000000000002', 'python', 'TECH', 10),
    ('00000000-0000-0000-0000-000000000003', 'javascript', 'TECH', 10),
    ('00000000-0000-0000-0000-000000000004', 'spring', 'TECH', 8),
    ('00000000-0000-0000-0000-000000000005', 'react', 'TECH', 8),
    ('00000000-0000-0000-0000-000000000006', 'sql', 'TECH', 8),
    ('00000000-0000-0000-0000-000000000007', 'docker', 'TECH', 6),
    ('00000000-0000-0000-0000-000000000008', 'kubernetes', 'TECH', 8),
    ('00000000-0000-0000-0000-000000000009', 'aws', 'TECH', 6),
    ('00000000-0000-0000-0000-000000000010', 'sales', 'NON_TECH', 10),
    ('00000000-0000-0000-0000-000000000011', 'marketing', 'NON_TECH', 10),
    ('00000000-0000-0000-0000-000000000012', 'seo', 'NON_TECH', 10),
    ('00000000-0000-0000-0000-000000000013', 'recruitment', 'NON_TECH', 10),
    ('00000000-0000-0000-0000-000000000014', 'human resources', 'NON_TECH', 8),
    ('00000000-0000-0000-0000-000000000015', 'finance', 'NON_TECH', 8),
    ('00000000-0000-0000-0000-000000000016', 'accounting', 'NON_TECH', 8),
    ('00000000-0000-0000-0000-000000000017', 'customer service', 'NON_TECH', 8),
    ('00000000-0000-0000-0000-000000000018', 'operations', 'NON_TECH', 6)
on conflict (keyword) do nothing;
