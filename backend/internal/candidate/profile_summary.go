package candidate

import (
	"context"
	"encoding/base64"
	"encoding/json"
	"errors"
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
	PhoneVerified         bool     `json:"phone_verified"`
	ShareToken            string   `json:"share_token"`
	ProfileVisible        bool     `json:"profile_visible"`
	Discoverable          bool     `json:"discoverable_to_recruiters"`
}

func stringValue(m map[string]any, key string) string {
	v, _ := m[key].(string)
	return strings.TrimSpace(v)
}

func (s *Service) Summary(ctx context.Context, userID string) (ProfileSummary, error) {
	result := ProfileSummary{PreferredLocations: []string{}}
	var headline, phone, city, state *string
	var emailVerified *time.Time
	var raw []byte
	var photo []byte
	var photoMime *string
	var visible, discoverable bool
	err := s.db.QueryRow(ctx, `SELECT cp.full_name,cp.headline,u.email,u.email_verified_at,u.phone_e164,cp.current_city,cp.current_state,cp.total_experience_months,cp.profile_completion,cp.profile_details,cp.profile_photo,cp.profile_photo_mime,cp.profile_share_token::text,COALESCE(cp.profile_details->>'profile_visible_in_sourcing'='true',false),COALESCE(cp.profile_details->>'discoverable_to_recruiters'='true',false),u.phone_verified_at IS NOT NULL FROM candidate_profiles cp JOIN users u ON u.id=cp.user_id WHERE cp.user_id=$1`, userID).Scan(
		&result.FullName, &headline, &result.Email, &emailVerified, &phone, &city, &state, &result.TotalExperienceMonths, &result.ProfileCompletion, &raw, &photo, &photoMime, &result.ShareToken, &visible, &discoverable, &result.PhoneVerified,
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
	result.Discoverable = discoverable
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
	if len(photo) > 0 && photoMime != nil {
		result.PhotoDataURL = "data:" + *photoMime + ";base64," + base64.StdEncoding.EncodeToString(photo)
	} else {
		// Preserve a previously uploaded account/S3 image until the candidate replaces it.
		if err := s.db.QueryRow(ctx, `SELECT COALESCE(profile_image_url,'') FROM users WHERE id=$1`, userID).Scan(&result.PhotoDataURL); err != nil {
			return ProfileSummary{}, err
		}
	}
	return result, nil
}

// SetDiscoverable is a separate opt-in from the shareable-link setting. Update only
// this JSON key so an in-flight profile edit cannot overwrite unrelated details.
func (s *Service) SetDiscoverable(ctx context.Context, userID string, enabled bool) error {
	tx, err := s.db.Begin(ctx)
	if err != nil {
		return err
	}
	defer tx.Rollback(ctx)

	command, err := tx.Exec(ctx, `UPDATE candidate_profiles SET profile_details=jsonb_set(COALESCE(profile_details,'{}'::jsonb),'{discoverable_to_recruiters}',to_jsonb($2::boolean),true),updated_at=now() WHERE user_id=$1`, userID, enabled)
	if err != nil {
		return err
	}
	if command.RowsAffected() == 0 {
		return ErrNotFound
	}
	if _, err = tx.Exec(ctx, `UPDATE privacy_consents SET withdrawn_at=COALESCE(withdrawn_at,now()) WHERE user_id=$1 AND purpose='recruiter_search_discovery' AND granted=true AND withdrawn_at IS NULL`, userID); err != nil {
		return err
	}
	if _, err = tx.Exec(ctx, `INSERT INTO privacy_consents(user_id,purpose,policy_version,granted,source,metadata) VALUES($1,'recruiter_search_discovery','privacy-v3-2026-09-17',$2,'candidate_privacy_control',jsonb_build_object('action',CASE WHEN $2 THEN 'opt_in' ELSE 'opt_out' END,'scope','recruiter_search_and_sourcing'))`, userID, enabled); err != nil {
		return err
	}
	return tx.Commit(ctx)
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
	if err := ValidateProfilePhoto(mime, data); err != nil {
		return err
	}
	return s.writePhoto(ctx, userID, mime, data)
}
