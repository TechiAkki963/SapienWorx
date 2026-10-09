package recruiter

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"github.com/TechiAkki963/SapienWorx/backend/internal/company"
	"strings"
	"time"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgtype"
)

// Stored searches share the interactive validator. Legacy JSON numbers remain
// readable, but nested objects and private/unknown keys are never persisted.
func canonicalSearchFilters(filters map[string]any) (map[string]any, error) {
	if len(filters) > 64 {
		return nil, ErrInvalid
	}
	values := map[string]string{}
	for key, value := range filters {
		switch value.(type) {
		case string, float64, json.Number, int, bool:
			values[key] = strings.TrimSpace(fmt.Sprint(value))
		default:
			return nil, ErrInvalid
		}
	}
	f, err := ParseDiscoveryFilters(values)
	if err != nil {
		return nil, err
	}
	clean := map[string]any{}
	for key, value := range f.Criteria {
		if key != "page" && key != "page_size" {
			clean[key] = value
		}
	}
	return clean, nil
}

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
	companyID, _, _, err := s.recruiterCompany(ctx, recruiterID)
	if err != nil {
		return SavedSearch{}, err
	}
	name = strings.TrimSpace(name)
	if name == "" || len(name) > 120 {
		return SavedSearch{}, ErrInvalid
	}
	filters, err = canonicalSearchFilters(filters)
	if err != nil {
		return SavedSearch{}, err
	}
	if client, _ := filters["client_company_id"].(string); client != "" && client != companyID {
		return SavedSearch{}, ErrNotFound
	}
	raw, err := json.Marshal(filters)
	if err != nil || len(raw) > 32768 {
		return SavedSearch{}, ErrInvalid
	}
	tx, err := s.db.Begin(ctx)
	if err != nil {
		return SavedSearch{}, err
	}
	defer tx.Rollback(ctx)
	if err = company.RequireFeatureTx(ctx, tx, recruiterID, "talent.alerts"); err != nil {
		return SavedSearch{}, err
	}
	if err = company.CheckCapacityTx(ctx, tx, companyID, "saved_searches", 1); err != nil {
		return SavedSearch{}, err
	}
	var item SavedSearch
	var stored []byte
	err = tx.QueryRow(ctx, `INSERT INTO recruiter_saved_searches(recruiter_id,name,filters) VALUES($1,$2,$3::jsonb) RETURNING id,name,filters,alert_enabled,alert_frequency,last_alerted_at,updated_at`, recruiterID, name, string(raw)).Scan(&item.ID, &item.Name, &stored, &item.AlertEnabled, &item.AlertFrequency, &item.LastAlertedAt, &item.UpdatedAt)
	if err == nil {
		err = json.Unmarshal(stored, &item.Filters)
	}
	if err == nil {
		err = tx.Commit(ctx)
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
	filters, err := canonicalSearchFilters(filters)
	if err != nil {
		return err
	}
	raw, err := json.Marshal(filters)
	if err != nil || len(raw) > 32768 {
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
	return s.UpdateSavedSearch(ctx, recruiterID, searchID, SavedSearchUpdate{Enabled: &enabled, Frequency: &frequency})
}

type SavedSearchUpdate struct {
	Name      *string        `json:"name"`
	Filters   map[string]any `json:"filters"`
	Enabled   *bool          `json:"enabled"`
	Frequency *string        `json:"frequency"`
}

func (s *Service) UpdateSavedSearch(ctx context.Context, recruiterID, searchID string, input SavedSearchUpdate) (SavedSearch, error) {
	companyID, _, _, err := s.recruiterCompany(ctx, recruiterID)
	if err != nil {
		return SavedSearch{}, err
	}
	if !validSavedSearchID(searchID) {
		return SavedSearch{}, ErrNotFound
	}
	if input.Name == nil && input.Filters == nil && input.Enabled == nil && input.Frequency == nil {
		return SavedSearch{}, ErrInvalid
	}
	if input.Name != nil {
		name := strings.TrimSpace(*input.Name)
		if name == "" || len(name) > 120 {
			return SavedSearch{}, ErrInvalid
		}
		input.Name = &name
	}
	if input.Frequency != nil && !validEnum(*input.Frequency, "daily", "weekly") {
		return SavedSearch{}, ErrInvalid
	}
	var filtersJSON *string
	if input.Filters != nil {
		filters, err := canonicalSearchFilters(input.Filters)
		if err != nil {
			return SavedSearch{}, err
		}
		if client, _ := filters["client_company_id"].(string); client != "" && client != companyID {
			return SavedSearch{}, ErrNotFound
		}
		raw, err := json.Marshal(filters)
		if err != nil || len(raw) > 32768 {
			return SavedSearch{}, ErrInvalid
		}
		value := string(raw)
		filtersJSON = &value
	}
	var item SavedSearch
	var raw []byte
	err = s.db.QueryRow(ctx, `UPDATE recruiter_saved_searches SET name=COALESCE($3,name),filters=COALESCE($4::jsonb,filters),alert_enabled=COALESCE($5,alert_enabled),alert_frequency=COALESCE($6,alert_frequency),updated_at=now() WHERE id=$1 AND recruiter_id=$2 RETURNING id,name,filters,alert_enabled,alert_frequency,last_alerted_at,updated_at`, searchID, recruiterID, input.Name, filtersJSON, input.Enabled, input.Frequency).Scan(&item.ID, &item.Name, &raw, &item.AlertEnabled, &item.AlertFrequency, &item.LastAlertedAt, &item.UpdatedAt)
	if errors.Is(err, pgx.ErrNoRows) {
		return SavedSearch{}, ErrNotFound
	}
	if err != nil {
		return SavedSearch{}, err
	}
	if err = json.Unmarshal(raw, &item.Filters); err != nil {
		return SavedSearch{}, err
	}
	return item, nil
}

func (s *Service) DeleteSavedSearch(ctx context.Context, recruiterID, searchID string) error {
	if _, _, _, err := s.recruiterCompany(ctx, recruiterID); err != nil {
		return err
	}
	if !validSavedSearchID(searchID) {
		return ErrNotFound
	}
	result, err := s.db.Exec(ctx, `DELETE FROM recruiter_saved_searches WHERE id=$1 AND recruiter_id=$2`, searchID, recruiterID)
	if err != nil {
		return err
	}
	if result.RowsAffected() != 1 {
		return ErrNotFound
	}
	return nil
}

func validSavedSearchID(id string) bool {
	var uuid pgtype.UUID
	return uuid.Scan(id) == nil && uuid.Valid
}

// SavedSearchByID resolves an owned search independently of the bounded recent list.
func (s *Service) SavedSearchByID(ctx context.Context, recruiterID, searchID string) (SavedSearch, error) {
	if _, _, _, err := s.recruiterCompany(ctx, recruiterID); err != nil {
		return SavedSearch{}, err
	}
	if !validSavedSearchID(searchID) {
		return SavedSearch{}, ErrNotFound
	}
	var item SavedSearch
	var raw []byte
	err := s.db.QueryRow(ctx, `SELECT id,name,filters,alert_enabled,alert_frequency,last_alerted_at,updated_at FROM recruiter_saved_searches WHERE id=$1 AND recruiter_id=$2`, searchID, recruiterID).Scan(&item.ID, &item.Name, &raw, &item.AlertEnabled, &item.AlertFrequency, &item.LastAlertedAt, &item.UpdatedAt)
	if errors.Is(err, pgx.ErrNoRows) {
		return SavedSearch{}, ErrNotFound
	}
	if err != nil {
		return SavedSearch{}, err
	}
	if err = json.Unmarshal(raw, &item.Filters); err != nil {
		return SavedSearch{}, err
	}
	return item, nil
}

// nullableID keeps empty optional UUID filters out of PostgreSQL casts.
func nullableID(value string) any {
	if value == "" {
		return nil
	}
	return value
}

type SavedSearchMatchCounts struct {
	Current      int       `json:"current"`
	UpdatedSince int       `json:"updated_since"`
	Since        time.Time `json:"since"`
	CheckedAt    time.Time `json:"checked_at"`
}

// Match counts do not emit profile appearances: counting does not display a profile.
func (s *Service) SavedSearchMatchCounts(ctx context.Context, recruiterID, searchID string) (SavedSearchMatchCounts, error) {
	saved, err := s.SavedSearchByID(ctx, recruiterID, searchID)
	if err != nil {
		return SavedSearchMatchCounts{}, err
	}
	filters, err := canonicalSearchFilters(saved.Filters)
	if err != nil {
		return SavedSearchMatchCounts{}, err
	}
	values := map[string]string{}
	for key, value := range filters {
		values[key] = fmt.Sprint(value)
	}
	parsed, err := ParseDiscoveryFilters(values)
	if err != nil {
		return SavedSearchMatchCounts{}, err
	}
	parsed.Page = 1
	parsed.PageSize = 1
	current, err := s.discover(ctx, recruiterID, parsed, false)
	if err != nil {
		return SavedSearchMatchCounts{}, err
	}
	since := saved.UpdatedAt
	if saved.LastAlertedAt != nil {
		since = *saved.LastAlertedAt
	}
	updatedFilters, err := savedSearchDiscoveryFilters(saved.Filters, since)
	if err != nil {
		return SavedSearchMatchCounts{}, err
	}
	updatedFilters.Page = 1
	updatedFilters.PageSize = 1
	since, err = time.Parse(time.RFC3339Nano, updatedFilters.UpdatedSince)
	if err != nil {
		return SavedSearchMatchCounts{}, err
	}
	updated, err := s.discover(ctx, recruiterID, updatedFilters, false)
	if err != nil {
		return SavedSearchMatchCounts{}, err
	}
	return SavedSearchMatchCounts{Current: current.Total, UpdatedSince: updated.Total, Since: since, CheckedAt: time.Now().UTC()}, nil
}
