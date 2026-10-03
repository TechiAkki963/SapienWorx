package recruiter

import (
	"context"
	"encoding/json"
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

func intFilter(filters map[string]any, key string) int {
	raw := stringFilter(filters, key)
	if raw == "" {
		return 0
	}
	value, err := stdstrconv.Atoi(raw)
	if err != nil {
		return 0
	}
	return value
}

func savedSearchDiscoveryFilters(filters map[string]any, since time.Time) DiscoveryFilters {
	return DiscoveryFilters{
		Query:             stringFilter(filters, "q"),
		Designation:       stringFilter(filters, "designation"),
		CurrentCompany:    stringFilter(filters, "current_company"),
		PreviousCompany:   stringFilter(filters, "previous_company"),
		Education:         stringFilter(filters, "education"),
		Skills:            stringFilter(filters, "skills"),
		Location:          stringFilter(filters, "location"),
		PreferredLocation: stringFilter(filters, "preferred_location"),
		EmploymentType:    stringFilter(filters, "employment_type"),
		WorkMode:          stringFilter(filters, "work_mode"),
		Industry:          stringFilter(filters, "industry"),
		FunctionalArea:    stringFilter(filters, "functional_area"),
		Languages:         stringFilter(filters, "languages"),
		Certifications:    stringFilter(filters, "certifications"),
		Availability:      stringFilter(filters, "availability"),
		Gender:            stringFilter(filters, "gender"),
		Disability:        stringFilter(filters, "disability"),
		DefenceBackground: stringFilter(filters, "defence_background"),
		Sort:              stringFilter(filters, "sort"),
		MinExperience:     intFilter(filters, "min_experience"),
		MaxExperience:     intFilter(filters, "max_experience"),
		MaxNoticeDays:     intFilter(filters, "max_notice_days"),
		HasMaxNotice:      stringFilter(filters, "max_notice_days") != "",
		UpdatedSince:      since.UTC().Format("2006-01-02"),
		Page:              1,
	}
}

func savedSearchURL(filters map[string]any) string {
	query := url.Values{}
	for _, key := range []string{
		"q", "designation", "current_company", "previous_company", "min_experience", "max_experience",
		"location", "preferred_location", "max_notice_days", "skills", "education", "employment_type",
		"work_mode", "industry", "functional_area", "languages", "certifications", "availability",
		"gender", "disability", "defence_background", "sort",
	} {
		if value := stringFilter(filters, key); value != "" {
			query.Set(key, value)
		}
	}
	if encoded := query.Encode(); encoded != "" {
		return "/recruiter/discover?" + encoded
	}
	return "/recruiter/discover"
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
	for _, item := range items {
		since := item.UpdatedAt
		if item.LastAlertedAt != nil {
			since = *item.LastAlertedAt
		}
		result, discoverErr := s.Discover(ctx, item.RecruiterID, savedSearchDiscoveryFilters(item.Filters, since))
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
		link := savedSearchURL(item.Filters)
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
	return queued, nil
}
