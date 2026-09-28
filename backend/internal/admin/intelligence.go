package admin

import (
	"context"
	"encoding/json"
	"strings"
	"time"

	"github.com/TechiAkki963/SapienWorx/backend/internal/intelligence"
	"github.com/jackc/pgx/v5"
)

type IntelligenceRunRecord struct {
	ID            string         `json:"id"`
	EngineVersion string         `json:"engine_version"`
	Status        string         `json:"status"`
	Metrics       map[string]any `json:"metrics"`
	RequestedBy   string         `json:"requested_by"`
	StartedAt     time.Time      `json:"started_at"`
	CompletedAt   time.Time      `json:"completed_at"`
}
type IntelligenceInsightRecord struct {
	ID             string         `json:"id"`
	RunID          string         `json:"run_id"`
	Domain         string         `json:"domain"`
	InsightKey     string         `json:"insight_key"`
	Severity       string         `json:"severity"`
	Title          string         `json:"title"`
	Rationale      string         `json:"rationale"`
	Evidence       map[string]any `json:"evidence"`
	Recommendation string         `json:"recommendation"`
	Confidence     float64        `json:"confidence"`
	Status         string         `json:"status"`
	ReviewedBy     *string        `json:"reviewed_by,omitempty"`
	ReviewedAt     *time.Time     `json:"reviewed_at,omitempty"`
	CreatedAt      time.Time      `json:"created_at"`
}
type IntelligenceDashboard struct {
	Runs         []IntelligenceRunRecord     `json:"runs"`
	Insights     []IntelligenceInsightRecord `json:"insights"`
	ComputedAt   time.Time                   `json:"computed_at"`
	AdvisoryOnly bool                        `json:"advisory_only"`
}

