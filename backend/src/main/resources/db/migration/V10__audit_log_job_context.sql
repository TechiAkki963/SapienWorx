alter table audit_logs
    add column job_id varchar(80);

create index ix_audit_logs_job_occurred_at
    on audit_logs (job_id, occurred_at desc)
    where job_id is not null;
