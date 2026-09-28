BEGIN;
ALTER TABLE interviews ADD COLUMN round_label varchar(120) NOT NULL DEFAULT 'Interview';
COMMIT;
