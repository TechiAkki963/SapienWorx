-- SapienWorx local development seed data.
-- DEVELOPMENT ONLY. Do not execute against production.
--
-- Demo accounts (both use password: SapienDemo#2026)
--   candidate.demo@sapienworx.local
--   recruiter.demo@sapienworx.local
--
-- Run after all migrations:
--   psql "$DATABASE_URL" -f database/seed.dev.sql

BEGIN;

-- Keep IDs deterministic so this file can be rerun safely on a local database.
INSERT INTO companies (
  id, legal_name, display_name, website_url, work_email_domain,
  country_code, city, verification_status, verified_at
) VALUES (
  '10000000-0000-4000-8000-000000000001',
  'Northstar Product Labs Private Limited',
  'Northstar Product Labs',
  'https://example.com',
  'northstar.example',
  'IN',
  'Mumbai',
  'verified',
  now() - interval '180 days'
) ON CONFLICT (id) DO NOTHING;

INSERT INTO users (
  id, email, password_hash, role, status, phone_e164,
  email_verified_at, phone_verified_at, last_login_at, is_active
) VALUES
  (
    '20000000-0000-4000-8000-000000000001',
    'recruiter.demo@sapienworx.local',
    crypt('SapienDemo#2026', gen_salt('bf', 12)),
    'recruiter', 'active', '+919900000001', now() - interval '90 days',
    now() - interval '90 days', now() - interval '2 hours', true
  ),
  (
    '30000000-0000-4000-8000-000000000001',
    'candidate.demo@sapienworx.local',
    crypt('SapienDemo#2026', gen_salt('bf', 12)),
    'candidate', 'active', '+919900000011', now() - interval '60 days',
    now() - interval '60 days', now() - interval '1 hour', true
  ),
  (
    '30000000-0000-4000-8000-000000000002',
    'aarav.shah@example.test',
    crypt('SapienDemo#2026', gen_salt('bf', 12)),
    'candidate', 'active', '+919900000012', now() - interval '45 days',
    now() - interval '45 days', now() - interval '6 hours', true
  ),
  (
    '30000000-0000-4000-8000-000000000003',
    'meera.nair@example.test',
    crypt('SapienDemo#2026', gen_salt('bf', 12)),
    'candidate', 'active', '+919900000013', now() - interval '50 days',
    now() - interval '50 days', now() - interval '1 day', true
  ),
  (
    '30000000-0000-4000-8000-000000000004',
    'rohan.kulkarni@example.test',
    crypt('SapienDemo#2026', gen_salt('bf', 12)),
    'candidate', 'active', '+919900000014', now() - interval '30 days',
    now() - interval '30 days', now() - interval '3 hours', true
  ),
  (
    '30000000-0000-4000-8000-000000000005',
    'sana.khan@example.test',
    crypt('SapienDemo#2026', gen_salt('bf', 12)),
    'candidate', 'active', '+919900000015', now() - interval '40 days',
    now() - interval '40 days', now() - interval '2 days', true
  )
ON CONFLICT (id) DO NOTHING;

INSERT INTO recruiter_profiles (
  user_id, company_id, full_name, designation, verification_status, verified_at
) VALUES (
  '20000000-0000-4000-8000-000000000001',
  '10000000-0000-4000-8000-000000000001',
  'Ananya Deshmukh',
  'Senior Talent Partner',
  'verified',
  now() - interval '90 days'
) ON CONFLICT (user_id) DO NOTHING;

INSERT INTO candidate_profiles (
  user_id, full_name, headline, current_city, current_state, country_code,
  total_experience_months, notice_period_days, current_salary_amount,
  expected_salary_amount, profile_completion
) VALUES
  ('30000000-0000-4000-8000-000000000001', 'Ishita Rao', 'Product Designer · B2B SaaS', 'Mumbai', 'Maharashtra', 'IN', 48, 30, 1050000, 1450000, 92),
  ('30000000-0000-4000-8000-000000000002', 'Aarav Shah', 'Frontend Engineer · React & Next.js', 'Pune', 'Maharashtra', 'IN', 38, 30, 900000, 1300000, 88),
  ('30000000-0000-4000-8000-000000000003', 'Meera Nair', 'Data Analyst · SQL, Python & BI', 'Bengaluru', 'Karnataka', 'IN', 31, 45, 820000, 1150000, 84),
  ('30000000-0000-4000-8000-000000000004', 'Rohan Kulkarni', 'Backend Engineer · Go & PostgreSQL', 'Mumbai', 'Maharashtra', 'IN', 56, 60, 1250000, 1700000, 91),
  ('30000000-0000-4000-8000-000000000005', 'Sana Khan', 'Talent Operations Specialist', 'Hyderabad', 'Telangana', 'IN', 27, 15, 650000, 900000, 79)
ON CONFLICT (user_id) DO NOTHING;

INSERT INTO jobs (
  id, company_id, created_by_recruiter_id, title, slug, department,
  description, employment_type, work_mode, city, state, country_code,
  min_experience_months, max_experience_months, min_salary_amount,
  max_salary_amount, salary_currency, openings, status,
  application_deadline, published_at
) VALUES
  (
    '40000000-0000-4000-8000-000000000001',
    '10000000-0000-4000-8000-000000000001',
    '20000000-0000-4000-8000-000000000001',
    'Senior Product Designer', 'senior-product-designer', 'Product',
    'Own end-to-end product design for workflow-heavy B2B experiences. Partner with product and engineering to turn complex problems into clear, accessible interfaces.',
    'full_time', 'hybrid', 'Mumbai', 'Maharashtra', 'IN', 36, 72,
    1400000, 1900000, 'INR', 2, 'active', current_date + 18, now() - interval '12 days'
  ),
  (
    '40000000-0000-4000-8000-000000000002',
    '10000000-0000-4000-8000-000000000001',
    '20000000-0000-4000-8000-000000000001',
    'Frontend Engineer', 'frontend-engineer', 'Engineering',
    'Build responsive product surfaces in Next.js and TypeScript. Work closely with design systems, accessibility, performance, and frontend platform quality.',
    'full_time', 'hybrid', 'Pune', 'Maharashtra', 'IN', 24, 60,
    1200000, 1800000, 'INR', 3, 'active', current_date + 24, now() - interval '9 days'
  ),
  (
    '40000000-0000-4000-8000-000000000003',
    '10000000-0000-4000-8000-000000000001',
    '20000000-0000-4000-8000-000000000001',
    'Data Analyst', 'data-analyst', 'Analytics',
    'Translate business questions into reliable analysis, dashboards and decision-ready insights using SQL, Python and modern BI tooling.',
    'full_time', 'remote', NULL, NULL, 'IN', 18, 48,
    900000, 1350000, 'INR', 2, 'active', current_date + 14, now() - interval '7 days'
  ),
  (
    '40000000-0000-4000-8000-000000000004',
    '10000000-0000-4000-8000-000000000001',
    '20000000-0000-4000-8000-000000000001',
    'Backend Engineer — Go', 'backend-engineer-go', 'Engineering',
    'Design reliable Go services and PostgreSQL-backed APIs with strong observability, testing and operational discipline.',
    'full_time', 'onsite', 'Mumbai', 'Maharashtra', 'IN', 36, 84,
    1500000, 2200000, 'INR', 1, 'active', current_date + 10, now() - interval '15 days'
  )
ON CONFLICT (id) DO NOTHING;

INSERT INTO applications (id, candidate_id, job_id, stage, source, applied_at, updated_at) VALUES
  ('50000000-0000-4000-8000-000000000001', '30000000-0000-4000-8000-000000000001', '40000000-0000-4000-8000-000000000001', 'technical_interview', 'direct', now() - interval '8 days', now() - interval '1 day'),
  ('50000000-0000-4000-8000-000000000002', '30000000-0000-4000-8000-000000000002', '40000000-0000-4000-8000-000000000002', 'shortlisted', 'referral', now() - interval '5 days', now() - interval '8 hours'),
  ('50000000-0000-4000-8000-000000000003', '30000000-0000-4000-8000-000000000003', '40000000-0000-4000-8000-000000000003', 'screening', 'direct', now() - interval '3 days', now() - interval '5 hours'),
  ('50000000-0000-4000-8000-000000000004', '30000000-0000-4000-8000-000000000004', '40000000-0000-4000-8000-000000000004', 'final_interview', 'sourcing', now() - interval '11 days', now() - interval '2 days'),
  ('50000000-0000-4000-8000-000000000005', '30000000-0000-4000-8000-000000000005', '40000000-0000-4000-8000-000000000002', 'offer', 'direct', now() - interval '14 days', now() - interval '4 hours'),
  ('50000000-0000-4000-8000-000000000006', '30000000-0000-4000-8000-000000000001', '40000000-0000-4000-8000-000000000003', 'new_application', 'direct', now() - interval '1 day', now() - interval '1 day')
ON CONFLICT (id) DO NOTHING;

INSERT INTO saved_jobs (candidate_id, job_id, saved_at) VALUES
  ('30000000-0000-4000-8000-000000000001', '40000000-0000-4000-8000-000000000002', now() - interval '3 days'),
  ('30000000-0000-4000-8000-000000000001', '40000000-0000-4000-8000-000000000004', now() - interval '2 days')
ON CONFLICT (candidate_id, job_id) DO NOTHING;

INSERT INTO candidate_notifications (
  id, candidate_id, kind, title, body, action_url, read_at, created_at
) VALUES
  ('60000000-0000-4000-8000-000000000001', '30000000-0000-4000-8000-000000000001', 'application_update', 'Interview round confirmed', 'Your Product Designer application moved to the technical interview stage.', '/candidate/applications', NULL, now() - interval '5 hours'),
  ('60000000-0000-4000-8000-000000000002', '30000000-0000-4000-8000-000000000001', 'job_match', 'A new role matches your profile', 'Frontend Engineer is now open in Pune with a hybrid work setup.', '/candidate/jobs/40000000-0000-4000-8000-000000000002', NULL, now() - interval '1 day'),
  ('60000000-0000-4000-8000-000000000003', '30000000-0000-4000-8000-000000000001', 'profile', 'Your profile is nearly complete', 'Add your latest portfolio work to help recruiters understand your impact.', '/candidate/profile', now() - interval '2 days', now() - interval '3 days')
ON CONFLICT (id) DO NOTHING;

INSERT INTO interviews (
  id, application_id, recruiter_id, scheduled_at, duration_minutes,
  meeting_url, status, notes
) VALUES
  (
    '70000000-0000-4000-8000-000000000001',
    '50000000-0000-4000-8000-000000000001',
    '20000000-0000-4000-8000-000000000001',
    now() + interval '1 day 3 hours', 60,
    'https://meet.example.com/product-design-demo', 'scheduled',
    'Portfolio walkthrough and product thinking discussion.'
  ),
  (
    '70000000-0000-4000-8000-000000000002',
    '50000000-0000-4000-8000-000000000004',
    '20000000-0000-4000-8000-000000000001',
    now() + interval '2 days 1 hour', 45,
    'https://meet.example.com/backend-final-demo', 'scheduled',
    'Final engineering and team-fit conversation.'
  )
ON CONFLICT (id) DO NOTHING;

COMMIT;
