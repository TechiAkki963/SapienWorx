ALTER TABLE jobs
    ADD COLUMN company_overview TEXT NOT NULL DEFAULT '',
    ADD COLUMN why_join TEXT NOT NULL DEFAULT '',
    ADD COLUMN responsibilities_html TEXT NOT NULL DEFAULT '',
    ADD COLUMN hiring_process TEXT NOT NULL DEFAULT '';
