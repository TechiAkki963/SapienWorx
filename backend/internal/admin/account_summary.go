package admin

import (
	"context"
	"errors"
	"time"

	"github.com/jackc/pgx/v5"
)

// A whitelisted operational summary, not a copy of the professional profile,
// consent metadata, session tokens, message text or uploaded documents.
type CandidateSummary struct {
	Onboarding        string    `json:"onboarding"`
	Method            string    `json:"method"`
	ProfileCompletion int       `json:"profile_completion"`
	Discoverable      bool      `json:"discoverable"`
	ContactSharing    bool      `json:"contact_sharing"`
	ResumeUploaded    bool      `json:"resume_uploaded"`
	UpdatedAt         time.Time `json:"updated_at"`
	Applications      int64     `json:"applications"`
}
type RecruiterSummary struct {
	CompanyID               *string    `json:"company_id,omitempty"`
	Verification            string     `json:"verification"`
	JobsOwned               int64      `json:"jobs_owned"`
	ActiveJobsOwned         int64      `json:"active_jobs_owned"`
	ApplicationsToOwnedJobs int64      `json:"applications_to_owned_jobs"`
	StageChanges            int64      `json:"stage_changes"`
	InterviewChanges        int64      `json:"interview_changes"`
	LastRecordedWorkflow    *time.Time `json:"last_recorded_workflow,omitempty"`
}
type ConsentSummary struct {
	Events                  int64      `json:"events"`
	LatestPurposes          int64      `json:"latest_purposes"`
	LatestGranted           int64      `json:"latest_granted"`
	LatestDeniedOrWithdrawn int64      `json:"latest_denied_or_withdrawn"`
	LastRecordedAt          *time.Time `json:"last_recorded_at,omitempty"`
}
type AccountSummary struct {
	ID             string            `json:"id"`
	Role           string            `json:"role"`
	Status         string            `json:"status"`
	CreatedAt      time.Time         `json:"created_at"`
	LastLoginAt    *time.Time        `json:"last_login_at,omitempty"`
	ActiveSessions int64             `json:"active_sessions"`
	Consent        ConsentSummary    `json:"consent"`
	Candidate      *CandidateSummary `json:"candidate,omitempty"`
	Recruiter      *RecruiterSummary `json:"recruiter,omitempty"`
	ComputedAt     time.Time         `json:"computed_at"`
}

func (s *Service) AccountSummary(ctx context.Context, id string) (AccountSummary, error) {
	if !validResourceID(id) {
		return AccountSummary{}, ErrInvalid
	}
	ctx, cancel := context.WithTimeout(ctx, 5*time.Second)
	defer cancel()
	tx, err := s.db.BeginTx(ctx, pgx.TxOptions{IsoLevel: pgx.RepeatableRead, AccessMode: pgx.ReadOnly})
	if err != nil {
		return AccountSummary{}, err
	}
	defer tx.Rollback(ctx)
	result := AccountSummary{ComputedAt: s.now().UTC()}
	err = tx.QueryRow(ctx, `SELECT id,role::text,status::text,created_at,last_login_at,(SELECT count(*) FROM refresh_sessions WHERE user_id=u.id AND revoked_at IS NULL AND expires_at>$2) FROM users u WHERE id=$1`, id, result.ComputedAt).Scan(&result.ID, &result.Role, &result.Status, &result.CreatedAt, &result.LastLoginAt, &result.ActiveSessions)
	if errors.Is(err, pgx.ErrNoRows) {
		return AccountSummary{}, ErrNotFound
	}
	if err != nil {
		return AccountSummary{}, err
	}
	err = tx.QueryRow(ctx, `WITH latest AS (SELECT DISTINCT ON(purpose) granted,withdrawn_at FROM privacy_consents WHERE user_id=$1 ORDER BY purpose,recorded_at DESC,id DESC) SELECT (SELECT count(*) FROM privacy_consents WHERE user_id=$1),count(*),count(*) FILTER(WHERE granted AND withdrawn_at IS NULL),count(*) FILTER(WHERE NOT granted OR withdrawn_at IS NOT NULL),(SELECT max(recorded_at) FROM privacy_consents WHERE user_id=$1) FROM latest`, id).Scan(&result.Consent.Events, &result.Consent.LatestPurposes, &result.Consent.LatestGranted, &result.Consent.LatestDeniedOrWithdrawn, &result.Consent.LastRecordedAt)
	if err != nil {
		return AccountSummary{}, err
	}
	if result.Role == "candidate" {
		c := CandidateSummary{}
		err = tx.QueryRow(ctx, `SELECT CASE WHEN profile_details->>'onboarding_status' IN ('not_started','manual_started','cv_started','review_required','profile_ready') THEN profile_details->>'onboarding_status' ELSE 'not_recorded' END,CASE WHEN profile_details->>'onboarding_method' IN ('cv','manual') THEN profile_details->>'onboarding_method' ELSE 'not_recorded' END,profile_completion,COALESCE(profile_details->>'discoverable_to_recruiters'='true',false),contact_reveal_enabled,cv_uploaded_at IS NOT NULL,updated_at,(SELECT count(*) FROM applications WHERE candidate_id=$1) FROM candidate_profiles WHERE user_id=$1`, id).Scan(&c.Onboarding, &c.Method, &c.ProfileCompletion, &c.Discoverable, &c.ContactSharing, &c.ResumeUploaded, &c.UpdatedAt, &c.Applications)
		if err == nil {
			result.Candidate = &c
		} else if !errors.Is(err, pgx.ErrNoRows) {
			return AccountSummary{}, err
		}
	} else if result.Role == "recruiter" {
		r := RecruiterSummary{}
		err = tx.QueryRow(ctx, `SELECT company_id,verification_status::text,(SELECT count(*) FROM jobs WHERE created_by_recruiter_id=$1),(SELECT count(*) FROM jobs WHERE created_by_recruiter_id=$1 AND status='active'),(SELECT count(*) FROM applications a JOIN jobs j ON j.id=a.job_id WHERE j.created_by_recruiter_id=$1),(SELECT count(*) FROM application_stage_audit WHERE actor_recruiter_id=$1),(SELECT count(*) FROM interview_change_audit WHERE actor_recruiter_id=$1),(SELECT max(at) FROM (SELECT changed_at AS at FROM application_stage_audit WHERE actor_recruiter_id=$1 UNION ALL SELECT changed_at FROM interview_change_audit WHERE actor_recruiter_id=$1) events) FROM recruiter_profiles WHERE user_id=$1`, id).Scan(&r.CompanyID, &r.Verification, &r.JobsOwned, &r.ActiveJobsOwned, &r.ApplicationsToOwnedJobs, &r.StageChanges, &r.InterviewChanges, &r.LastRecordedWorkflow)
		if err == nil {
			result.Recruiter = &r
		} else if !errors.Is(err, pgx.ErrNoRows) {
			return AccountSummary{}, err
		}
	}
	return result, tx.Commit(ctx)
}
