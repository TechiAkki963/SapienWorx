package privacy

import (
	"context"
	"encoding/json"
	"errors"
	"time"

	"github.com/jackc/pgx/v5"
)

type ObjectDeleter interface {
	DeleteObject(context.Context, string) error
}

type deletionJob struct {
	ID        string
	RequestID string
	ObjectKey string
	Attempts  int
}

func (s *Service) ProcessPendingFulfilmentJobs(ctx context.Context, deleter ObjectDeleter, limit int) (int, error) {
	if deleter == nil {
		return 0, errors.New("object deleter is unavailable")
	}
	if limit < 1 || limit > 100 {
		limit = 10
	}

	processed := 0
	for processed < limit {
		job, ok, err := s.claimDeletionJob(ctx)
		if err != nil {
			return processed, err
		}
		if !ok {
			return processed, nil
		}
		processed++

		err = deleter.DeleteObject(ctx, job.ObjectKey)
		if err != nil {
			if markErr := s.markDeletionFailed(ctx, job, err); markErr != nil {
				return processed, markErr
			}
			continue
		}
		if err = s.markDeletionSucceeded(ctx, job); err != nil {
			return processed, err
		}
	}
	return processed, nil
}

func (s *Service) claimDeletionJob(ctx context.Context) (deletionJob, bool, error) {
	tx, err := s.db.BeginTx(ctx, pgx.TxOptions{})
	if err != nil {
		return deletionJob{}, false, err
	}
	defer tx.Rollback(ctx)

	var job deletionJob
	var raw []byte
	err = tx.QueryRow(ctx, `
		SELECT id,request_id,result,attempts
		FROM privacy_fulfilment_jobs
		WHERE job_type='delete_private_cv_object'
		  AND status IN ('pending','failed')
		  AND attempts < 5
		  AND run_after <= now()
		ORDER BY created_at
		FOR UPDATE SKIP LOCKED
		LIMIT 1`).Scan(&job.ID, &job.RequestID, &raw, &job.Attempts)
	if errors.Is(err, pgx.ErrNoRows) {
		return deletionJob{}, false, nil
	}
	if err != nil {
		return deletionJob{}, false, err
	}
	var payload struct {
		ObjectKey string `json:"object_key"`
	}
	if err = json.Unmarshal(raw, &payload); err != nil || payload.ObjectKey == "" {
		_, updateErr := tx.Exec(ctx, `UPDATE privacy_fulfilment_jobs SET status='failed',attempts=attempts+1,last_error='invalid object deletion payload',run_after=now()+interval '24 hours' WHERE id=$1`, job.ID)
		if updateErr != nil {
			return deletionJob{}, false, updateErr
		}
		if err = tx.Commit(ctx); err != nil {
			return deletionJob{}, false, err
		}
		return deletionJob{}, false, nil
	}
	job.ObjectKey = payload.ObjectKey
	if _, err = tx.Exec(ctx, `UPDATE privacy_fulfilment_jobs SET status='running',attempts=attempts+1,started_at=now(),completed_at=NULL,last_error=NULL WHERE id=$1`, job.ID); err != nil {
		return deletionJob{}, false, err
	}
	if err = tx.Commit(ctx); err != nil {
		return deletionJob{}, false, err
	}
	job.Attempts++
	return job, true, nil
}

func (s *Service) markDeletionFailed(ctx context.Context, job deletionJob, cause error) error {
	retryDelay := 5 * time.Minute
	if job.Attempts >= 5 {
		retryDelay = 24 * time.Hour
	}
	_, err := s.db.Exec(ctx, `
		UPDATE privacy_fulfilment_jobs
		SET status='failed',last_error=$2,run_after=$3,completed_at=now()
		WHERE id=$1`, job.ID, limitError(cause.Error()), time.Now().UTC().Add(retryDelay))
	if err != nil {
		return err
	}
	_, _ = s.db.Exec(ctx, `UPDATE privacy_requests SET status='in_progress',error_message='private object deletion incomplete',completed_at=NULL WHERE id=$1`, job.RequestID)
	_, _ = s.db.Exec(ctx, `INSERT INTO privacy_audit_events(event_type,resource_type,resource_id,outcome,metadata) VALUES('privacy.erasure.private_object_failed','privacy_request',$1,'failed',jsonb_build_object('job_id',$2,'attempts',$3))`, job.RequestID, job.ID, job.Attempts)
	return nil
}

func (s *Service) markDeletionSucceeded(ctx context.Context, job deletionJob) error {
	tx, err := s.db.BeginTx(ctx, pgx.TxOptions{})
	if err != nil {
		return err
	}
	defer tx.Rollback(ctx)
	if _, err = tx.Exec(ctx, `UPDATE privacy_fulfilment_jobs SET status='succeeded',last_error=NULL,completed_at=now(),result=result || jsonb_build_object('deleted',true,'deleted_at',now()) WHERE id=$1`, job.ID); err != nil {
		return err
	}
	var incomplete int
	if err = tx.QueryRow(ctx, `SELECT count(*) FROM privacy_fulfilment_jobs WHERE request_id=$1 AND status<>'succeeded'`, job.RequestID).Scan(&incomplete); err != nil {
		return err
	}
	if incomplete == 0 {
		if _, err = tx.Exec(ctx, `UPDATE privacy_requests SET status='fulfilled',completed_at=COALESCE(completed_at,now()),error_message=NULL,result_manifest=result_manifest || jsonb_build_object('private_cv_object','deleted') WHERE id=$1 AND status='in_progress'`, job.RequestID); err != nil {
			return err
		}
	}
	if _, err = tx.Exec(ctx, `INSERT INTO privacy_audit_events(event_type,resource_type,resource_id,outcome,metadata) VALUES('privacy.erasure.private_object_deleted','privacy_request',$1,'success',jsonb_build_object('job_id',$2))`, job.RequestID, job.ID); err != nil {
		return err
	}
	return tx.Commit(ctx)
}
