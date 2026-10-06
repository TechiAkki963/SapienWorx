BEGIN;

-- Aggregate candidate-facing performance; no contact, notes or intelligence payloads.
-- A repeated request/refresh counts at most once per verified recruiter and UTC day.
CREATE TABLE candidate_profile_events (
  candidate_id uuid NOT NULL REFERENCES candidate_profiles(user_id) ON DELETE CASCADE,
  recruiter_id uuid NOT NULL REFERENCES recruiter_profiles(user_id) ON DELETE CASCADE,
  event_kind text NOT NULL CHECK(event_kind IN ('profile_view','search_appearance','recruiter_action')),
  event_day date NOT NULL DEFAULT (now() AT TIME ZONE 'UTC')::date,
  occurred_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY(candidate_id,recruiter_id,event_kind,event_day)
);
CREATE INDEX ix_candidate_profile_events_recent ON candidate_profile_events(candidate_id,occurred_at DESC,event_kind);
CREATE INDEX ix_subscription_cv_candidate_time ON subscription_usage_events(candidate_id,occurred_at DESC) WHERE meter_key='cv_view' AND candidate_id IS NOT NULL;
CREATE INDEX ix_applications_candidate_updated ON applications(candidate_id,updated_at DESC,id);
COMMENT ON TABLE candidate_profile_events IS 'Trustworthy server-side successful recruiter discovery/profile events. Daily dedup; candidate API exposes counts only. Existing audited actions are aggregated separately.';

-- A save is an action even if the recruiter later removes the bookmark. Keep
-- the successful insert as a payload-free daily event; never log private tags.
CREATE FUNCTION record_candidate_talent_pool_action() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public,pg_temp AS $$
BEGIN
 INSERT INTO candidate_profile_events(candidate_id,recruiter_id,event_kind)
 SELECT NEW.candidate_id,NEW.recruiter_id,'recruiter_action'
 FROM recruiter_profiles rp JOIN users ru ON ru.id=rp.user_id
 JOIN candidate_profiles cp ON cp.user_id=NEW.candidate_id JOIN users cu ON cu.id=cp.user_id
 WHERE rp.user_id=NEW.recruiter_id AND rp.verification_status='verified'
 AND ru.role='recruiter' AND ru.status='active' AND ru.is_active AND ru.email_verified_at IS NOT NULL
 AND cu.role='candidate' AND cu.status='active' AND cu.is_active
 AND (EXISTS(SELECT 1 FROM applications a JOIN jobs j ON j.id=a.job_id WHERE a.candidate_id=cp.user_id AND j.company_id=rp.company_id)
 OR (lower(trim(coalesce(cp.profile_details->>'discoverable_to_recruiters','')))='true' AND COALESCE((SELECT pc.granted AND pc.withdrawn_at IS NULL FROM privacy_consents pc WHERE pc.user_id=cp.user_id AND pc.purpose='recruiter_search_discovery' ORDER BY pc.recorded_at DESC,pc.id DESC LIMIT 1),false)))
 ON CONFLICT(candidate_id,recruiter_id,event_kind,event_day) DO NOTHING;
 RETURN NEW;
END;
$$;
REVOKE ALL ON FUNCTION record_candidate_talent_pool_action() FROM PUBLIC;
CREATE TRIGGER trg_candidate_talent_pool_action AFTER INSERT ON talent_pool_memberships FOR EACH ROW EXECUTE FUNCTION record_candidate_talent_pool_action();

-- Canonical geography is separate from occupational taxonomy. Unresolved search
-- labels remain backwards-compatible text rather than unreviewed canonical rows.
CREATE TABLE workforce.geography_entities (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  canonical_name varchar(180) NOT NULL,
  state varchar(180) NOT NULL DEFAULT '',
  country_code varchar(2) NOT NULL CHECK(country_code ~ '^[A-Z]{2}$'),
  aliases text[] NOT NULL DEFAULT '{}',
  status text NOT NULL DEFAULT 'active' CHECK(status IN ('active','deprecated')),
  UNIQUE(canonical_name,state,country_code)
);
INSERT INTO workforce.geography_entities(canonical_name,state,country_code,aliases) VALUES
('Bengaluru','Karnataka','IN',ARRAY['Bangalore','Bengaluru City','Bangalore City']),
('Mumbai','Maharashtra','IN',ARRAY['Bombay']),
('Pune','Maharashtra','IN',ARRAY[]::text[]),
('New Delhi','Delhi','IN',ARRAY['Delhi']),
('Hyderabad','Telangana','IN',ARRAY[]::text[]),
('Chennai','Tamil Nadu','IN',ARRAY['Madras']),
('Kolkata','West Bengal','IN',ARRAY['Calcutta']),
('Ahmedabad','Gujarat','IN',ARRAY[]::text[]),
('Gurugram','Haryana','IN',ARRAY['Gurgaon']),
('Noida','Uttar Pradesh','IN',ARRAY[]::text[]),
('Kochi','Kerala','IN',ARRAY['Cochin']),
('London','England','GB',ARRAY[]::text[]),
('Berlin','Berlin','DE',ARRAY[]::text[]),
('Singapore','','SG',ARRAY[]::text[]),
('Dubai','Dubai','AE',ARRAY[]::text[]),
('New York','New York','US',ARRAY['New York City','NYC']);
CREATE INDEX ix_geography_canonical ON workforce.geography_entities(lower(canonical_name)) WHERE status='active';

DO $workspace$
BEGIN
  IF EXISTS(SELECT 1 FROM pg_roles WHERE rolname='sapienworx_app') THEN
    GRANT SELECT,INSERT,DELETE ON candidate_profile_events TO sapienworx_app;
    GRANT SELECT ON workforce.geography_entities TO sapienworx_app;
  END IF;
END;
$workspace$;
COMMIT;
