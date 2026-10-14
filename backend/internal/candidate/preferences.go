package candidate

import (
	"context"
	"encoding/json"
	"errors"
	"github.com/jackc/pgx/v5"
)

var notificationCategories = map[string]bool{"applications": true, "interviews": true, "offers": true, "messages": true, "job_alerts": true}

type Preferences struct {
	Notifications    map[string]bool `json:"notifications"`
	ProductAnalytics bool            `json:"product_analytics"`
}
type PreferencesUpdate struct {
	Notifications    map[string]bool `json:"notifications,omitempty"`
	ProductAnalytics *bool           `json:"product_analytics,omitempty"`
}

func (s *Service) Preferences(ctx context.Context, userID string) (Preferences, error) {
	result := Preferences{Notifications: map[string]bool{}}
	var raw []byte
	err := s.db.QueryRow(ctx, `SELECT COALESCE(profile_details->'notification_preferences','{}'),EXISTS(SELECT 1 FROM privacy_consents WHERE user_id=$1 AND purpose='product_analytics' AND granted AND withdrawn_at IS NULL) FROM candidate_profiles WHERE user_id=$1`, userID).Scan(&raw, &result.ProductAnalytics)
	if errors.Is(err, pgx.ErrNoRows) {
		return result, ErrNotFound
	}
	if err != nil {
		return result, err
	}
	var saved map[string]bool
	_ = json.Unmarshal(raw, &saved)
	for category := range notificationCategories {
		value, exists := saved[category]
		result.Notifications[category] = !exists || value
	}
	return result, nil
}
func (s *Service) UpdatePreferences(ctx context.Context, userID string, input PreferencesUpdate) (Preferences, error) {
	for key := range input.Notifications {
		if !notificationCategories[key] {
			return Preferences{}, ErrWorkspaceInput
		}
	}
	tx, err := s.db.Begin(ctx)
	if err != nil {
		return Preferences{}, err
	}
	defer tx.Rollback(ctx)
	var id string
	if err = tx.QueryRow(ctx, `SELECT user_id FROM candidate_profiles WHERE user_id=$1 FOR UPDATE`, userID).Scan(&id); errors.Is(err, pgx.ErrNoRows) {
		return Preferences{}, ErrNotFound
	} else if err != nil {
		return Preferences{}, err
	}
	if input.Notifications != nil {
		raw, err := json.Marshal(input.Notifications)
		if err != nil {
			return Preferences{}, err
		}
		_, err = tx.Exec(ctx, `UPDATE candidate_profiles SET profile_details=jsonb_set(COALESCE(profile_details,'{}'),'{notification_preferences}',CASE WHEN jsonb_typeof(profile_details->'notification_preferences')='object' THEN profile_details->'notification_preferences' ELSE '{}'::jsonb END || $2::jsonb,true),updated_at=now() WHERE user_id=$1`, userID, raw)
		if err != nil {
			return Preferences{}, err
		}
	}
	if input.ProductAnalytics != nil {
		var current bool
		if err = tx.QueryRow(ctx, `SELECT EXISTS(SELECT 1 FROM privacy_consents WHERE user_id=$1 AND purpose='product_analytics' AND granted AND withdrawn_at IS NULL)`, userID).Scan(&current); err != nil {
			return Preferences{}, err
		}
		if !*input.ProductAnalytics {
			if _, err = tx.Exec(ctx, `DELETE FROM candidate_job_events WHERE candidate_id=$1`, userID); err != nil {
				return Preferences{}, err
			}
		}
		if current != *input.ProductAnalytics {
			if _, err = tx.Exec(ctx, `UPDATE privacy_consents SET withdrawn_at=now() WHERE user_id=$1 AND purpose='product_analytics' AND granted AND withdrawn_at IS NULL`, userID); err != nil {
				return Preferences{}, err
			}
			if _, err = tx.Exec(ctx, `INSERT INTO privacy_consents(user_id,purpose,policy_version,granted,source,metadata) VALUES($1,'product_analytics','candidate-product-analytics-v1',$2,'candidate_settings','{"scope":"first_party_job_conversion","third_party_tracking":false}')`, userID, *input.ProductAnalytics); err != nil {
				return Preferences{}, err
			}
		}
	}
	if err = tx.Commit(ctx); err != nil {
		return Preferences{}, err
	}
	return s.Preferences(ctx, userID)
}

// Muting changes the inbox view, not the underlying application/interview/message records.
// Unknown notification kinds retain their default visibility.
const notificationPreferenceCTE = `WITH notification_preference AS MATERIALIZED (SELECT COALESCE(profile_details->'notification_preferences','{}'::jsonb) AS preference FROM candidate_profiles WHERE user_id=$1) `
const visibleNotification = `COALESCE(notification_preference.preference->(CASE WHEN kind LIKE '%interview%' THEN 'interviews' WHEN kind LIKE '%offer%' THEN 'offers' WHEN kind LIKE '%message%' THEN 'messages' WHEN kind LIKE '%job_alert%' OR kind LIKE '%saved_search%' THEN 'job_alerts' ELSE 'applications' END),'true'::jsonb)<>'false'::jsonb`
