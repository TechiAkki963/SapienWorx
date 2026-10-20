package gateway

import (
	"context"
	"encoding/json"

	"github.com/TechiAkki963/SapienWorx/backend/internal/company"
	"github.com/jackc/pgx/v5/pgxpool"
)

// SQLGate preserves the P2.8 ai_gateway switch and verifies the claimed account
// and company membership. Domain resource/permission checks remain mandatory.
type SQLGate struct {
	DB             *pgxpool.Pool
	Models         map[Feature]string
	ControlledBeta bool // Beta requires an explicitly reviewed model rollout policy.
}

func (g SQLGate) Allow(ctx context.Context, scope Scope, feature Feature) error {
	if g.DB == nil {
		return failure(ProviderUnavailable)
	}
	var enabled bool
	if err := g.DB.QueryRow(ctx, `SELECT enabled FROM intelligence.engine_switches WHERE switch_key='ai_gateway'`).Scan(&enabled); err != nil {
		return failure(ProviderUnavailable)
	}
	if !enabled {
		return failure(Disabled)
	}
	if feature == JDParser || feature == JDGenerator || feature == CVParser {
		capability := "job_intelligence"
		if feature == CVParser {
			capability = "cv_intelligence"
		}
		var allowed bool
		taskSwitch := map[Feature]string{CVParser: "cv_ai_parse", JDParser: "job_ai_parse", JDGenerator: "jd_ai_generation"}[feature]
		if err := g.DB.QueryRow(ctx, `SELECT count(*)=4 AND bool_and(enabled) FROM intelligence.engine_switches WHERE switch_key IN ('global_intelligence',$1,'openai_provider',$2)`, capability, taskSwitch).Scan(&allowed); err != nil || !allowed {
			return failure(Disabled)
		}
		model := g.Models[feature]
		task := "job.parse"
		if feature == CVParser {
			task = "cv.parse"
		}
		if feature == JDGenerator {
			task = "job.generate_description"
		}
		if model == "" {
			return failure(Disabled)
		}
		// A single approved gateway version may pin distinct per-task models in
		// its reviewed config, preserving the registry's one-production-version rule.
		rows, err := g.DB.Query(ctx, `SELECT config FROM intelligence.model_versions WHERE provider='openai' AND (model_ref=$1 OR config->'model_routes'->>$2=$1) AND status='production' AND engine_type IN ('ai_gateway','resume_parser') AND config->'approved_tasks' ? $2`, model, task)
		if err != nil {
			return failure(Disabled)
		}
		allowed = false
		for rows.Next() {
			var raw []byte
			if rows.Scan(&raw) != nil {
				rows.Close()
				return failure(Disabled)
			}
			if !g.ControlledBeta || BetaRolloutAllowed(json.RawMessage(raw), scope) {
				allowed = true
			}
		}
		readErr := rows.Err()
		rows.Close()
		if readErr != nil || !allowed {
			return failure(Disabled)
		}
	}
	if !validScope(scope) || scope.Role == "internal" {
		return failure(Disabled)
	}
	var active bool
	if err := g.DB.QueryRow(ctx, `SELECT is_active AND status='active' AND role=$2 FROM users WHERE id=$1`, scope.UserID, scope.Role).Scan(&active); err != nil || !active {
		return failure(Disabled)
	}
	if scope.Role == "recruiter" {
		member, err := company.NewSQLStore(g.DB).Member(ctx, scope.UserID)
		if err != nil || member.Status != "active" || member.CompanyID != scope.TenantID {
			return failure(Disabled)
		}
	}
	return nil
}
