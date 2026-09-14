package admin

import (
	"context"
	"encoding/json"
	"errors"
	"strings"
	"time"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
)

var (
	ErrNotFound  = errors.New("admin resource not found")
	ErrForbidden = errors.New("admin operation forbidden")
	ErrInvalid   = errors.New("invalid admin operation")
)

type Service struct {
	db  *pgxpool.Pool
	now func() time.Time
}

func NewService(db *pgxpool.Pool) *Service {
	return &Service{db: db, now: time.Now}
}

type AuditInput struct {
	AdminID          *string
	ActionType       string
	TargetEntityType string
	TargetEntityID   *string
	IPAddress        string
	RequestID        string
	Metadata         map[string]any
}

type VerificationList struct {
	Items []CompanyVerification `json:"items"`
	Page  int                   `json:"page"`
	Limit int                   `json:"limit"`
	Total int                   `json:"total"`
}

type UserRecord struct {
	ID                 string     `json:"id"`
	Role               string     `json:"role"`
	Status             string     `json:"status"`
	Name               string     `json:"name"`
	Email              string     `json:"email"`
	Phone               *string    `json:"phone,omitempty"`
	EmailVerifiedAt    *time.Time `json:"email_verified_at,omitempty"`
	PhoneVerifiedAt    *time.Time `json:"phone_verified_at,omitempty"`
	ForcePasswordReset bool       `json:"force_password_reset"`
	CreatedAt          time.Time  `json:"created_at"`
}

type UserList struct {
	Items []UserRecord `json:"items"`
	Page  int          `json:"page"`
	Limit int          `json:"limit"`
	Total int          `json:"total"`
}

type MetricsSnapshot struct {
	MetricDate              time.Time `json:"metric_date"`
	TotalActiveUsers        int64     `json:"total_active_users"`
	ActiveJobs              int64     `json:"active_jobs"`
	TotalCandidates         int64     `json:"total_candidates"`
	JobsPostedToday         int64     `json:"jobs_posted_today"`
	SNSSMSSentToday         int64     `json:"sns_sms_sent_today"`
	SNSSMSSentBillingCycle  int64     `json:"sns_sms_sent_billing_cycle"`
	SNSBillingCycleStart    time.Time `json:"sns_billing_cycle_start"`
	PendingCompanyReviews   int64     `json:"pending_company_reviews"`
	ComputedAt              time.Time `json:"computed_at"`
}

func normalizePage(page, limit int) (int, int) {
	if page < 1 {
		page = 1
	}
	if limit < 1 || limit > 100 {
		limit = 25
	}
	return page, limit
}

func (s *Service) Audit(ctx context.Context, input AuditInput) error {
	metadata := input.Metadata
	if metadata == nil {
		metadata = map[string]any{}
	}
	raw, err := json.Marshal(metadata)
	if err != nil {
		return err
	}
	var targetType any
	if strings.TrimSpace(input.TargetEntityType) != "" {
		targetType = strings.TrimSpace(input.TargetEntityType)
	}
	var ip any
	if strings.TrimSpace(input.IPAddress) != "" {
		ip = strings.TrimSpace(input.IPAddress)
	}
	var requestID any
	if strings.TrimSpace(input.RequestID) != "" {
		requestID = strings.TrimSpace(input.RequestID)
	}
	_, err = s.db.Exec(ctx, `INSERT INTO admin_audit_logs(admin_id,action_type,target_entity_type,target_entity_id,ip_address,request_id,metadata) VALUES($1,$2,$3,$4,$5,$6,$7)`, input.AdminID, strings.TrimSpace(input.ActionType), targetType, input.TargetEntityID, ip, requestID, raw)
	return err
}

func insertAuditTx(ctx context.Context, tx pgx.Tx, input AuditInput) error {
	metadata := input.Metadata
	if metadata == nil {
		metadata = map[string]any{}
	}
	raw, err := json.Marshal(metadata)
	if err != nil {
		return err
	}
	var targetType any
	if strings.TrimSpace(input.TargetEntityType) != "" {
		targetType = strings.TrimSpace(input.TargetEntityType)
	}
	var ip any
	if strings.TrimSpace(input.IPAddress) != "" {
		ip = strings.TrimSpace(input.IPAddress)
	}
	var requestID any
	if strings.TrimSpace(input.RequestID) != "" {
		requestID = strings.TrimSpace(input.RequestID)
	}
	_, err = tx.Exec(ctx, `INSERT INTO admin_audit_logs(admin_id,action_type,target_entity_type,target_entity_id,ip_address,request_id,metadata) VALUES($1,$2,$3,$4,$5,$6,$7)`, input.AdminID, strings.TrimSpace(input.ActionType), targetType, input.TargetEntityID, ip, requestID, raw)
	return err
}

