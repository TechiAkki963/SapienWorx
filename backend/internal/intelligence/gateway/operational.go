package gateway

import (
	"context"
	"github.com/jackc/pgx/v5/pgxpool"
	"time"
)

type TaskOperational struct {
	Task               string   `json:"task"`
	Label              string   `json:"label"`
	Enabled            bool     `json:"enabled"`
	Requests           int64    `json:"requests"`
	Attempts           int64    `json:"attempts"`
	Retries            int64    `json:"retries"`
	Success            int64    `json:"success"`
	Failures           int64    `json:"failures"`
	Timeouts           int64    `json:"timeouts"`
	Input              int64    `json:"input_tokens"`
	Output             int64    `json:"output_tokens"`
	CostUSD            float64  `json:"estimated_cost_usd"`
	UnknownCosts       int64    `json:"unknown_cost_requests"`
	P50                *float64 `json:"p50_ms"`
	P95                *float64 `json:"p95_ms"`
	Proposals          int64    `json:"proposals"`
	Reviewed           int64    `json:"reviewed"`
	Corrected          int64    `json:"corrected"`
	SchemaFailures     int64    `json:"schema_failures"`
	ValidationFailures int64    `json:"validation_failures"`
}
type OperationalStatus struct {
	Available   bool              `json:"available"`
	WindowHours int               `json:"window_hours"`
	Gateway     bool              `json:"gateway_switch"`
	Provider    bool              `json:"provider_switch"`
	Tasks       []TaskOperational `json:"tasks"`
}

// Durable 24h metadata only. No prompt, result, actor, tenant or secret is read
// into this response. Percentiles cover observed gateway calls and failures;
// cache reuse is tracked separately by parsing statistics.
func (s *Service) OperationalStatus(ctx context.Context, db *pgxpool.Pool) OperationalStatus {
	v := OperationalStatus{WindowHours: 24, Tasks: []TaskOperational{{Task: "cv.parse", Label: "CV Parse"}, {Task: "job.parse", Label: "JD Parse"}, {Task: "job.generate_description", Label: "JD Generation"}}}
	if db == nil {
		return v
	}
	ctx, cancel := context.WithTimeout(ctx, 2*time.Second)
	defer cancel()
	switches := map[string]bool{}
	rows, e := db.Query(ctx, `SELECT switch_key,enabled FROM intelligence.engine_switches WHERE switch_key IN ('ai_gateway','openai_provider','global_intelligence','cv_intelligence','job_intelligence','cv_ai_parse','job_ai_parse','jd_ai_generation')`)
	if e != nil {
		return v
	}
	for rows.Next() {
		var k string
		var on bool
		if rows.Scan(&k, &on) != nil {
			rows.Close()
			return v
		}
		switches[k] = on
	}
	e = rows.Err()
	rows.Close()
	if e != nil {
		return v
	}
	v.Gateway = switches["ai_gateway"]
	v.Provider = switches["openai_provider"]
	for i := range v.Tasks {
		t := &v.Tasks[i]
		feature := map[string]Feature{"cv.parse": CVParser, "job.parse": JDParser, "job.generate_description": JDGenerator}[t.Task]
		key := map[Feature]string{CVParser: "cv_ai_parse", JDParser: "job_ai_parse", JDGenerator: "jd_ai_generation"}[feature]
		legacy := "job_intelligence"
		if feature == CVParser {
			legacy = "cv_intelligence"
		}
		t.Enabled = s.cfg.Enabled && s.cfg.Features[feature] && v.Gateway && v.Provider && switches["global_intelligence"] && switches[legacy] && switches[key]
		e = db.QueryRow(ctx, `SELECT count(*),COALESCE(sum(attempts),0),COALESCE(sum(GREATEST(attempts-1,0)),0),count(*) FILTER(WHERE success),count(*) FILTER(WHERE NOT success),count(*) FILTER(WHERE error_code='AI_TIMEOUT'),COALESCE(sum(input_tokens),0),COALESCE(sum(output_tokens),0),COALESCE(sum(cost_micro_usd),0)::float8/1000000,count(*) FILTER(WHERE cost_micro_usd IS NULL AND attempts>0),percentile_cont(.5) WITHIN GROUP(ORDER BY latency_ms),percentile_cont(.95) WITHIN GROUP(ORDER BY latency_ms) FROM intelligence.ai_usage_events WHERE task=$1 AND occurred_at>=now()-interval '24 hours'`, t.Task).Scan(&t.Requests, &t.Attempts, &t.Retries, &t.Success, &t.Failures, &t.Timeouts, &t.Input, &t.Output, &t.CostUSD, &t.UnknownCosts, &t.P50, &t.P95)
		if e != nil {
			return v
		}
		e = db.QueryRow(ctx, `SELECT count(*),count(*) FILTER(WHERE status='owner_reviewed'),count(*) FILTER(WHERE learning_metadata->>'human_corrected'='true'),count(*) FILTER(WHERE learning_metadata->>'schema_valid'='false'),count(*) FILTER(WHERE learning_metadata->>'domain_valid'='false') FROM intelligence.ai_parse_operations WHERE task=$1 AND created_at>=now()-interval '24 hours' AND expires_at>now()`, t.Task).Scan(&t.Proposals, &t.Reviewed, &t.Corrected, &t.SchemaFailures, &t.ValidationFailures)
		if e != nil {
			return v
		}
	}
	v.Available = true
	return v
}
