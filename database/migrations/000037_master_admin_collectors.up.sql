BEGIN;

CREATE TABLE admin_collector_deliveries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  source text NOT NULL CHECK (source ~ '^[a-z0-9][a-z0-9._-]{1,79}$'),
  event_id text NOT NULL CHECK (event_id ~ '^[A-Za-z0-9][A-Za-z0-9._:-]{5,159}$'),
  event_type text NOT NULL CHECK (event_type IN ('telemetry','operation_evidence','cost_snapshot')),
  observed_at timestamptz NOT NULL,
  received_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(source,event_id)
);
CREATE INDEX ix_admin_collector_deliveries_received ON admin_collector_deliveries(received_at DESC);
CREATE INDEX ix_admin_collector_deliveries_source_received ON admin_collector_deliveries(source,received_at DESC);

COMMIT;
