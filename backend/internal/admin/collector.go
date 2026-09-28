package admin

import (
	"context"
	"encoding/json"
	"errors"
	"strings"
	"time"

	"github.com/jackc/pgx/v5"
)

type CollectorEnvelope struct {
	Source     string          `json:"source"`
	EventID    string          `json:"event_id"`
	EventType  string          `json:"event_type"`
	ObservedAt time.Time       `json:"observed_at"`
	Payload    json.RawMessage `json:"payload"`
}

type CollectorResult struct {
	Accepted  bool   `json:"accepted"`
	Duplicate bool   `json:"duplicate"`
	EventID   string `json:"event_id"`
	EventType string `json:"event_type"`
}

type collectorTelemetryPayload struct {
	Category     string         `json:"category"`
	Operation    string         `json:"operation"`
	Status       string         `json:"status"`
	LatencyMS    *int           `json:"latency_ms"`
	RetryCount   int            `json:"retry_count"`
	BacklogCount *int           `json:"backlog_count"`
	ReferenceID  string         `json:"reference_id"`
	Metadata     map[string]any `json:"metadata"`
}

type collectorOperationPayload struct {
	EvidenceType string         `json:"evidence_type"`
	Environment  string         `json:"environment"`
	Component    string         `json:"component"`
	Status       string         `json:"status"`
	Owner        string         `json:"owner"`
	Reference    string         `json:"reference"`
	Details      map[string]any `json:"details"`
}

type collectorCostPayload struct {
	Currency        string   `json:"currency"`
	PeriodStart     string   `json:"period_start"`
	PeriodEnd       string   `json:"period_end"`
	ActualCost      float64  `json:"actual_cost"`
	ForecastCost    *float64 `json:"forecast_cost"`
	BudgetAmount    *float64 `json:"budget_amount"`
	SourceReference string   `json:"source_reference"`
}

