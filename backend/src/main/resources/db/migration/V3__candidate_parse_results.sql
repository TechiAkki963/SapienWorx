create table candidate_parse_results (
    id uuid primary key,
    candidate_id uuid not null references candidates(id) on delete cascade,
    request_id uuid not null,
    source_file_key varchar(1024) not null,
    status varchar(32) not null,
    parser_version varchar(80) not null,
    schema_version varchar(80) not null,
    parsed_profile jsonb not null,
    warnings jsonb not null,
    processing_duration_millis bigint not null,
    processed_at timestamp with time zone not null,
    constraint uk_candidate_parse_results_request unique (request_id),
    constraint ck_candidate_parse_results_status check (status in ('REVIEW_REQUIRED', 'CONFIRMED', 'DISCARDED')),
    constraint ck_candidate_parse_results_duration_non_negative check (processing_duration_millis >= 0)
);

create index ix_candidate_parse_results_candidate_processed_at
    on candidate_parse_results (candidate_id, processed_at desc);
