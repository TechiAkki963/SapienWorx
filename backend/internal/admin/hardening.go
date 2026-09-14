package admin

import (
	"context"
	"encoding/json"
	"errors"
	"strings"
	"time"

	"github.com/jackc/pgx/v5"
)

type AuditRecord struct {
	ID               string          `json:"id"`
	AdminID          *string         `json:"admin_id,omitempty"`
	AdminName        *string         `json:"admin_name,omitempty"`
	ActionType       string          `json:"action_type"`
	TargetEntityType *string         `json:"target_entity_type,omitempty"`
	TargetEntityID   *string         `json:"target_entity_id,omitempty"`
	IPAddress        *string         `json:"ip_address,omitempty"`
	RequestID        *string         `json:"request_id,omitempty"`
	Metadata         json.RawMessage `json:"metadata"`
	CreatedAt        time.Time       `json:"created_at"`
}

type AuditList struct {
	Items []AuditRecord `json:"items"`
	Page  int           `json:"page"`
	Limit int           `json:"limit"`
	Total int           `json:"total"`
}

type JobModerationRecord struct {
	ID               string     `json:"id"`
	Title            string     `json:"title"`
	CompanyID        string     `json:"company_id"`
	CompanyName      string     `json:"company_name"`
	RecruiterUserID  string     `json:"recruiter_user_id"`
	RecruiterName    string     `json:"recruiter_name"`
	Status           string     `json:"status"`
	WorkMode         string     `json:"work_mode"`
	City             *string    `json:"city,omitempty"`
	CountryCode      string     `json:"country_code"`
	PublishedAt      *time.Time `json:"published_at,omitempty"`
	CreatedAt        time.Time  `json:"created_at"`
	UpdatedAt        time.Time  `json:"updated_at"`
	ApplicationCount int64      `json:"application_count"`
}

type JobModerationList struct {
	Items []JobModerationRecord `json:"items"`
	Page  int                   `json:"page"`
	Limit int                   `json:"limit"`
	Total int                   `json:"total"`
}

type BudgetSettings struct {
	SNSWarningCount  int       `json:"sns_sms_warning_count"`
	SNSCriticalCount int       `json:"sns_sms_critical_count"`
	UpdatedAt        time.Time `json:"updated_at"`
	UpdatedBy        *string   `json:"updated_by,omitempty"`
}

func (s *Service) AuditLogs(ctx context.Context, query, action, targetType string, page, limit int) (AuditList, error) {
	page, limit = normalizePage(page, limit)
	query = strings.TrimSpace(query)
	action = strings.TrimSpace(action)
	targetType = strings.TrimSpace(targetType)
	const where = `($1='' OR al.action_type ILIKE '%'||$1||'%' OR COALESCE(al.request_id,'') ILIKE '%'||$1||'%' OR COALESCE(al.target_entity_id::text,'') ILIKE '%'||$1||'%' OR COALESCE(ap.full_name,'') ILIKE '%'||$1||'%') AND ($2='' OR al.action_type=$2) AND ($3='' OR COALESCE(al.target_entity_type,'')=$3)`

	var total int
	if err := s.db.QueryRow(ctx, `SELECT count(*) FROM admin_audit_logs al LEFT JOIN admin_profiles ap ON ap.user_id=al.admin_id WHERE `+where, query, action, targetType).Scan(&total); err != nil {
		return AuditList{}, err
	}

	rows, err := s.db.Query(ctx, `SELECT al.id,al.admin_id,ap.full_name,al.action_type,al.target_entity_type,al.target_entity_id,al.ip_address::text,al.request_id,al.metadata,al.created_at FROM admin_audit_logs al LEFT JOIN admin_profiles ap ON ap.user_id=al.admin_id WHERE `+where+` ORDER BY al.created_at DESC LIMIT $4 OFFSET $5`, query, action, targetType, limit, (page-1)*limit)
	if err != nil {
		return AuditList{}, err
	}
	defer rows.Close()

	items := make([]AuditRecord, 0)
	for rows.Next() {
		var item AuditRecord
		if err := rows.Scan(&item.ID, &item.AdminID, &item.AdminName, &item.ActionType, &item.TargetEntityType, &item.TargetEntityID, &item.IPAddress, &item.RequestID, &item.Metadata, &item.CreatedAt); err != nil {
			return AuditList{}, err
		}
		items = append(items, item)
	}
	if err := rows.Err(); err != nil {
		return AuditList{}, err
	}
	return AuditList{Items: items, Page: page, Limit: limit, Total: total}, nil
}

