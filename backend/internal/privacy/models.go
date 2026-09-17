package privacy

import (
	"encoding/json"
	"time"
)

type RequestType string

type RequestStatus string

const (
	RequestAccess      RequestType = "access"
	RequestExport      RequestType = "export"
	RequestCorrection  RequestType = "correction"
	RequestErasure     RequestType = "erasure"
	RequestRestriction RequestType = "restriction"
	RequestObjection   RequestType = "objection"
)

const (
	StatusReceived         RequestStatus = "received"
	StatusIdentityVerified RequestStatus = "identity_verified"
	StatusInProgress       RequestStatus = "in_progress"
	StatusBlocked          RequestStatus = "blocked"
	StatusReady            RequestStatus = "ready"
	StatusCompleted        RequestStatus = "completed"
	StatusRejected         RequestStatus = "rejected"
)

type ConsentInput struct {
	Scope         string         `json:"scope"`
	NoticeVersion string         `json:"notice_version"`
	LawfulBasis   string         `json:"lawful_basis"`
	Granted       bool           `json:"granted"`
	Source        string         `json:"source"`
	Metadata      map[string]any `json:"metadata,omitempty"`
}

type Request struct {
	ID                 string          `json:"id"`
	UserID             string          `json:"user_id,omitempty"`
	Type               RequestType     `json:"type"`
	Status             RequestStatus   `json:"status"`
	Reason             *string         `json:"reason,omitempty"`
	DueAt              time.Time       `json:"due_at"`
	IdentityVerifiedAt *time.Time      `json:"identity_verified_at,omitempty"`
	CompletedAt        *time.Time      `json:"completed_at,omitempty"`
	CreatedAt          time.Time       `json:"created_at"`
	UpdatedAt          time.Time       `json:"updated_at"`
	CompletionSummary  json.RawMessage `json:"completion_summary,omitempty"`
	ExportExpiresAt    *time.Time      `json:"export_expires_at,omitempty"`
	ErasureHoldReason  *string         `json:"erasure_hold_reason,omitempty"`
}

type ErasureReviewInput struct {
	RetentionReviewed   bool   `json:"retention_reviewed"`
	ExecutionAuthorised bool   `json:"execution_authorised"`
	HoldReason          string `json:"hold_reason,omitempty"`
	Notes               string `json:"notes,omitempty"`
}

type Subprocessor struct {
	ID                  string     `json:"id"`
	Name                string     `json:"name"`
	Purpose             string     `json:"purpose"`
	DataCategories      []string   `json:"data_categories"`
	ProcessingLocations []string   `json:"processing_locations"`
	TransferMechanism   *string    `json:"transfer_mechanism,omitempty"`
	PrivacyURL          *string    `json:"privacy_url,omitempty"`
	EffectiveFrom       time.Time  `json:"effective_from"`
	EffectiveTo         *time.Time `json:"effective_to,omitempty"`
}

type ProcessingActivity struct {
	ActivityKey         string   `json:"activity_key"`
	Name                string   `json:"name"`
	Purpose             string   `json:"purpose"`
	DataSubjects        []string `json:"data_subjects"`
	DataCategories      []string `json:"data_categories"`
	LawfulBasis         string   `json:"lawful_basis"`
	Recipients          []string `json:"recipients"`
	RetentionRule       string   `json:"retention_rule"`
	SecurityMeasures    []string `json:"security_measures"`
	CrossBorderTransfer bool     `json:"cross_border_transfer"`
	Owner               string   `json:"owner"`
}

type IncidentInput struct {
	Title                 string   `json:"title"`
	Severity              string   `json:"severity"`
	DetectedAt            time.Time `json:"detected_at"`
	AffectedDataCategories []string `json:"affected_data_categories"`
	AffectedSubjectCount  *int     `json:"affected_subject_count,omitempty"`
	Description           string   `json:"description"`
}
