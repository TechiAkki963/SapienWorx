package admin

import (
	"context"
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"errors"

	"github.com/TechiAkki963/SapienWorx/backend/internal/intelligence/modelbaseline"
	"github.com/jackc/pgx/v5"
)

func (s *Service) requestAIBaselineEvaluation(ctx context.Context, modelID, actor, requestID string) error {
	tx, err := s.db.Begin(ctx)
	if err != nil {
		return err
	}
	defer tx.Rollback(ctx)
	var engine, provider, model, status string
	var raw []byte
	if err = tx.QueryRow(ctx, `SELECT engine_type,provider,model_ref,status,config FROM intelligence.model_versions WHERE id=$1 FOR UPDATE`, modelID).Scan(&engine, &provider, &model, &status, &raw); errors.Is(err, pgx.ErrNoRows) {
		return ErrNotFound
	} else if err != nil {
		return err
	}
	if status != "candidate" && status != "evaluating" && status != "approved" {
		return ErrConflict
	}
	var config map[string]any
	if json.Unmarshal(raw, &config) != nil {
		return ErrInvalid
	}
	evaluation, err := modelbaseline.Evaluate(engine, provider, model, config)
	if err != nil {
		return ErrInvalid
	}
	// The exact policy digest joins the preserved evidence to this candidate's
	// task/model/cohort configuration, without copying actor lists to telemetry.
	digest := sha256.Sum256(raw)
	evaluation.Metrics["policy_sha256"] = hex.EncodeToString(digest[:])
	metrics, _ := json.Marshal(evaluation.Metrics)
	if _, err = tx.Exec(ctx, `INSERT INTO intelligence.evaluations(model_version_id,dataset_ref,metrics,quality_gate_status,requested_by,completed_at,notes) VALUES($1,$2,$3,'passed',$4,now(),'Pinned historical synthetic baseline only; independent promotion approval and internal canary remain required.')`, modelID, evaluation.DatasetRef, metrics, actor); err != nil {
		return err
	}
	if _, err = tx.Exec(ctx, `UPDATE intelligence.model_versions SET status='approved' WHERE id=$1`, modelID); err != nil {
		return err
	}
	metadata, _ := json.Marshal(map[string]any{"dataset_ref": evaluation.DatasetRef, "policy_sha256": hex.EncodeToString(digest[:]), "request_id": requestID, "new_provider_calls": 0, "promotion_performed": false})
	if _, err = tx.Exec(ctx, `INSERT INTO intelligence.audit_events(actor_id,event_type,target_type,target_id,metadata) VALUES($1,'intelligence.model.baseline_evaluated','intelligence_model',$2,$3)`, actor, modelID, metadata); err != nil {
		return err
	}
	return tx.Commit(ctx)
}

func hasMatchingAIBaseline(ctx context.Context, tx pgx.Tx, id, engine, provider, model string, raw []byte) (bool, error) {
	var config map[string]any
	if json.Unmarshal(raw, &config) != nil {
		return false, nil
	}
	evaluation, err := modelbaseline.Evaluate(engine, provider, model, config)
	if err != nil {
		return false, nil
	}
	digest := sha256.Sum256(raw)
	var passed bool
	err = tx.QueryRow(ctx, `SELECT EXISTS(SELECT 1 FROM intelligence.evaluations WHERE model_version_id=$1 AND quality_gate_status='passed' AND dataset_ref=$2 AND metrics->>'policy_sha256'=$3 AND metrics->>'evidence_sha256'=$4)`, id, evaluation.DatasetRef, hex.EncodeToString(digest[:]), evaluation.Metrics["evidence_sha256"]).Scan(&passed)
	return passed, err
}