func (s *Service) Metrics(ctx context.Context) (MetricsSnapshot, error) {
	now := s.now().UTC()
	cycleStart := time.Date(now.Year(), now.Month(), 1, 0, 0, 0, 0, time.UTC)
	var result MetricsSnapshot
	result.MetricDate = time.Date(now.Year(), now.Month(), now.Day(), 0, 0, 0, 0, time.UTC)
	result.SNSBillingCycleStart = cycleStart
	result.ComputedAt = now

	err := s.db.QueryRow(ctx, `SELECT
		(SELECT count(*) FROM users WHERE is_active=true AND status='active'),
		(SELECT count(*) FROM jobs WHERE status='active' AND (application_deadline IS NULL OR application_deadline>=current_date)),
		(SELECT count(*) FROM users WHERE role='candidate' AND is_active=true),
		(SELECT count(*) FROM jobs WHERE published_at::date=current_date),
		COALESCE((SELECT sns_sms_sent FROM platform_metrics_daily WHERE metric_date=current_date),0),
		COALESCE((SELECT sum(sns_sms_sent) FROM platform_metrics_daily WHERE metric_date >= date_trunc('month',current_date)::date AND metric_date<=current_date),0),
		(SELECT count(*) FROM company_verifications WHERE status='pending')`).Scan(
		&result.TotalActiveUsers,
		&result.ActiveJobs,
		&result.TotalCandidates,
		&result.JobsPostedToday,
		&result.SNSSMSSentToday,
		&result.SNSSMSSentBillingCycle,
		&result.PendingCompanyReviews,
	)
	if err != nil {
		return MetricsSnapshot{}, err
	}
	_, err = s.db.Exec(ctx, `INSERT INTO platform_metrics_daily(metric_date,total_active_users,active_jobs,total_candidates,jobs_posted_today,sns_billing_cycle_start,computed_at) VALUES(current_date,$1,$2,$3,$4,$5,$6) ON CONFLICT(metric_date) DO UPDATE SET total_active_users=EXCLUDED.total_active_users,active_jobs=EXCLUDED.active_jobs,total_candidates=EXCLUDED.total_candidates,jobs_posted_today=EXCLUDED.jobs_posted_today,sns_billing_cycle_start=EXCLUDED.sns_billing_cycle_start,computed_at=EXCLUDED.computed_at`, result.TotalActiveUsers, result.ActiveJobs, result.TotalCandidates, result.JobsPostedToday, cycleStart, now)
	if err != nil {
		return MetricsSnapshot{}, err
	}
	return result, nil
}

func (s *Service) CompanyVerifications(ctx context.Context, status string, page, limit int) (VerificationList, error) {
	page, limit = normalizePage(page, limit)
	status = strings.ToLower(strings.TrimSpace(status))
	if status == "" {
		status = "pending"
	}
	if status != "pending" && status != "approved" && status != "rejected" {
		return VerificationList{}, ErrInvalid
	}
	var total int
	if err := s.db.QueryRow(ctx, `SELECT count(*) FROM company_verifications WHERE status::text=$1`, status).Scan(&total); err != nil {
		return VerificationList{}, err
	}
	rows, err := s.db.Query(ctx, `SELECT id,company_id,recruiter_user_id,company_name,registration_doc_url,status::text,reviewed_by,review_notes,reviewed_at,created_at,updated_at FROM company_verifications WHERE status::text=$1 ORDER BY created_at ASC LIMIT $2 OFFSET $3`, status, limit, (page-1)*limit)
	if err != nil {
		return VerificationList{}, err
	}
	defer rows.Close()
	items := make([]CompanyVerification, 0)
	for rows.Next() {
		var item CompanyVerification
		if err := rows.Scan(&item.ID, &item.CompanyID, &item.RecruiterUserID, &item.CompanyName, &item.RegistrationDocURL, &item.Status, &item.ReviewedBy, &item.ReviewNotes, &item.ReviewedAt, &item.CreatedAt, &item.UpdatedAt); err != nil {
			return VerificationList{}, err
		}
		items = append(items, item)
	}
	if err := rows.Err(); err != nil {
		return VerificationList{}, err
	}
	return VerificationList{Items: items, Page: page, Limit: limit, Total: total}, nil
}

