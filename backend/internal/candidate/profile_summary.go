package candidate

import (
	"context"
	"encoding/base64"
	"encoding/json"
	"errors"
	"fmt"
	"strconv"
	"strings"
	"time"

	"github.com/jackc/pgx/v5"
)

type ProfileSummary struct {
	FullName              string   `json:"full_name"`
	Headline              *string  `json:"headline,omitempty"`
	Email                 string   `json:"email"`
	EmailVerified         bool     `json:"email_verified"`
	PrimaryPhone          *string  `json:"primary_phone,omitempty"`
	SecondaryPhone        string   `json:"secondary_phone,omitempty"`
	CurrentLocation       string   `json:"current_location,omitempty"`
	PreferredLocations    []string `json:"preferred_locations"`
	TotalExperienceMonths int      `json:"total_experience_months"`
	ProfileCompletion     int      `json:"profile_completion"`
	PhotoDataURL          string   `json:"photo_data_url,omitempty"`
	ShareToken            string   `json:"share_token"`
	ProfileVisible        bool     `json:"profile_visible"`
}

func stringValue(m map[string]any, key string) string {
	v, _ := m[key].(string)
	return strings.TrimSpace(v)
}

func intValue(v any) int {
	switch value := v.(type) {
	case float64:
		return int(value)
	case int:
		return value
	case string:
		i, _ := strconv.Atoi(strings.TrimSpace(value))
		return i
	default:
		return 0
	}
}

func monthIndex(year, month int) int {
	if year < 1900 || month < 1 || month > 12 {
		return 0
	}
	return year*12 + month - 1
}

func experienceFromDetails(details map[string]any, now time.Time) int {
	raw, _ := details["employment"].([]any)
	total := 0
	for _, item := range raw {
		record, ok := item.(map[string]any)
		if !ok {
			continue
		}
		start := monthIndex(intValue(record["joining_year"]), intValue(record["joining_month"]))
		if start == 0 {
			continue
		}
		current := strings.EqualFold(strings.TrimSpace(fmt.Sprint(record["current_company"])), "yes")
		end := 0
		if current {
			end = monthIndex(now.Year(), int(now.Month()))
		} else {
			end = monthIndex(intValue(record["end_year"]), intValue(record["end_month"]))
		}
		if end >= start {
			total += end - start + 1
		}
	}
	return total
}

func (s *Service) Summary(ctx context.Context, userID string) (ProfileSummary, error) {
	var result ProfileSummary
	var headline, phone, city, state *string
	var emailVerified *time.Time
	var raw []byte
	var photo []byte
	var photoMime *string
	var visible bool
	err := s.db.QueryRow(ctx, `SELECT cp.full_name,cp.headline,u.email,u.email_verified_at,u.phone_e164,cp.current_city,cp.current_state,cp.profile_completion,cp.profile_details,cp.profile_photo,cp.profile_photo_mime,cp.profile_share_token::text,COALESCE((cp.profile_details->>'profile_visible_in_sourcing')::boolean,false) FROM candidate_profiles cp JOIN users u ON u.id=cp.user_id WHERE cp.user_id=$1`, userID).Scan(
		&result.FullName, &headline, &result.Email, &emailVerified, &phone, &city, &state, &result.ProfileCompletion, &raw, &photo, &photoMime, &result.ShareToken, &visible,
	)
	if errors.Is(err, pgx.ErrNoRows) {
		return ProfileSummary{}, ErrNotFound
	}
	if err != nil {
		return ProfileSummary{}, err
	}
	result.Headline = headline
	result.PrimaryPhone = phone
	result.EmailVerified = emailVerified != nil
	result.ProfileVisible = visible
	result.CurrentLocation = strings.Join(nonEmpty(pointerValue(city), pointerValue(state)), ", ")
	var details map[string]any
	if len(raw) > 0 {
		_ = json.Unmarshal(raw, &details)
	}
	if details == nil {
		details = map[string]any{}
	}
	result.SecondaryPhone = stringValue(details, "secondary_phone")
	if preferred := stringValue(details, "preferred_locations"); preferred != "" {
		for _, item := range strings.Split(preferred, ",") {
			if item = strings.TrimSpace(item); item != "" {
				result.PreferredLocations = append(result.PreferredLocations, item)
			}
		}
	}
	result.TotalExperienceMonths = experienceFromDetails(details, time.Now())
	if _, err := s.db.Exec(ctx, `UPDATE candidate_profiles SET total_experience_months=$2 WHERE user_id=$1 AND total_experience_months<>$2`, userID, result.TotalExperienceMonths); err != nil {
		return ProfileSummary{}, err
	}
	if len(photo) > 0 && photoMime != nil {
		result.PhotoDataURL = "data:" + *photoMime + ";base64," + base64.StdEncoding.EncodeToString(photo)
	}
	return result, nil
}

func pointerValue(v *string) string {
	if v == nil {
		return ""
	}
	return strings.TrimSpace(*v)
}

func nonEmpty(values ...string) []string {
	out := make([]string, 0, len(values))
	for _, value := range values {
		if value = strings.TrimSpace(value); value != "" {
			out = append(out, value)
		}
	}
	return out
}

func (s *Service) UpdatePhoto(ctx context.Context, userID, mime string, data []byte) error {
	if mime != "image/jpeg" && mime != "image/png" && mime != "image/webp" {
		return errors.New("unsupported profile photo type")
	}
	if len(data) == 0 || len(data) > 2*1024*1024 {
		return errors.New("profile photo must be between 1 byte and 2 MB")
	}
	_, err := s.db.Exec(ctx, `UPDATE candidate_profiles SET profile_photo=$2,profile_photo_mime=$3,profile_photo_updated_at=now() WHERE user_id=$1`, userID, data, mime)
	return err
}
