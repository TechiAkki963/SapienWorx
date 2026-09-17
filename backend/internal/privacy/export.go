package privacy

import (
	"context"
	"encoding/json"
	"errors"
	"time"

	"github.com/jackc/pgx/v5"
)

// ExportBundle is intentionally assembled from an explicit field allow-list.
// Never replace these queries with SELECT *, to_jsonb(table), reflection-based
// dumping, or arbitrary table/section names supplied by a caller.
type ExportBundle struct {
	GeneratedAt time.Time                  `json:"generated_at"`
	Sections    map[string]json.RawMessage `json:"sections"`
}

func (s *Service) BuildSafeExport(ctx context.Context, userID string) (ExportBundle, error) {
	tx, err := s.db.Begin(ctx)
	if err != nil {
		return ExportBundle{}, err
	}
	defer tx.Rollback(ctx)

	var requestID string
	err = tx.QueryRow(ctx, `
		INSERT INTO privacy_requests(user_id,request_type,status,due_at)
		VALUES($1,'export','in_progress',$2)
		ON CONFLICT (user_id,request_type) WHERE status IN ('received','in_progress','awaiting_review')
		DO UPDATE SET status='in_progress',updated_at=now(),error_message=NULL
		RETURNING id`, userID, privacyDueAt(time.Now())).Scan(&requestID)
	if err != nil {
		return ExportBundle{}, err
	}

	var jobID string
	err = tx.QueryRow(ctx, `
		INSERT INTO privacy_fulfilment_jobs(request_id,job_type,idempotency_key,status,attempts,started_at)
		VALUES($1,'safe_data_export',$2,'running',1,now())
		ON CONFLICT(idempotency_key) DO UPDATE SET
			status='running',attempts=privacy_fulfilment_jobs.attempts+1,last_error=NULL,started_at=now(),completed_at=NULL,updated_at=now()
		RETURNING id`, requestID, "safe-export:"+requestID).Scan(&jobID)
	if err != nil {
		return ExportBundle{}, err
	}

	sections := make(map[string]json.RawMessage, len(SafeExportSections))
	queries := []struct {
		name string
		sql  string
	}{
		{"account", `SELECT jsonb_build_object(
			'id',id,'email',email,'role',role::text,'status',status::text,
			'phone',phone_e164,'email_verified_at',email_verified_at,
			'last_login_at',last_login_at,'created_at',created_at,'updated_at',updated_at
		) FROM users WHERE id=$1`},
		{"profile", `SELECT COALESCE(
			(SELECT jsonb_build_object(
				'profile_type','candidate','full_name',full_name,'headline',headline,
				'current_city',current_city,'current_state',current_state,'country_code',country_code,
				'total_experience_months',total_experience_months,'notice_period_days',notice_period_days,
				'current_salary_amount',current_salary_amount,'current_salary_currency',current_salary_currency,
				'expected_salary_amount',expected_salary_amount,'expected_salary_currency',expected_salary_currency,
				'cv_original_filename',cv_original_filename,'cv_uploaded_at',cv_uploaded_at,
				'profile_completion',profile_completion,'created_at',created_at,'updated_at',updated_at
			) FROM candidate_profiles WHERE user_id=$1),
			(SELECT jsonb_build_object(
				'profile_type','recruiter','full_name',full_name,'designation',designation,
				'company_id',company_id,'verification_status',verification_status::text,
				'verified_at',verified_at,'created_at',created_at,'updated_at',updated_at
			) FROM recruiter_profiles WHERE user_id=$1),
			'{}'::jsonb
		)`},
		{"applications", `SELECT COALESCE(jsonb_agg(jsonb_build_object(
			'id',id,'job_id',job_id,'stage',stage::text,'source',source,
			'applied_at',applied_at,'updated_at',updated_at
		) ORDER BY applied_at DESC),'[]'::jsonb) FROM applications WHERE candidate_id=$1`},
		{"saved_jobs", `SELECT COALESCE(jsonb_agg(jsonb_build_object(
			'job_id',job_id,'saved_at',saved_at
		) ORDER BY saved_at DESC),'[]'::jsonb) FROM saved_jobs WHERE candidate_id=$1`},
		{"notifications", `SELECT COALESCE(jsonb_agg(jsonb_build_object(
			'id',id,'kind',kind,'title',title,'body',body,'action_url',action_url,
			'read_at',read_at,'created_at',created_at
		) ORDER BY created_at DESC),'[]'::jsonb) FROM candidate_notifications WHERE candidate_id=$1`},
		{"messages", `SELECT COALESCE(jsonb_agg(jsonb_build_object(
			'id',m.id,'thread_id',m.thread_id,'sender_id',m.sender_id,
			'sender_type',m.sender_type::text,'content',m.content,'is_read',m.is_read,'created_at',m.created_at
		) ORDER BY m.created_at ASC),'[]'::jsonb)
		FROM chat_messages m JOIN chat_threads t ON t.id=m.thread_id
		WHERE t.candidate_id=$1 OR t.recruiter_id=$1`},
	}

	for _, query := range queries {
		if _, allowed := SafeExportSections[query.name]; !allowed {
			return ExportBundle{}, errors.New("unsafe export section")
		}
		var raw []byte
		if err := tx.QueryRow(ctx, query.sql, userID).Scan(&raw); err != nil {
			_, _ = tx.Exec(ctx, `UPDATE privacy_fulfilment_jobs SET status='failed',last_error=$2,completed_at=now() WHERE id=$1`, jobID, limitError(err.Error()))
			_, _ = tx.Exec(ctx, `UPDATE privacy_requests SET status='in_progress',error_message='export incomplete; fulfilment retry required',completed_at=NULL WHERE id=$1`, requestID)
			if commitErr := tx.Commit(ctx); commitErr != nil {
				return ExportBundle{}, commitErr
			}
			return ExportBundle{}, err
		}
		sections[query.name] = json.RawMessage(raw)
	}

	manifest, err := json.Marshal(map[string]any{"sections": []string{"account", "profile", "applications", "saved_jobs", "notifications", "messages"}, "complete": true})
	if err != nil {
		return ExportBundle{}, err
	}
	if _, err = tx.Exec(ctx, `UPDATE privacy_fulfilment_jobs SET status='succeeded',result=$2::jsonb,completed_at=now(),last_error=NULL WHERE id=$1`, jobID, manifest); err != nil {
		return ExportBundle{}, err
	}
	if _, err = tx.Exec(ctx, `UPDATE privacy_requests SET status='fulfilled',result_manifest=$2::jsonb,error_message=NULL,completed_at=now() WHERE id=$1 AND NOT EXISTS (SELECT 1 FROM privacy_fulfilment_jobs WHERE request_id=$1 AND status<>'succeeded')`, requestID, manifest); err != nil {
		return ExportBundle{}, err
	}
	if _, err = tx.Exec(ctx, `INSERT INTO privacy_audit_events(actor_user_id,subject_user_id,event_type,resource_type,resource_id,outcome,metadata) VALUES($1,$1,'privacy.export.completed','privacy_request',$2,'success',$3::jsonb)`, userID, requestID, manifest); err != nil {
		return ExportBundle{}, err
	}
	if err = tx.Commit(ctx); err != nil {
		return ExportBundle{}, err
	}
	return ExportBundle{GeneratedAt: time.Now().UTC(), Sections: sections}, nil
}