func (s *Service) IngestCollector(ctx context.Context, envelope CollectorEnvelope) (CollectorResult, error) {
	envelope.Source = strings.ToLower(strings.TrimSpace(envelope.Source))
	envelope.EventID = strings.TrimSpace(envelope.EventID)
	envelope.EventType = strings.ToLower(strings.TrimSpace(envelope.EventType))
	if len(envelope.Source) < 2 || len(envelope.Source) > 80 || len(envelope.EventID) < 6 || len(envelope.EventID) > 160 || envelope.ObservedAt.IsZero() {
		return CollectorResult{}, ErrInvalid
	}
	if envelope.EventType != "telemetry" && envelope.EventType != "operation_evidence" && envelope.EventType != "cost_snapshot" {
		return CollectorResult{}, ErrInvalid
	}
	if len(envelope.Payload) == 0 || len(envelope.Payload) > 64<<10 {
		return CollectorResult{}, ErrInvalid
	}

	tx, err := s.db.BeginTx(ctx, pgx.TxOptions{})
	if err != nil {
		return CollectorResult{}, err
	}
	defer tx.Rollback(ctx)

	tag, err := tx.Exec(ctx, `INSERT INTO admin_collector_deliveries(source,event_id,event_type,observed_at) VALUES($1,$2,$3,$4) ON CONFLICT(source,event_id) DO NOTHING`, envelope.Source, envelope.EventID, envelope.EventType, envelope.ObservedAt.UTC())
	if err != nil {
		return CollectorResult{}, err
	}
	if tag.RowsAffected() == 0 {
		return CollectorResult{Accepted: true, Duplicate: true, EventID: envelope.EventID, EventType: envelope.EventType}, nil
	}

	switch envelope.EventType {
	case "telemetry":
		var payload collectorTelemetryPayload
		if err := json.Unmarshal(envelope.Payload, &payload); err != nil {
			return CollectorResult{}, ErrInvalid
		}
		payload.Category = strings.ToLower(strings.TrimSpace(payload.Category))
		payload.Operation = strings.TrimSpace(payload.Operation)
		payload.Status = strings.ToLower(strings.TrimSpace(payload.Status))
		payload.ReferenceID = strings.TrimSpace(payload.ReferenceID)
		if !map[string]bool{"inmail": true, "ses": true, "notification": true, "websocket": true, "cv_parser": true}[payload.Category] ||
			len(payload.Operation) < 2 || len(payload.Operation) > 100 ||
			!map[string]bool{"ok": true, "retrying": true, "failed": true, "backlogged": true, "degraded": true, "unconnected": true}[payload.Status] ||
			payload.RetryCount < 0 || len(payload.ReferenceID) > 200 {
			return CollectorResult{}, ErrInvalid
		}
		if payload.LatencyMS != nil && *payload.LatencyMS < 0 {
			return CollectorResult{}, ErrInvalid
		}
		if payload.BacklogCount != nil && *payload.BacklogCount < 0 {
			return CollectorResult{}, ErrInvalid
		}
		raw, err := json.Marshal(sanitizeTelemetryMetadata(payload.Metadata))
		if err != nil {
			return CollectorResult{}, err
		}
		if _, err = tx.Exec(ctx, `INSERT INTO admin_telemetry_events(category,source,operation,status,latency_ms,retry_count,backlog_count,reference_id,metadata,occurred_at) VALUES($1,$2,$3,$4,$5,$6,$7,NULLIF($8,''),$9,$10)`,
			payload.Category, envelope.Source, payload.Operation, payload.Status, payload.LatencyMS, payload.RetryCount, payload.BacklogCount, payload.ReferenceID, raw, envelope.ObservedAt.UTC()); err != nil {
			return CollectorResult{}, err
		}

	case "operation_evidence":
		var payload collectorOperationPayload
		if err := json.Unmarshal(envelope.Payload, &payload); err != nil {
			return CollectorResult{}, ErrInvalid
		}
		payload.EvidenceType = strings.ToLower(strings.TrimSpace(payload.EvidenceType))
		payload.Environment = strings.TrimSpace(payload.Environment)
		payload.Component = strings.TrimSpace(payload.Component)
		payload.Status = strings.ToLower(strings.TrimSpace(payload.Status))
		payload.Owner = strings.TrimSpace(payload.Owner)
		payload.Reference = strings.TrimSpace(payload.Reference)
		if !map[string]bool{"service_health": true, "database_health": true, "alert": true, "release": true, "migration": true, "backup": true, "restore_test": true}[payload.EvidenceType] ||
			len(payload.Environment) < 2 || len(payload.Environment) > 40 ||
			len(payload.Component) < 2 || len(payload.Component) > 120 ||
			!map[string]bool{"healthy": true, "warning": true, "critical": true, "failed": true, "passed": true, "pending": true, "unconnected": true, "unknown": true}[payload.Status] ||
			len(payload.Owner) > 200 || len(payload.Reference) > 500 {
			return CollectorResult{}, ErrInvalid
		}
		raw, err := json.Marshal(sanitizeTelemetryMetadata(payload.Details))
		if err != nil {
			return CollectorResult{}, err
		}
		if _, err = tx.Exec(ctx, `INSERT INTO admin_operation_evidence(evidence_type,environment,component,status,owner,reference,details,observed_at) VALUES($1,$2,$3,$4,$5,$6,$7,$8)`,
			payload.EvidenceType, payload.Environment, payload.Component, payload.Status, payload.Owner, payload.Reference, raw, envelope.ObservedAt.UTC()); err != nil {
			return CollectorResult{}, err
		}

	case "cost_snapshot":
		var payload collectorCostPayload
		if err := json.Unmarshal(envelope.Payload, &payload); err != nil {
			return CollectorResult{}, ErrInvalid
		}
		payload.Currency = strings.ToUpper(strings.TrimSpace(payload.Currency))
		payload.SourceReference = strings.TrimSpace(payload.SourceReference)
		start, err := time.Parse("2006-01-02", strings.TrimSpace(payload.PeriodStart))
		if err != nil {
			return CollectorResult{}, ErrInvalid
		}
		end, err := time.Parse("2006-01-02", strings.TrimSpace(payload.PeriodEnd))
		if err != nil {
			return CollectorResult{}, ErrInvalid
		}
		if len(payload.Currency) != 3 || end.Before(start) || payload.ActualCost < 0 ||
			(payload.ForecastCost != nil && *payload.ForecastCost < 0) ||
			(payload.BudgetAmount != nil && *payload.BudgetAmount < 0) ||
			len(payload.SourceReference) > 500 {
			return CollectorResult{}, ErrInvalid
		}
		if _, err = tx.Exec(ctx, `INSERT INTO admin_cost_snapshots(currency,period_start,period_end,actual_cost,forecast_cost,budget_amount,source_reference,observed_at) VALUES($1,$2,$3,$4,$5,$6,$7,$8)`,
			payload.Currency, start, end, payload.ActualCost, payload.ForecastCost, payload.BudgetAmount, payload.SourceReference, envelope.ObservedAt.UTC()); err != nil {
			return CollectorResult{}, err
		}
	}

	if err = tx.Commit(ctx); err != nil {
		return CollectorResult{}, err
	}
	return CollectorResult{Accepted: true, EventID: envelope.EventID, EventType: envelope.EventType}, nil
}

func (s *Service) CollectorDeliveryCount(ctx context.Context, source, eventID string) (int, error) {
	var count int
	err := s.db.QueryRow(ctx, `SELECT count(*) FROM admin_collector_deliveries WHERE source=$1 AND event_id=$2`, source, eventID).Scan(&count)
	if errors.Is(err, pgx.ErrNoRows) {
		return 0, nil
	}
	return count, err
}
