package candidate

import (
	"context"
	"github.com/jackc/pgx/v5"
	"regexp"
)

var opaqueVisitor = regexp.MustCompile(`^[a-f0-9]{64}$`)

func (s *Service) PurgeJobViewEvidence(ctx context.Context) error {
	// Aggregated job counts are retained. Opaque visitor windows expire after
	// 30 days and identity-free events after 90 days; bounded deletes use indexes.
	_, err := s.db.Exec(ctx, `DELETE FROM job_view_visitors WHERE (job_id,visitor_hash) IN (SELECT job_id,visitor_hash FROM job_view_visitors WHERE last_view_at<now()-interval '30 days' ORDER BY last_view_at LIMIT 5000)`)
	if err != nil {
		return err
	}
	_, err = s.db.Exec(ctx, `DELETE FROM job_view_events WHERE id IN (SELECT id FROM job_view_events WHERE occurred_at<now()-interval '90 days' ORDER BY occurred_at LIMIT 5000)`)
	return err
}

// RecordPublicJobView is called only after a public page renders. Counts use a
// rolling 24-hour window; rapid reloads within 30 seconds produce no event.
// The row lock/upsert serializes concurrent requests from the same visitor.
func (s *Service) RecordPublicJobView(ctx context.Context, jobID, visitorHash string) error {
	if !workspaceUUID.MatchString(jobID) || !opaqueVisitor.MatchString(visitorHash) {
		return ErrWorkspaceInput
	}
	tx, err := s.db.Begin(ctx)
	if err != nil {
		return err
	}
	defer tx.Rollback(ctx)
	var public bool
	err = tx.QueryRow(ctx, `SELECT status='active' AND visibility='public' AND published_at IS NOT NULL AND (application_deadline IS NULL OR application_deadline>=current_date) FROM jobs WHERE id=$1 FOR SHARE`, jobID).Scan(&public)
	if err == pgx.ErrNoRows || err == nil && !public {
		return ErrNotFound
	}
	if err != nil {
		return err
	}
	_, err = tx.Exec(ctx, `WITH visit AS (
 INSERT INTO job_view_visitors(job_id,visitor_hash,last_view_at,last_unique_at) VALUES($1,$2,now(),now())
 ON CONFLICT(job_id,visitor_hash) DO UPDATE SET last_view_at=now(),
 last_unique_at=CASE WHEN job_view_visitors.last_unique_at<=now()-interval '24 hours' THEN now() ELSE job_view_visitors.last_unique_at END
 WHERE job_view_visitors.last_view_at<=now()-interval '30 seconds'
 RETURNING job_id,last_unique_at=now() AS is_unique
 ), event AS (
 INSERT INTO job_view_events(job_id,unique_view) SELECT job_id,is_unique FROM visit RETURNING job_id,unique_view
 ) INSERT INTO job_view_metrics(job_id,total_views,unique_views)
 SELECT job_id,1,CASE WHEN unique_view THEN 1 ELSE 0 END FROM event
 ON CONFLICT(job_id) DO UPDATE SET total_views=job_view_metrics.total_views+1,
 unique_views=job_view_metrics.unique_views+EXCLUDED.unique_views,updated_at=now()`, jobID, visitorHash)
	if err != nil {
		return err
	}
	return tx.Commit(ctx)
}
