package admin

import (
	"context"
	"fmt"
	"strings"
	"time"
)

type AlertRuleRecord struct {
	ID            string  \`json:"id"\`
	RuleKey       string  \`json:"rule_key"\`
	Name          string  \`json:"name"\`
	Category      string  \`json:"category"\`
	Metric        string  \`json:"metric"\`
	Operator      string  \`json:"operator"\`
	Threshold     float64 \`json:"threshold"\`
	WindowMinutes int     \`json:"window_minutes"\`
	Severity      string  \`json:"severity"\`
	Owner         string  \`json:"owner"\`
	Enabled       bool    \`json:"enabled"\`
}

type AlertRecord struct {
	ID             string     \`json:"id"\`
	RuleID         *string    \`json:"rule_id,omitempty"\`
	Fingerprint    string     \`json:"fingerprint"\`
	Severity       string     \`json:"severity"\`
	Status         string     \`json:"status"\`
	Title          string     \`json:"title"\`
	Summary        string     \`json:"summary"\`
	ObservedValue  *float64   \`json:"observed_value,omitempty"\`
	Threshold      *float64   \`json:"threshold,omitempty"\`
	Owner          string     \`json:"owner"\`
	FirstSeenAt    time.Time  \`json:"first_seen_at"\`
	LastSeenAt     time.Time  \`json:"last_seen_at"\`
	AcknowledgedBy *string    \`json:"acknowledged_by,omitempty"\`
	AcknowledgedAt *time.Time \`json:"acknowledged_at,omitempty"\`
	ResolvedBy     *string    \`json:"resolved_by,omitempty"\`
	ResolvedAt     *time.Time \`json:"resolved_at,omitempty"\`
}

func (s *Service) Alerts(ctx context.Context) ([]AlertRecord, error) {
	rows, err := s.db.Query(ctx, \`SELECT id,rule_id,fingerprint,severity,status,title,summary,observed_value::float8,threshold::float8,owner,first_seen_at,last_seen_at,acknowledged_by,acknowledged_at,resolved_by,resolved_at FROM admin_alerts ORDER BY CASE severity WHEN 'critical' THEN 0 WHEN 'warning' THEN 1 ELSE 2 END,status,last_seen_at DESC LIMIT 100\`)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	items := make([]AlertRecord, 0)
	for rows.Next() {
		var item AlertRecord
		if err := rows.Scan(&item.ID, &item.RuleID, &item.Fingerprint, &item.Severity, &item.Status, &item.Title, &item.Summary, &item.ObservedValue, &item.Threshold, &item.Owner, &item.FirstSeenAt, &item.LastSeenAt, &item.AcknowledgedBy, &item.AcknowledgedAt, &item.ResolvedBy, &item.ResolvedAt); err != nil {
			return nil, err
		}
		items = append(items, item)
	}
	return items, rows.Err()
}

func (s *Service) AlertRules(ctx context.Context) ([]AlertRuleRecord, error) {
	rows, err := s.db.Query(ctx, \`SELECT id,rule_key,name,category,metric,operator,threshold::float8,window_minutes,severity,owner,enabled FROM admin_alert_rules ORDER BY rule_key\`)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	items := make([]AlertRuleRecord, 0)
	for rows.Next() {
		var item AlertRuleRecord
		if err := rows.Scan(&item.ID, &item.RuleKey, &item.Name, &item.Category, &item.Metric, &item.Operator, &item.Threshold, &item.WindowMinutes, &item.Severity, &item.Owner, &item.Enabled); err != nil {
			return nil, err
		}
		items = append(items, item)
	}
	return items, rows.Err()
}

func (s *Service) EvaluateAlerts(ctx context.Context, actor, ip, requestID string) (int, error) {
	rules, err := s.AlertRules(ctx)
	if err != nil {
		return 0, err
	}
	triggered := 0
	for _, rule := range rules {
		if !rule.Enabled {
			continue
		}
		var value float64
		switch rule.Metric {
		case "failure_count":
			err = s.db.QueryRow(ctx, \`SELECT count(*)::float8 FROM admin_telemetry_events WHERE category=$1 AND occurred_at>=now()-make_interval(mins=>$2) AND status IN ('failed','degraded','backlogged','retrying')\`, rule.Category, rule.WindowMinutes).Scan(&value)
		case "avg_latency_ms":
			err = s.db.QueryRow(ctx, \`SELECT COALESCE(avg(latency_ms),0)::float8 FROM admin_telemetry_events WHERE category=$1 AND occurred_at>=now()-make_interval(mins=>$2) AND latency_ms IS NOT NULL\`, rule.Category, rule.WindowMinutes).Scan(&value)
		case "max_backlog":
			err = s.db.QueryRow(ctx, \`SELECT COALESCE(max(backlog_count),0)::float8 FROM admin_telemetry_events WHERE category=$1 AND occurred_at>=now()-make_interval(mins=>$2) AND backlog_count IS NOT NULL\`, rule.Category, rule.WindowMinutes).Scan(&value)
		default:
			continue
		}
		if err != nil {
			return triggered, err
		}
		fire := value > rule.Threshold || (rule.Operator == "gte" && value >= rule.Threshold)
		if !fire {
			continue
		}
		triggered++
		fingerprint := rule.RuleKey
		summary := fmt.Sprintf("%s observed %.2f against threshold %.2f in %d minutes", rule.Metric, value, rule.Threshold, rule.WindowMinutes)
		var existing string
		_ = s.db.QueryRow(ctx, \`SELECT id FROM admin_alerts WHERE rule_id=$1 AND status IN ('open','acknowledged') ORDER BY last_seen_at DESC LIMIT 1\`, rule.ID).Scan(&existing)
		if existing != "" {
			if _, err = s.db.Exec(ctx, \`UPDATE admin_alerts SET observed_value=$2,threshold=$3,last_seen_at=now(),summary=$4,owner=$5,severity=$6 WHERE id=$1\`, existing, value, rule.Threshold, summary, rule.Owner, rule.Severity); err != nil {
				return triggered, err
			}
			continue
		}
		if _, err = s.db.Exec(ctx, \`INSERT INTO admin_alerts(rule_id,fingerprint,severity,title,summary,observed_value,threshold,owner) VALUES($1,$2,$3,$4,$5,$6,$7,$8)\`, rule.ID, fingerprint, rule.Severity, rule.Name, summary, value, rule.Threshold, rule.Owner); err != nil {
			return triggered, err
		}
	}
	_ = s.Audit(ctx, AuditInput{AdminID: &actor, ActionType: "alerts.evaluated", TargetEntityType: "alert_rule", IPAddress: ip, RequestID: requestID, Metadata: map[string]any{"triggered": triggered}})
	return triggered, nil
}

func (s *Service) UpdateAlert(ctx context.Context, id, actor, status, owner, ip, requestID string) error {
	id = strings.TrimSpace(id)
	status = strings.ToLower(strings.TrimSpace(status))
	owner = strings.TrimSpace(owner)
	if !validResourceID(id) || !validResourceID(actor) || (status != "acknowledged" && status != "resolved") || len(owner) > 200 {
		return ErrInvalid
	}
	tag := "acknowledged"
	if status == "resolved" {
		tag = "resolved"
	}
	command := \`UPDATE admin_alerts SET status=$2,owner=CASE WHEN $3='' THEN owner ELSE $3 END,acknowledged_by=CASE WHEN $2='acknowledged' THEN $4 ELSE acknowledged_by END,acknowledged_at=CASE WHEN $2='acknowledged' THEN now() ELSE acknowledged_at END,resolved_by=CASE WHEN $2='resolved' THEN $4 ELSE resolved_by END,resolved_at=CASE WHEN $2='resolved' THEN now() ELSE resolved_at END WHERE id=$1 AND status<>'resolved'\`
	result, err := s.db.Exec(ctx, command, id, status, owner, actor)
	if err != nil {
		return err
	}
	if result.RowsAffected() == 0 {
		return ErrConflict
	}
	target := id
	return s.Audit(ctx, AuditInput{AdminID: &actor, ActionType: "alert." + tag, TargetEntityType: "alert", TargetEntityID: &target, IPAddress: ip, RequestID: requestID, Metadata: map[string]any{"owner": owner}})
}
