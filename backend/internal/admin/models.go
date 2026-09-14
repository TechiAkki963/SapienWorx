package admin

import "time"

type CompanyVerificationStatus string

const (
	CompanyVerificationPending  CompanyVerificationStatus = "pending"
	CompanyVerificationApproved CompanyVerificationStatus = "approved"
	CompanyVerificationRejected CompanyVerificationStatus = "rejected"
)

type CompanyVerification struct {
	ID                 string                    `json:"id" gorm:"type:uuid;primaryKey;default:gen_random_uuid()"`
	CompanyID          string                    `json:"company_id" gorm:"type:uuid;not null;index"`
	RecruiterUserID    string                    `json:"recruiter_user_id" gorm:"type:uuid;not null;index"`
	CompanyName        string                    `json:"company_name" gorm:"type:varchar(200);not null"`
	RegistrationDocURL *string                   `json:"registration_doc_url,omitempty" gorm:"type:text"`
	Status             CompanyVerificationStatus `json:"status" gorm:"type:company_verification_review_status;not null;default:pending;index"`
	ReviewedBy         *string                   `json:"reviewed_by,omitempty" gorm:"type:uuid;index"`
	ReviewNotes        *string                   `json:"review_notes,omitempty" gorm:"type:text"`
	ReviewedAt         *time.Time                `json:"reviewed_at,omitempty" gorm:"type:timestamptz"`
	CreatedAt          time.Time                 `json:"created_at" gorm:"type:timestamptz;not null;autoCreateTime"`
	UpdatedAt          time.Time                 `json:"updated_at" gorm:"type:timestamptz;not null;autoUpdateTime"`
}

func (CompanyVerification) TableName() string { return "company_verifications" }

type AuditLog struct {
	ID               string         `json:"id" gorm:"type:uuid;primaryKey;default:gen_random_uuid()"`
	AdminID          *string        `json:"admin_id,omitempty" gorm:"type:uuid;index"`
	ActionType       string         `json:"action_type" gorm:"type:varchar(120);not null;index"`
	TargetEntityType *string        `json:"target_entity_type,omitempty" gorm:"type:varchar(80);index"`
	TargetEntityID   *string        `json:"target_entity_id,omitempty" gorm:"type:uuid;index"`
	IPAddress        *string        `json:"ip_address,omitempty" gorm:"type:inet"`
	RequestID        *string        `json:"request_id,omitempty" gorm:"type:varchar(80)"`
	Metadata         map[string]any `json:"metadata" gorm:"type:jsonb;serializer:json;not null;default:'{}'"`
	CreatedAt        time.Time      `json:"created_at" gorm:"type:timestamptz;not null;autoCreateTime;index"`
}

func (AuditLog) TableName() string { return "admin_audit_logs" }

type PlatformMetrics struct {
	MetricDate            time.Time `json:"metric_date" gorm:"type:date;primaryKey"`
	TotalActiveUsers      int64     `json:"total_active_users" gorm:"not null;default:0"`
	ActiveJobs            int64     `json:"active_jobs" gorm:"not null;default:0"`
	TotalCandidates       int64     `json:"total_candidates" gorm:"not null;default:0"`
	JobsPostedToday       int64     `json:"jobs_posted_today" gorm:"not null;default:0"`
	SNSSMSSent            int64     `json:"sns_sms_sent" gorm:"not null;default:0"`
	SNSBillingCycleStart *time.Time `json:"sns_billing_cycle_start,omitempty" gorm:"type:date"`
	ComputedAt            time.Time `json:"computed_at" gorm:"type:timestamptz;not null"`
}

func (PlatformMetrics) TableName() string { return "platform_metrics_daily" }