func limitError(value string) string {
	if len(value) <= 1000 {
		return value
	}
	return value[:1000]
}

// FinalizeRequestIfComplete is the only completion gate for asynchronous
// fulfilment work. A request with pending, running, failed or review work must
// never be represented as fulfilled.
func (s *Service) FinalizeRequestIfComplete(ctx context.Context, requestID string) (bool, error) {
	var incomplete int
	if err := s.db.QueryRow(ctx, `SELECT count(*) FROM privacy_fulfilment_jobs WHERE request_id=$1 AND status<>'succeeded'`, requestID).Scan(&incomplete); err != nil {
		return false, err
	}
	if incomplete != 0 {
		return false, nil
	}
	tag, err := s.db.Exec(ctx, `UPDATE privacy_requests SET status='fulfilled',completed_at=COALESCE(completed_at,now()),error_message=NULL WHERE id=$1 AND status IN ('received','in_progress')`, requestID)
	if err != nil {
		return false, err
	}
	return tag.RowsAffected() == 1, nil
}

func (s *Service) RequestByID(ctx context.Context, userID, requestID string) (Request, error) {
	var item Request
	err := s.db.QueryRow(ctx, `SELECT id,request_type,status,due_at,completed_at,created_at FROM privacy_requests WHERE id=$1 AND user_id=$2`, requestID, userID).Scan(&item.ID, &item.RequestType, &item.Status, &item.DueAt, &item.CompletedAt, &item.CreatedAt)
	if errors.Is(err, pgx.ErrNoRows) {
		return Request{}, ErrNotFound
	}
	return item, err
}
