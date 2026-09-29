BEGIN;

CREATE TABLE admin_alert_rules (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  rule_key text NOT NULL UNIQUE CHECK (rule_key ~ '^[a-z0-9][a-z0-9._-]{2,99}$'),
  name text NOT NULL CHECK (length(btrim(name)) BETWEEN 3 AND 180),
  category text NOT NULL CHECK (category IN ('inmail','ses','notification','websocket','cv_parser')),
  metric text NOT NULL CHECK (metric IN ('failure_count','avg_latency_ms','max_backlog')),
  operator text NOT NULL CHECK (operator IN ('gt','gte')),
  threshold numeric(14,3) NOT NULL CHECK (threshold >= 0),
  window_minutes integer NOT NULL CHECK (window_minutes BETWEEN 1 AND 1440),
  severity text NOT NULL CHECK (severity IN ('info','warning','critical')),
  owner text NOT NULL DEFAULT '' CHECK (length(owner) <= 200),
  enabled boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE admin_alerts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  rule_id uuid REFERENCES admin_alert_rules(id) ON DELETE SET NULL,
  fingerprint text NOT NULL CHECK (length(fingerprint) BETWEEN 3 AND 200),
  severity text NOT NULL CHECK (severity IN ('info','warning','critical')),
  status text NOT NULL DEFAULT 'open' CHECK (status IN ('open','acknowledged','resolved')),
  title text NOT NULL CHECK (length(btrim(title)) BETWEEN 3 AND 240),
  summary text NOT NULL DEFAULT '' CHECK (length(summary) <= 2000),
  observed_value numeric(14,3),
  threshold numeric(14,3),
  owner text NOT NULL DEFAULT '' CHECK (length(owner) <= 200),
  first_seen_at timestamptz NOT NULL DEFAULT now(),
  last_seen_at timestamptz NOT NULL DEFAULT now(),
  acknowledged_by uuid REFERENCES users(id),
  acknowledged_at timestamptz,
  resolved_by uuid REFERENCES users(id),
  resolved_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX ix_admin_alerts_status_severity ON admin_alerts(status,severity,last_seen_at DESC);
CREATE INDEX ix_admin_alerts_rule_status ON admin_alerts(rule_id,status);

INSERT INTO admin_alert_rules(rule_key,name,category,metric,operator,threshold,window_minutes,severity,owner) VALUES
('cv_parser.failures','CV parser failures','cv_parser','failure_count','gte',5,15,'warning','Platform'),
('cv_parser.latency','CV parser latency','cv_parser','avg_latency_ms','gte',5000,15,'warning','Platform'),
('inmail.failures','InMail send failures','inmail','failure_count','gte',5,15,'warning','Messaging'),
('ses.failures','SES delivery failures','ses','failure_count','gte',3,15,'critical','Messaging'),
('notification.backlog','Notification backlog','notification','max_backlog','gte',100,15,'warning','Platform'),
('websocket.failures','WebSocket reliability','websocket','failure_count','gte',10,15,'warning','Platform');

COMMIT;