func (s *Service) intelligenceSnapshot(ctx context.Context) (intelligence.Snapshot, error) {
	var snap intelligence.Snapshot
	err := s.db.QueryRow(ctx, `SELECT
	(SELECT count(*) FROM jobs WHERE status='active'),
	(SELECT count(*) FROM applications WHERE applied_at>=now()-interval '30 days'),
	(SELECT count(*) FROM interviews WHERE scheduled_at>=now()-interval '30 days'),
	(SELECT count(*) FROM applications WHERE stage='hired' AND updated_at>=now()-interval '90 days'),
	(SELECT count(*) FROM admin_telemetry_events WHERE category='cv_parser' AND occurred_at>=now()-interval '24 hours'),
	(SELECT count(*) FROM admin_telemetry_events WHERE category='cv_parser' AND occurred_at>=now()-interval '24 hours' AND status IN ('failed','degraded')),
	(SELECT count(*) FROM admin_alerts WHERE severity='critical' AND status IN ('open','acknowledged')),
	(SELECT count(*) FROM privacy_requests WHERE status IN ('received','in_progress','awaiting_review')),
	(SELECT count(*) FROM admin_approval_requests WHERE status='pending' AND (expires_at IS NULL OR expires_at>now()))`).Scan(
		&snap.ActiveJobs, &snap.Applications30d, &snap.Interviews30d, &snap.Hires90d, &snap.ParserEvents24h, &snap.ParserFailures24h, &snap.CriticalAlerts, &snap.PendingPrivacyRequests, &snap.PendingApprovals)
	return snap, err
}
func (s *Service) RunIntelligence(ctx context.Context, actor, ip, requestID string) (IntelligenceRunRecord, error) {
	if !validResourceID(actor) {
		return IntelligenceRunRecord{}, ErrInvalid
	}
	snap, err := s.intelligenceSnapshot(ctx)
	if err != nil {
		return IntelligenceRunRecord{}, err
	}
	raw, err := json.Marshal(snap)
	if err != nil {
		return IntelligenceRunRecord{}, err
	}
	var metrics map[string]any
	if err = json.Unmarshal(raw, &metrics); err != nil {
		return IntelligenceRunRecord{}, err
	}
	insights := intelligence.Analyze(snap)
	tx, err := s.db.BeginTx(ctx, pgx.TxOptions{})
	if err != nil {
		return IntelligenceRunRecord{}, err
	}
	defer tx.Rollback(ctx)
	var run IntelligenceRunRecord
	var stored []byte
	err = tx.QueryRow(ctx, `INSERT INTO intelligence_runs(engine_version,metrics,requested_by) VALUES($1,$2,$3) RETURNING id,engine_version,status,metrics,requested_by,started_at,completed_at`, intelligence.EngineVersion, raw, actor).Scan(&run.ID, &run.EngineVersion, &run.Status, &stored, &run.RequestedBy, &run.StartedAt, &run.CompletedAt)
	if err != nil {
		return IntelligenceRunRecord{}, err
	}
	run.Metrics = metrics
	for _, v := range insights {
		e, _ := json.Marshal(v.Evidence)
		if _, err = tx.Exec(ctx, `INSERT INTO intelligence_insights(run_id,domain,insight_key,severity,title,rationale,evidence,recommendation,confidence) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9)`, run.ID, v.Domain, v.Key, v.Severity, v.Title, v.Rationale, e, v.Recommendation, v.Confidence); err != nil {
			return IntelligenceRunRecord{}, err
		}
	}
	target := run.ID
	if err = insertAuditTx(ctx, tx, AuditInput{AdminID: &actor, ActionType: "intelligence.run", TargetEntityType: "intelligence_run", TargetEntityID: &target, IPAddress: ip, RequestID: requestID, Metadata: map[string]any{"engine_version": intelligence.EngineVersion, "insight_count": len(insights), "advisory_only": true}}); err != nil {
		return IntelligenceRunRecord{}, err
	}
	if err = tx.Commit(ctx); err != nil {
		return IntelligenceRunRecord{}, err
	}
	return run, nil
}
func (s *Service) Intelligence(ctx context.Context) (IntelligenceDashboard, error) {
	out := IntelligenceDashboard{ComputedAt: s.now().UTC(), AdvisoryOnly: true, Runs: make([]IntelligenceRunRecord, 0), Insights: make([]IntelligenceInsightRecord, 0)}
	rows, err := s.db.Query(ctx, `SELECT id,engine_version,status,metrics,requested_by,started_at,completed_at FROM intelligence_runs ORDER BY completed_at DESC LIMIT 20`)
	if err != nil {
		return out, err
	}
	for rows.Next() {
		var v IntelligenceRunRecord
		var raw []byte
		if err = rows.Scan(&v.ID, &v.EngineVersion, &v.Status, &raw, &v.RequestedBy, &v.StartedAt, &v.CompletedAt); err != nil {
			rows.Close()
			return out, err
		}
		_ = json.Unmarshal(raw, &v.Metrics)
		out.Runs = append(out.Runs, v)
	}
	if err = rows.Err(); err != nil {
		rows.Close()
		return out, err
	}
	rows.Close()
	rows, err = s.db.Query(ctx, `SELECT id,run_id,domain,insight_key,severity,title,rationale,evidence,recommendation,confidence::float8,status,reviewed_by,reviewed_at,created_at FROM intelligence_insights ORDER BY created_at DESC LIMIT 100`)
	if err != nil {
		return out, err
	}
	defer rows.Close()
	for rows.Next() {
		var v IntelligenceInsightRecord
		var raw []byte
		if err = rows.Scan(&v.ID, &v.RunID, &v.Domain, &v.InsightKey, &v.Severity, &v.Title, &v.Rationale, &raw, &v.Recommendation, &v.Confidence, &v.Status, &v.ReviewedBy, &v.ReviewedAt, &v.CreatedAt); err != nil {
			return out, err
		}
		_ = json.Unmarshal(raw, &v.Evidence)
		out.Insights = append(out.Insights, v)
	}
	return out, rows.Err()
}
func (s *Service) ReviewIntelligenceInsight(ctx context.Context, id, actor, status, outcome, note, ip, requestID string) error {
	id = strings.TrimSpace(id)
	status = strings.ToLower(strings.TrimSpace(status))
	outcome = strings.ToLower(strings.TrimSpace(outcome))
	note = strings.TrimSpace(note)
	if !validResourceID(id) || !validResourceID(actor) || !map[string]bool{"reviewed": true, "dismissed": true, "actioned": true}[status] || !map[string]bool{"accepted": true, "rejected": true, "needs_more_data": true}[outcome] || len(note) > 2000 {
		return ErrInvalid
	}
	tx, err := s.db.BeginTx(ctx, pgx.TxOptions{})
	if err != nil {
		return err
	}
	defer tx.Rollback(ctx)
	tag, err := tx.Exec(ctx, `UPDATE intelligence_insights SET status=$2,reviewed_by=$3,reviewed_at=now() WHERE id=$1`, id, status, actor)
	if err != nil {
		return err
	}
	if tag.RowsAffected() == 0 {
		return ErrNotFound
	}
	if _, err = tx.Exec(ctx, `INSERT INTO intelligence_feedback(insight_id,admin_id,outcome,note) VALUES($1,$2,$3,$4)`, id, actor, outcome, note); err != nil {
		return err
	}
	target := id
	if err = insertAuditTx(ctx, tx, AuditInput{AdminID: &actor, ActionType: "intelligence.insight_reviewed", TargetEntityType: "intelligence_insight", TargetEntityID: &target, IPAddress: ip, RequestID: requestID, Metadata: map[string]any{"status": status, "outcome": outcome, "advisory_only": true}}); err != nil {
		return err
	}
	return tx.Commit(ctx)
}