func (s *Service) Jobs(ctx context.Context, query, status string, page, limit int) (JobModerationList, error) {
	page, limit = normalizePage(page, limit)
	query = strings.TrimSpace(query)
	status = strings.ToLower(strings.TrimSpace(status))
	if status != "" && status != "draft" && status != "active" && status != "paused" && status != "closed" && status != "expired" && status != "archived" {
		return JobModerationList{}, ErrInvalid
	}
	const where = `($1='' OR j.title ILIKE '%'||$1||'%' OR c.display_name ILIKE '%'||$1||'%' OR c.legal_name ILIKE '%'||$1||'%' OR j.id::text=$1) AND ($2='' OR j.status::text=$2)`

	var total int
	if err := s.db.QueryRow(ctx, `SELECT count(*) FROM jobs j JOIN companies c ON c.id=j.company_id WHERE `+where, query, status).Scan(&total); err != nil {
		return JobModerationList{}, err
	}

	rows, err := s.db.Query(ctx, `SELECT j.id,j.title,j.company_id,c.display_name,j.created_by_recruiter_id,rp.full_name,j.status::text,j.work_mode::text,j.city,j.country_code,j.published_at,j.created_at,j.updated_at,(SELECT count(*) FROM applications a WHERE a.job_id=j.id) FROM jobs j JOIN companies c ON c.id=j.company_id JOIN recruiter_profiles rp ON rp.user_id=j.created_by_recruiter_id WHERE `+where+` ORDER BY j.updated_at DESC LIMIT $3 OFFSET $4`, query, status, limit, (page-1)*limit)
	if err != nil {
		return JobModerationList{}, err
	}
	defer rows.Close()

	items := make([]JobModerationRecord, 0)
	for rows.Next() {
		var item JobModerationRecord
		if err := rows.Scan(&item.ID, &item.Title, &item.CompanyID, &item.CompanyName, &item.RecruiterUserID, &item.RecruiterName, &item.Status, &item.WorkMode, &item.City, &item.CountryCode, &item.PublishedAt, &item.CreatedAt, &item.UpdatedAt, &item.ApplicationCount); err != nil {
			return JobModerationList{}, err
		}
		items = append(items, item)
	}
	if err := rows.Err(); err != nil {
		return JobModerationList{}, err
	}
	return JobModerationList{Items: items, Page: page, Limit: limit, Total: total}, nil
}

func (s *Service) RegistrationDocument(ctx context.Context, verificationID, adminID, ip, requestID string) (string, error) {
	tx, err := s.db.BeginTx(ctx, pgx.TxOptions{})
	if err != nil {
		return "", err
	}
	defer tx.Rollback(ctx)

	var documentURL *string
	var companyID string
	err = tx.QueryRow(ctx, `SELECT registration_doc_url,company_id FROM company_verifications WHERE id=$1`, verificationID).Scan(&documentURL, &companyID)
	if errors.Is(err, pgx.ErrNoRows) {
		return "", ErrNotFound
	}
	if err != nil {
		return "", err
	}
	if documentURL == nil || strings.TrimSpace(*documentURL) == "" {
		return "", ErrNotFound
	}

	target := verificationID
	if err := insertAuditTx(ctx, tx, AuditInput{AdminID: &adminID, ActionType: "company_verification.document_view", TargetEntityType: "company_verification", TargetEntityID: &target, IPAddress: ip, RequestID: requestID, Metadata: map[string]any{"company_id": companyID}}); err != nil {
		return "", err
	}
	if err := tx.Commit(ctx); err != nil {
		return "", err
	}
	return strings.TrimSpace(*documentURL), nil
}

func (s *Service) BudgetSettings(ctx context.Context) (BudgetSettings, error) {
	var result BudgetSettings
	err := s.db.QueryRow(ctx, `SELECT sns_sms_warning_count,sns_sms_critical_count,updated_at,updated_by FROM platform_admin_settings WHERE singleton=true`).Scan(&result.SNSWarningCount, &result.SNSCriticalCount, &result.UpdatedAt, &result.UpdatedBy)
	if errors.Is(err, pgx.ErrNoRows) {
		return BudgetSettings{}, ErrNotFound
	}
	if err != nil {
		return BudgetSettings{}, err
	}
	return result, nil
}

func (s *Service) UpdateBudgetSettings(ctx context.Context, adminID string, warningCount, criticalCount int, ip, requestID string) (BudgetSettings, error) {
	if warningCount < 0 || criticalCount <= warningCount {
		return BudgetSettings{}, ErrInvalid
	}
	tx, err := s.db.BeginTx(ctx, pgx.TxOptions{})
	if err != nil {
		return BudgetSettings{}, err
	}
	defer tx.Rollback(ctx)

	var result BudgetSettings
	if err := tx.QueryRow(ctx, `UPDATE platform_admin_settings SET sns_sms_warning_count=$1,sns_sms_critical_count=$2,updated_at=now(),updated_by=$3 WHERE singleton=true RETURNING sns_sms_warning_count,sns_sms_critical_count,updated_at,updated_by`, warningCount, criticalCount, adminID).Scan(&result.SNSWarningCount, &result.SNSCriticalCount, &result.UpdatedAt, &result.UpdatedBy); err != nil {
		return BudgetSettings{}, err
	}
	if err := insertAuditTx(ctx, tx, AuditInput{AdminID: &adminID, ActionType: "platform.budget_settings_updated", TargetEntityType: "platform_settings", IPAddress: ip, RequestID: requestID, Metadata: map[string]any{"sns_sms_warning_count": warningCount, "sns_sms_critical_count": criticalCount}}); err != nil {
		return BudgetSettings{}, err
	}
	if err := tx.Commit(ctx); err != nil {
		return BudgetSettings{}, err
	}
	return result, nil
}