func (s *Service) ReviewCompany(ctx context.Context, verificationID, adminID, decision, notes, ip, requestID string) error {
	decision = strings.ToLower(strings.TrimSpace(decision))
	if decision != "approved" && decision != "rejected" {
		return ErrInvalid
	}
	tx, err := s.db.BeginTx(ctx, pgx.TxOptions{})
	if err != nil {
		return err
	}
	defer tx.Rollback(ctx)
	var companyID, recruiterID string
	err = tx.QueryRow(ctx, `SELECT company_id,recruiter_user_id FROM company_verifications WHERE id=$1 AND status='pending' FOR UPDATE`, verificationID).Scan(&companyID, &recruiterID)
	if errors.Is(err, pgx.ErrNoRows) {
		return ErrNotFound
	}
	if err != nil {
		return err
	}
	if _, err = tx.Exec(ctx, `UPDATE company_verifications SET status=$2,reviewed_by=$3,review_notes=NULLIF($4,''),reviewed_at=now() WHERE id=$1`, verificationID, decision, adminID, strings.TrimSpace(notes)); err != nil {
		return err
	}
	if decision == "approved" {
		if _, err = tx.Exec(ctx, `UPDATE companies SET verification_status='verified',verified_at=COALESCE(verified_at,now()) WHERE id=$1`, companyID); err != nil {
			return err
		}
		if _, err = tx.Exec(ctx, `UPDATE recruiter_profiles SET verification_status='verified',verified_at=COALESCE(verified_at,now()) WHERE user_id=$1`, recruiterID); err != nil {
			return err
		}
		if _, err = tx.Exec(ctx, `UPDATE users SET status=CASE WHEN email_verified_at IS NOT NULL AND phone_verified_at IS NOT NULL THEN 'active'::account_status ELSE 'pending_verification'::account_status END WHERE id=$1`, recruiterID); err != nil {
			return err
		}
	} else {
		if _, err = tx.Exec(ctx, `UPDATE recruiter_profiles SET verification_status='rejected' WHERE user_id=$1`, recruiterID); err != nil {
			return err
		}
		if _, err = tx.Exec(ctx, `UPDATE users SET status='disabled' WHERE id=$1`, recruiterID); err != nil {
			return err
		}
		if _, err = tx.Exec(ctx, `UPDATE refresh_sessions SET revoked_at=COALESCE(revoked_at,now()) WHERE user_id=$1 AND revoked_at IS NULL`, recruiterID); err != nil {
			return err
		}
	}
	target := verificationID
	if err = insertAuditTx(ctx, tx, AuditInput{AdminID: &adminID, ActionType: "company_verification." + decision, TargetEntityType: "company_verification", TargetEntityID: &target, IPAddress: ip, RequestID: requestID, Metadata: map[string]any{"company_id": companyID, "recruiter_user_id": recruiterID, "notes": strings.TrimSpace(notes)}}); err != nil {
		return err
	}
	return tx.Commit(ctx)
}

func (s *Service) Users(ctx context.Context, query, role, status string, page, limit int) (UserList, error) {
	page, limit = normalizePage(page, limit)
	query = strings.TrimSpace(query)
	role = strings.ToLower(strings.TrimSpace(role))
	status = strings.ToLower(strings.TrimSpace(status))
	if role != "" && role != "candidate" && role != "recruiter" && role != "master_admin" {
		return UserList{}, ErrInvalid
	}
	if status != "" && status != "pending_verification" && status != "active" && status != "suspended" && status != "disabled" {
		return UserList{}, ErrInvalid
	}
	const where = `($1='' OR u.email ILIKE '%'||$1||'%' OR COALESCE(u.phone_e164,'') ILIKE '%'||$1||'%' OR COALESCE(cp.full_name,rp.full_name,ap.full_name,'') ILIKE '%'||$1||'%') AND ($2='' OR u.role::text=$2) AND ($3='' OR u.status::text=$3)`
	var total int
	if err := s.db.QueryRow(ctx, `SELECT count(*) FROM users u LEFT JOIN candidate_profiles cp ON cp.user_id=u.id LEFT JOIN recruiter_profiles rp ON rp.user_id=u.id LEFT JOIN admin_profiles ap ON ap.user_id=u.id WHERE `+where, query, role, status).Scan(&total); err != nil {
		return UserList{}, err
	}
	rows, err := s.db.Query(ctx, `SELECT u.id,u.role::text,u.status::text,COALESCE(cp.full_name,rp.full_name,ap.full_name,''),u.email,u.phone_e164,u.email_verified_at,u.phone_verified_at,u.force_password_reset,u.created_at FROM users u LEFT JOIN candidate_profiles cp ON cp.user_id=u.id LEFT JOIN recruiter_profiles rp ON rp.user_id=u.id LEFT JOIN admin_profiles ap ON ap.user_id=u.id WHERE `+where+` ORDER BY u.created_at DESC LIMIT $4 OFFSET $5`, query, role, status, limit, (page-1)*limit)
	if err != nil {
		return UserList{}, err
	}
	defer rows.Close()
	items := make([]UserRecord, 0)
	for rows.Next() {
		var item UserRecord
		if err := rows.Scan(&item.ID, &item.Role, &item.Status, &item.Name, &item.Email, &item.Phone, &item.EmailVerifiedAt, &item.PhoneVerifiedAt, &item.ForcePasswordReset, &item.CreatedAt); err != nil {
			return UserList{}, err
		}
		items = append(items, item)
	}
	if err := rows.Err(); err != nil {
		return UserList{}, err
	}
	return UserList{Items: items, Page: page, Limit: limit, Total: total}, nil
}

