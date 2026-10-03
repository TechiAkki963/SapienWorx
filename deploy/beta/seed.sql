-- Beta-only deterministic synthetic seed. Credentials are bcrypt hashes from SSM.
-- Never execute this file directly against production.
\set ON_ERROR_STOP on
\getenv beta_fixture_hash BETA_FIXTURE_HASH
\getenv beta_candidate_hash BETA_CANDIDATE_HASH
\getenv beta_recruiter_hash BETA_RECRUITER_HASH
\getenv beta_admin_hash BETA_MASTER_ADMIN_HASH
SELECT current_database() = 'sapienworx_beta' AS beta_database \gset
\if :beta_database
\else
  -- Deliberately fail with a nonzero psql exit code.
  SELECT 1/0;
\endif
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

INSERT INTO companies (
  id, legal_name, display_name, website_url, work_email_domain,
  country_code, city, verification_status, verified_at
) VALUES (
  '10000000-0000-4000-8000-000000000002',
  'Harbor Talent Systems Private Limited',
  'Harbor Talent Systems',
  'https://harbor.example',
  'harbor.example',
  'IN',
  'Pune',
  'verified',
  now() - interval '120 days'
) ON CONFLICT (id) DO NOTHING;

INSERT INTO users (
  id, email, password_hash, role, status, phone_e164,
  email_verified_at, phone_verified_at, last_login_at, is_active
) VALUES
  (
    '20000000-0000-4000-8000-000000000001',
    'recruiter.beta@example.test',
    :'beta_fixture_hash',
    'recruiter', 'active', '+919900000001', now() - interval '90 days',
    now() - interval '90 days', now() - interval '2 hours', true
  ),
  (
    '20000000-0000-4000-8000-000000000002',
    'recruiter.second@sapienworx.local',
    :'beta_fixture_hash',
    'recruiter', 'active', '+919900000002', now() - interval '80 days',
    now() - interval '80 days', now() - interval '4 hours', true
  ),
  (
    '30000000-0000-4000-8000-000000000001',
    'candidate.beta@example.test',
    :'beta_fixture_hash',
    'candidate', 'active', '+919900000011', now() - interval '60 days',
    now() - interval '60 days', now() - interval '1 hour', true
  ),
  (
    '30000000-0000-4000-8000-000000000002',
    'aarav.shah@example.test',
    :'beta_fixture_hash',
    'candidate', 'active', '+919900000012', now() - interval '45 days',
    now() - interval '45 days', now() - interval '6 hours', true
  ),
  (
    '30000000-0000-4000-8000-000000000003',
    'meera.nair@example.test',
    :'beta_fixture_hash',
    'candidate', 'active', '+919900000013', now() - interval '50 days',
    now() - interval '50 days', now() - interval '1 day', true
  ),
  (
    '30000000-0000-4000-8000-000000000004',
    'rohan.kulkarni@example.test',
    :'beta_fixture_hash',
    'candidate', 'active', '+919900000014', now() - interval '30 days',
    now() - interval '30 days', now() - interval '3 hours', true
  ),
  (
    '30000000-0000-4000-8000-000000000005',
    'sana.khan@example.test',
    :'beta_fixture_hash',
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
),
(
  '20000000-0000-4000-8000-000000000002',
  '10000000-0000-4000-8000-000000000002',
  'Kabir Malhotra',
  'Talent Partner',
  'verified',
  now() - interval '80 days'
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

INSERT INTO talent_pool_memberships (recruiter_id, candidate_id, tags) VALUES
  ('20000000-0000-4000-8000-000000000001', '30000000-0000-4000-8000-000000000002', ARRAY['frontend','p2-acceptance']),
  ('20000000-0000-4000-8000-000000000001', '30000000-0000-4000-8000-000000000003', ARRAY['analytics','p2-acceptance']),
  ('20000000-0000-4000-8000-000000000001', '30000000-0000-4000-8000-000000000004', ARRAY['backend','p2-acceptance'])
ON CONFLICT (recruiter_id, candidate_id) DO UPDATE
SET tags=EXCLUDED.tags, updated_at=now();

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


INSERT INTO recruiter_saved_searches(id,recruiter_id,name,filters,alert_enabled,alert_frequency,updated_at) VALUES
 ('a1000000-0000-4000-8000-000000000001','20000000-0000-4000-8000-000000000001','Mumbai engineering talent','{"location":"Mumbai","functional_area":"Technology"}'::jsonb,true,'daily',now()-interval '1 day'),
 ('a1000000-0000-4000-8000-000000000002','20000000-0000-4000-8000-000000000001','Immediate analytics candidates','{"skills":"SQL, Python","max_notice_days":"30"}'::jsonb,false,'weekly',now()-interval '2 days')
ON CONFLICT (id) DO UPDATE SET name=EXCLUDED.name,filters=EXCLUDED.filters,alert_enabled=EXCLUDED.alert_enabled,alert_frequency=EXCLUDED.alert_frequency,updated_at=EXCLUDED.updated_at;

INSERT INTO recruiter_offers(id,application_id,company_id,recruiter_id,title,currency,annual_compensation,joining_date,expires_at,status,notes,sent_at,updated_at) VALUES
 ('a2000000-0000-4000-8000-000000000001','50000000-0000-4000-8000-000000000005','10000000-0000-4000-8000-000000000001','20000000-0000-4000-8000-000000000001','Talent Operations Specialist offer','INR',900000,current_date+30,current_date+7,'sent','Demo offer for recruiter product QA.',now()-interval '4 hours',now()-interval '4 hours')
ON CONFLICT (id) DO NOTHING;

INSERT INTO recruiter_referrals(id,company_id,recruiter_id,candidate_id,job_id,referrer_name,referrer_email,source,status,reward_status,notes,updated_at) VALUES
 ('a3000000-0000-4000-8000-000000000001','10000000-0000-4000-8000-000000000001','20000000-0000-4000-8000-000000000001','30000000-0000-4000-8000-000000000002','40000000-0000-4000-8000-000000000002','Neha Kulkarni','neha@example.test','employee','applied','pending','Strong frontend referral.',now()-interval '3 hours'),
 ('a3000000-0000-4000-8000-000000000002','10000000-0000-4000-8000-000000000001','20000000-0000-4000-8000-000000000001','30000000-0000-4000-8000-000000000003',NULL,'Arjun Menon','arjun@example.test','partner','referred','not_eligible','General analytics talent referral.',now()-interval '1 day')
ON CONFLICT (id) DO NOTHING;



UPDATE users SET password_hash = :'beta_candidate_hash'
WHERE id = '30000000-0000-4000-8000-000000000001';
UPDATE users SET password_hash = :'beta_recruiter_hash'
WHERE id = '20000000-0000-4000-8000-000000000001';
-- Non-acceptance fixture accounts are disabled, so sharing a fixture hash does not
-- create additional public login accounts.
UPDATE users SET is_active = false WHERE id NOT IN (
 '30000000-0000-4000-8000-000000000001', '20000000-0000-4000-8000-000000000001',
 '90000000-0000-4000-8000-000000000001');
INSERT INTO users(id,email,password_hash,role,status,email_verified_at,is_active)
VALUES ('90000000-0000-4000-8000-000000000001','admin.beta@example.test',:'beta_admin_hash','master_admin','active',now(),true)
ON CONFLICT (id) DO UPDATE SET password_hash = EXCLUDED.password_hash;
INSERT INTO admin_profiles(user_id,full_name)
VALUES ('90000000-0000-4000-8000-000000000001','Beta Synthetic Administrator')
ON CONFLICT (user_id) DO NOTHING;

-- Cross-industry jobs reuse the established schema and synthetic company.
WITH industries(label, title, n) AS (VALUES
 ('Technology','Platform Engineer',1),('Healthcare','Clinical Operations Coordinator',2),
 ('BFSI','Banking Operations Associate',3),('Manufacturing','Production Supervisor',4),
 ('Retail','Store Manager',5),('Sales','Account Executive',6),('Marketing','Campaign Specialist',7),
 ('Operations','Operations Coordinator',8),('Logistics','Dispatch Planner',9),
 ('Hospitality','Guest Services Manager',10),('Education','Learning Coordinator',11),
 ('Construction','Site Supervisor',12),('Legal','Legal Operations Associate',13),
 ('Finance','Financial Analyst',14),('HR','HR Generalist',15),('Blue Collar','Warehouse Technician',16))
INSERT INTO jobs(id,company_id,created_by_recruiter_id,title,slug,department,description,
 employment_type,work_mode,city,state,country_code,min_experience_months,max_experience_months,
 min_salary_amount,max_salary_amount,salary_currency,openings,status,published_at)
SELECT ('b0000000-0000-4000-8000-' || lpad(n::text,12,'0'))::uuid,
 '10000000-0000-4000-8000-000000000001','20000000-0000-4000-8000-000000000001',
 title,'beta-industry-' || n,label,'Synthetic beta vacancy for ' || label || '. No real employer or applicant data.',
 'full_time','onsite','Mumbai','Maharashtra','IN',12,60,400000,1000000,'INR',2,'active',now()
FROM industries ON CONFLICT (id) DO NOTHING;
COMMIT;
