package recruiter

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"html"
	"net/url"
	stdstrconv "strconv"
	"strings"
	"time"
)

type savedSearchAlertCandidate struct {
	ID             string
	RecruiterID    string
	RecruiterEmail string
	Name           string
	Filters        map[string]any
	Frequency      string
	LastAlertedAt  *time.Time
	UpdatedAt      time.Time
}

func stringFilter(filters map[string]any, key string) string {
	value, ok := filters[key]
	if !ok || value == nil {
		return ""
	}
	switch typed := value.(type) {
	case string:
		return strings.TrimSpace(typed)
	case json.Number:
		return typed.String()
	case float64:
		return stdstrconv.FormatFloat(typed, 'f', -1, 64)
	default:
		return ""
	}
}

func savedSearchDiscoveryFilters(filters map[string]any, since time.Time) (DiscoveryFilters, error) {
	clean, err := canonicalSearchFilters(filters)
	if err != nil {
		return DiscoveryFilters{}, err
	}
	values := map[string]string{}
	for key := range clean {
		values[key] = stringFilter(clean, key)
	}
	// Never widen an explicitly later date when applying the alert window.
	if raw := values["updated_since"]; raw != "" {
		existing, err := time.Parse(time.RFC3339Nano, raw)
		if err != nil {
			existing, err = time.Parse("2006-01-02", raw)
		}
		if err != nil {
			return DiscoveryFilters{}, ErrInvalid
		}
		if existing.After(since) {
			since = existing
		}
	}
	values["updated_since"] = since.UTC().Format(time.RFC3339Nano)
	values["page"] = "1"
	return ParseDiscoveryFilters(values)
}

func savedSearchURL(searchID string) string {
	return "/recruiter/discover?search_id=" + url.QueryEscape(searchID)
}

func (s *Service) dueSavedSearchAlerts(ctx context.Context, limit int) ([]savedSearchAlertCandidate, error) {
	if limit < 1 || limit > 100 {
		limit = 20
	}
	rows, err := s.db.Query(ctx, `
		SELECT rss.id,rss.recruiter_id,u.email,rss.name,rss.filters,rss.alert_frequency,rss.last_alerted_at,rss.updated_at
		FROM recruiter_saved_searches rss
		JOIN users u ON u.id=rss.recruiter_id
		JOIN recruiter_profiles rp ON rp.user_id=rss.recruiter_id
		WHERE rss.alert_enabled=true
		  AND u.status='active' AND u.is_active=true
		  AND rp.verification_status='verified'
		  AND (
		    rss.last_alerted_at IS NULL
		    OR (rss.alert_frequency='daily' AND rss.last_alerted_at<=now()-interval '24 hours')
		    OR (rss.alert_frequency='weekly' AND rss.last_alerted_at<=now()-interval '7 days')
		  )
		ORDER BY COALESCE(rss.last_alerted_at,rss.updated_at) ASC,rss.id
		LIMIT $1
	`, limit)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	items := make([]savedSearchAlertCandidate, 0)
	for rows.Next() {
		var item savedSearchAlertCandidate
		var raw []byte
		if err := rows.Scan(&item.ID, &item.RecruiterID, &item.RecruiterEmail, &item.Name, &raw, &item.Frequency, &item.LastAlertedAt, &item.UpdatedAt); err != nil {
			return nil, err
		}
		if err := json.Unmarshal(raw, &item.Filters); err != nil {
			return nil, err
		}
		items = append(items, item)
	}
	return items, rows.Err()
}

// ProcessSavedSearchAlerts evaluates due recruiter searches using the same
// consent-aware Discovery contract as the interactive sourcing workspace.
// Matching alerts are queued into the durable P2.4 email outbox.
func (s *Service) ProcessSavedSearchAlerts(ctx context.Context, limit int) (int, error) {
	items, err := s.dueSavedSearchAlerts(ctx, limit)
	if err != nil {
		return 0, err
	}
	queued := 0
	var invalidSearches error
	for _, item := range items {
		since := item.UpdatedAt
		if item.LastAlertedAt != nil {
			since = *item.LastAlertedAt
		}
		filters, filterErr := savedSearchDiscoveryFilters(item.Filters, since)
		if filterErr != nil {
			// Invalid legacy criteria must never widen a search or stop valid alerts.
			invalidSearches = errors.Join(invalidSearches, fmt.Errorf("saved search %s rejected: %w", item.ID, filterErr))
			continue
		}
		result, discoverErr := s.Discover(ctx, item.RecruiterID, filters)
		if discoverErr != nil {
			return queued, discoverErr
		}
		now := time.Now().UTC()
		if result.Total == 0 {
			if _, err := s.db.Exec(ctx, `UPDATE recruiter_saved_searches SET last_alerted_at=$2 WHERE id=$1 AND recruiter_id=$3`, item.ID, now, item.RecruiterID); err != nil {
				return queued, err
			}
			continue
		}

		safeName := strings.NewReplacer("\r", " ", "\n", " ").Replace(item.Name)
		subject := fmt.Sprintf("%d new candidate matches · %s", result.Total, safeName)
		link := savedSearchURL(item.ID)
		body := fmt.Sprintf("Your saved SapienWorx search %q has %d candidate profiles updated since the previous alert. Open %s to review the latest consented recruiter-search matches.", safeName, result.Total, link)
		htmlBody := fmt.Sprintf("<p>Your saved SapienWorx search <strong>%s</strong> has <strong>%d</strong> candidate profiles updated since the previous alert.</p><p>Open <code>%s</code> in SapienWorx to review the latest consented recruiter-search matches.</p>", html.EscapeString(safeName), result.Total, html.EscapeString(link))
		window := now.Format("2006-01-02")
		if item.Frequency == "weekly" {
			year, week := now.ISOWeek()
			window = fmt.Sprintf("%04d-W%02d", year, week)
		}
		tx, err := s.db.Begin(ctx)
		if err != nil {
			return queued, err
		}
		_, err = tx.Exec(ctx, `
			INSERT INTO email_outbox(kind,recipient_email,subject,text_body,html_body,dedupe_key)
			VALUES('saved_search_alert',lower($1),$2,$3,$4,$5)
			ON CONFLICT (dedupe_key) WHERE dedupe_key IS NOT NULL DO NOTHING
		`, item.RecruiterEmail, subject, body, htmlBody, "saved-search-alert:"+item.ID+":"+window)
		if err == nil {
			_, err = tx.Exec(ctx, `UPDATE recruiter_saved_searches SET last_alerted_at=$2 WHERE id=$1 AND recruiter_id=$3`, item.ID, now, item.RecruiterID)
		}
		if err != nil {
			_ = tx.Rollback(ctx)
			return queued, err
		}
		if err := tx.Commit(ctx); err != nil {
			return queued, err
		}
		queued++
	}
	return queued, invalidSearches
}