func (s *Service) SuspendUser(ctx context.Context, targetID, adminID, reason, ip, requestID string) error {
	return s.moderateUser(ctx, targetID, adminID, "suspend", reason, ip, requestID)
}

func (s *Service) ForcePasswordReset(ctx context.Context, targetID, adminID, reason, ip, requestID string) error {
	return s.moderateUser(ctx, targetID, adminID, "force_password_reset", reason, ip, requestID)
}

func (s *Service) moderateUser(ctx context.Context, targetID, adminID, action, reason, ip, requestID string) error {
	if targetID == adminID {
		return ErrForbidden
	}
	tx, err := s.db.BeginTx(ctx, pgx.TxOptions{})
	if err != nil {
		return err
	}
	defer tx.Rollback(ctx)
	var role string
	err = tx.QueryRow(ctx, `SELECT role::text FROM users WHERE id=$1 AND is_active=true FOR UPDATE`, targetID).Scan(&role)
	if errors.Is(err, pgx.ErrNoRows) {
		return ErrNotFound
	}
	if err != nil {
		return err
	}
	if role == "master_admin" {
		return ErrForbidden
	}
	switch action {
	case "suspend":
		if _, err = tx.Exec(ctx, `UPDATE users SET status='suspended' WHERE id=$1`, targetID); err != nil {
			return err
		}
	case "force_password_reset":
		if _, err = tx.Exec(ctx, `UPDATE users SET force_password_reset=true WHERE id=$1`, targetID); err != nil {
			return err
		}
	default:
		return ErrInvalid
	}
	if _, err = tx.Exec(ctx, `UPDATE refresh_sessions SET revoked_at=COALESCE(revoked_at,now()) WHERE user_id=$1 AND revoked_at IS NULL`, targetID); err != nil {
		return err
	}
	target := targetID
	if err = insertAuditTx(ctx, tx, AuditInput{AdminID: &adminID, ActionType: "user." + action, TargetEntityType: "user", TargetEntityID: &target, IPAddress: ip, RequestID: requestID, Metadata: map[string]any{"reason": strings.TrimSpace(reason), "role": role}}); err != nil {
		return err
	}
	return tx.Commit(ctx)
}

func (s *Service) TakedownJob(ctx context.Context, jobID, adminID, reason, ip, requestID string) error {
	tx, err := s.db.BeginTx(ctx, pgx.TxOptions{})
	if err != nil {
		return err
	}
	defer tx.Rollback(ctx)
	var previousStatus, title string
	err = tx.QueryRow(ctx, `SELECT status::text,title FROM jobs WHERE id=$1 FOR UPDATE`, jobID).Scan(&previousStatus, &title)
	if errors.Is(err, pgx.ErrNoRows) {
		return ErrNotFound
	}
	if err != nil {
		return err
	}
	if _, err = tx.Exec(ctx, `UPDATE jobs SET status='closed',closed_at=COALESCE(closed_at,now()) WHERE id=$1`, jobID); err != nil {
		return err
	}
	target := jobID
	if err = insertAuditTx(ctx, tx, AuditInput{AdminID: &adminID, ActionType: "job.takedown", TargetEntityType: "job", TargetEntityID: &target, IPAddress: ip, RequestID: requestID, Metadata: map[string]any{"reason": strings.TrimSpace(reason), "title": title, "previous_status": previousStatus}}); err != nil {
		return err
	}
	return tx.Commit(ctx)
}
