package recruiter

import (
	"context"
	"encoding/json"
	"strings"
	"time"
)

type SavedSearch struct {
	ID             string         `json:"id"`
	Name           string         `json:"name"`
	Filters        map[string]any `json:"filters"`
	AlertEnabled   bool           `json:"alert_enabled"`
	AlertFrequency string         `json:"alert_frequency"`
	LastAlertedAt  *time.Time     `json:"last_alerted_at,omitempty"`
	UpdatedAt      time.Time      `json:"updated_at"`
}

type RecentSearch struct {
	ID        int64          `json:"id"`
	Filters   map[string]any `json:"filters"`
	CreatedAt time.Time      `json:"created_at"`
}

func (s *Service) SaveSearch(ctx context.Context, recruiterID, name string, filters map[string]any) (SavedSearch, error) {
	if _, _, _, err := s.recruiterCompany(ctx, recruiterID); err != nil {
		return SavedSearch{}, err
	}
	name = strings.TrimSpace(name)
	if name == "" || len(name) > 120 || len(filters) > 30 {
		return SavedSearch{}, ErrInvalid
	}
	raw, err := json.Marshal(filters)
	if err != nil || len(raw) > 8192 {
		return SavedSearch{}, ErrInvalid
	}
	var item SavedSearch
	var stored []byte
	err = s.db.QueryRow(ctx, `INSERT INTO recruiter_saved_searches(recruiter_id,name,filters) VALUES($1,$2,$3::jsonb) RETURNING id,name,filters,alert_enabled,alert_frequency,last_alerted_at,updated_at`, recruiterID, name, string(raw)).Scan(&item.ID, &item.Name, &stored, &item.AlertEnabled, &item.AlertFrequency, &item.LastAlertedAt, &item.UpdatedAt)
	if err == nil {
		err = json.Unmarshal(stored, &item.Filters)
	}
	return item, err
}

func (s *Service) SavedSearches(ctx context.Context, recruiterID string) ([]SavedSearch, error) {
	if _, _, _, err := s.recruiterCompany(ctx, recruiterID); err != nil {
		return nil, err
	}
	rows, err := s.db.Query(ctx, `SELECT id,name,filters,alert_enabled,alert_frequency,last_alerted_at,updated_at FROM recruiter_saved_searches WHERE recruiter_id=$1 ORDER BY updated_at DESC LIMIT 20`, recruiterID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	items := []SavedSearch{}
	for rows.Next() {
		var x SavedSearch
		var raw []byte
		if err := rows.Scan(&x.ID, &x.Name, &raw, &x.AlertEnabled, &x.AlertFrequency, &x.LastAlertedAt, &x.UpdatedAt); err != nil {
			return nil, err
		}
		if err := json.Unmarshal(raw, &x.Filters); err != nil {
			return nil, err
		}
		items = append(items, x)
	}
	return items, rows.Err()
}

func (s *Service) RecordSearch(ctx context.Context, recruiterID string, filters map[string]any) error {
	if _, _, _, err := s.recruiterCompany(ctx, recruiterID); err != nil {
		return err
	}
	if len(filters) > 30 {
		return ErrInvalid
	}
	raw, err := json.Marshal(filters)
	if err != nil || len(raw) > 8192 {
		return ErrInvalid
	}
	_, err = s.db.Exec(ctx, `INSERT INTO recruiter_search_activity(recruiter_id,filters) VALUES($1,$2::jsonb)
		ON CONFLICT (recruiter_id,filters) DO UPDATE SET created_at=now()`, recruiterID, string(raw))
	return err
}

func (s *Service) RecentSearches(ctx context.Context, recruiterID string) ([]RecentSearch, error) {
	if _, _, _, err := s.recruiterCompany(ctx, recruiterID); err != nil {
		return nil, err
	}
	rows, err := s.db.Query(ctx, `SELECT id,filters,created_at FROM recruiter_search_activity WHERE recruiter_id=$1 ORDER BY created_at DESC LIMIT 8`, recruiterID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	items := []RecentSearch{}
	for rows.Next() {
		var x RecentSearch
		var raw []byte
		if err := rows.Scan(&x.ID, &raw, &x.CreatedAt); err != nil {
			return nil, err
		}
		if err := json.Unmarshal(raw, &x.Filters); err != nil {
			return nil, err
		}
		items = append(items, x)
	}
	return items, rows.Err()
}

func (s *Service) UpdateSavedSearchAlert(ctx context.Context, recruiterID, searchID string, enabled bool, frequency string) (SavedSearch, error) {
	if _, _, _, err := s.recruiterCompany(ctx, recruiterID); err != nil {
		return SavedSearch{}, err
	}
	frequency = strings.TrimSpace(frequency)
	if !validEnum(frequency, "daily", "weekly") {
		return SavedSearch{}, ErrInvalid
	}
	var item SavedSearch
	var raw []byte
	err := s.db.QueryRow(ctx, `UPDATE recruiter_saved_searches SET alert_enabled=$3,alert_frequency=$4,updated_at=now() WHERE id=$1 AND recruiter_id=$2 RETURNING id,name,filters,alert_enabled,alert_frequency,last_alerted_at,updated_at`, searchID, recruiterID, enabled, frequency).Scan(&item.ID, &item.Name, &raw, &item.AlertEnabled, &item.AlertFrequency, &item.LastAlertedAt, &item.UpdatedAt)
	if err != nil {
		return SavedSearch{}, err
	}
	if err = json.Unmarshal(raw, &item.Filters); err != nil {
		return SavedSearch{}, err
	}
	return item, nil
}
