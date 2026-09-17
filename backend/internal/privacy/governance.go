package privacy

import (
	"context"
	"time"
)

type Subprocessor struct {
	ID                  string    `json:"id"`
	Name                string    `json:"name"`
	Purpose             string    `json:"purpose"`
	DataCategories      mapSlice  `json:"data_categories"`
	ProcessingLocations mapSlice  `json:"processing_locations"`
	WebsiteURL          *string   `json:"website_url,omitempty"`
	DPAURL              *string   `json:"dpa_url,omitempty"`
	EffectiveFrom       time.Time `json:"effective_from"`
}

type mapSlice []string

func (s *Service) PublicSubprocessors(ctx context.Context) ([]Subprocessor, error) {
	rows, err := s.db.Query(ctx, `SELECT id,name,purpose,data_categories,processing_locations,website_url,dpa_url,effective_from FROM privacy_subprocessors WHERE active=true AND effective_from<=current_date AND (effective_to IS NULL OR effective_to>=current_date) ORDER BY lower(name)`)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	items := make([]Subprocessor, 0)
	for rows.Next() {
		var item Subprocessor
		if err := rows.Scan(&item.ID, &item.Name, &item.Purpose, &item.DataCategories, &item.ProcessingLocations, &item.WebsiteURL, &item.DPAURL, &item.EffectiveFrom); err != nil {
			return nil, err
		}
		items = append(items, item)
	}
	return items, rows.Err()
}

type AdminPrivacyRequest struct {
	ID          string     `json:"id"`
	UserID      string     `json:"user_id"`
	RequestType string     `json:"request_type"`
	Status      string     `json:"status"`
	DueAt       time.Time  `json:"due_at"`
	CompletedAt *time.Time `json:"completed_at,omitempty"`
	CreatedAt   time.Time  `json:"created_at"`
}

func (s *Service) AdminRequests(ctx context.Context) ([]AdminPrivacyRequest, error) {
	rows, err := s.db.Query(ctx, `SELECT id,user_id,request_type,status,due_at,completed_at,created_at FROM privacy_requests ORDER BY CASE WHEN status IN ('received','in_progress','awaiting_review') THEN 0 ELSE 1 END,due_at ASC,created_at DESC LIMIT 250`)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	items := make([]AdminPrivacyRequest, 0)
	for rows.Next() {
		var item AdminPrivacyRequest
		if err := rows.Scan(&item.ID, &item.UserID, &item.RequestType, &item.Status, &item.DueAt, &item.CompletedAt, &item.CreatedAt); err != nil {
			return nil, err
		}
		items = append(items, item)
	}
	return items, rows.Err()
}

type PrivacyIncident struct {
	ID                       string     `json:"id"`
	Title                    string     `json:"title"`
	Severity                 string     `json:"severity"`
	Status                   string     `json:"status"`
	DiscoveredAt             time.Time  `json:"discovered_at"`
	ContainedAt              *time.Time `json:"contained_at,omitempty"`
	AffectedSubjectsEstimate *int       `json:"affected_subjects_estimate,omitempty"`
	NotificationRequired     *bool      `json:"notification_required,omitempty"`
	NotificationDeadline     *time.Time `json:"notification_deadline,omitempty"`
}

func (s *Service) Incidents(ctx context.Context) ([]PrivacyIncident, error) {
	rows, err := s.db.Query(ctx, `SELECT id,title,severity,status,discovered_at,contained_at,affected_subjects_estimate,notification_required,notification_deadline FROM privacy_incidents ORDER BY CASE severity WHEN 'critical' THEN 0 WHEN 'high' THEN 1 WHEN 'medium' THEN 2 ELSE 3 END,discovered_at DESC LIMIT 250`)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	items := make([]PrivacyIncident, 0)
	for rows.Next() {
		var item PrivacyIncident
		if err := rows.Scan(&item.ID, &item.Title, &item.Severity, &item.Status, &item.DiscoveredAt, &item.ContainedAt, &item.AffectedSubjectsEstimate, &item.NotificationRequired, &item.NotificationDeadline); err != nil {
			return nil, err
		}
		items = append(items, item)
	}
	return items, rows.Err()
}

type ProcessingActivity struct {
	ID              string     `json:"id"`
	ActivityName    string     `json:"activity_name"`
	Purpose         string     `json:"purpose"`
	LawfulBasis     string     `json:"lawful_basis"`
	RetentionPolicy string     `json:"retention_policy"`
	Owner           string     `json:"owner"`
	ReviewedAt      *time.Time `json:"reviewed_at,omitempty"`
	UpdatedAt       time.Time  `json:"updated_at"`
}

func (s *Service) ProcessingActivities(ctx context.Context) ([]ProcessingActivity, error) {
	rows, err := s.db.Query(ctx, `SELECT id,activity_name,purpose,lawful_basis,retention_policy,owner,reviewed_at,updated_at FROM privacy_processing_activities WHERE active=true ORDER BY activity_name`)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	items := make([]ProcessingActivity, 0)
	for rows.Next() {
		var item ProcessingActivity
		if err := rows.Scan(&item.ID, &item.ActivityName, &item.Purpose, &item.LawfulBasis, &item.RetentionPolicy, &item.Owner, &item.ReviewedAt, &item.UpdatedAt); err != nil {
			return nil, err
		}
		items = append(items, item)
	}
	return items, rows.Err()
}
