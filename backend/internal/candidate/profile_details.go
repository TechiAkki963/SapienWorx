package candidate

import (
	"context"
	"encoding/json"
	"errors"
	"regexp"
	"strings"
	"time"

	"github.com/jackc/pgx/v5"
)

type ProfileDetails struct {
	Details                map[string]any `json:"details"`
	CurrentSalaryAmount    *float64       `json:"current_salary_amount,omitempty"`
	CurrentSalaryCurrency  string         `json:"current_salary_currency"`
	ExpectedSalaryAmount   *float64       `json:"expected_salary_amount,omitempty"`
	ExpectedSalaryCurrency string         `json:"expected_salary_currency"`
	CVOriginalFilename     *string        `json:"cv_original_filename,omitempty"`
	LastActiveAt           *time.Time     `json:"last_active_at,omitempty"`
	ProfileUpdatedAt       time.Time      `json:"profile_updated_at"`
	AlternatePhoneE164     *string        `json:"alternate_phone_e164,omitempty"`
	ContactRevealEnabled   bool           `json:"contact_reveal_enabled"`
}

type ProfileDetailsUpdate struct {
	Details                map[string]any `json:"details"`
	CurrentSalaryAmount    *float64       `json:"current_salary_amount"`
	CurrentSalaryCurrency  string         `json:"current_salary_currency"`
	ExpectedSalaryAmount   *float64       `json:"expected_salary_amount"`
	ExpectedSalaryCurrency string         `json:"expected_salary_currency"`
	AlternatePhoneE164     *string        `json:"alternate_phone_e164"`
	ContactRevealEnabled   *bool          `json:"contact_reveal_enabled"`
}

var alternatePhonePattern = regexp.MustCompile(`^\+[1-9][0-9]{7,14}$`)

func (s *Service) Details(ctx context.Context, userID string) (ProfileDetails, error) {
	var result ProfileDetails
	var raw []byte
	err := s.db.QueryRow(ctx, `SELECT cp.profile_details,cp.current_salary_amount,cp.current_salary_currency,cp.expected_salary_amount,cp.expected_salary_currency,cp.cv_original_filename,u.last_active_at,cp.updated_at,cp.alternate_phone_e164,cp.contact_reveal_enabled FROM candidate_profiles cp JOIN users u ON u.id=cp.user_id WHERE cp.user_id=$1`, userID).Scan(
		&raw,
		&result.CurrentSalaryAmount,
		&result.CurrentSalaryCurrency,
		&result.ExpectedSalaryAmount,
		&result.ExpectedSalaryCurrency,
		&result.CVOriginalFilename,
		&result.LastActiveAt,
		&result.ProfileUpdatedAt,
		&result.AlternatePhoneE164,
		&result.ContactRevealEnabled,
	)
	if errors.Is(err, pgx.ErrNoRows) {
		return ProfileDetails{}, ErrNotFound
	}
	if err != nil {
		return ProfileDetails{}, err
	}
	if len(raw) == 0 {
		result.Details = map[string]any{}
	} else if err := json.Unmarshal(raw, &result.Details); err != nil {
		return ProfileDetails{}, err
	}
	return result, nil
}

func (s *Service) UpdateDetails(ctx context.Context, userID string, input ProfileDetailsUpdate) (ProfileDetails, error) {
	if input.Details == nil {
		input.Details = map[string]any{}
	}
	if input.CurrentSalaryAmount != nil && *input.CurrentSalaryAmount < 0 {
		return ProfileDetails{}, errors.New("current salary cannot be negative")
	}
	if input.ExpectedSalaryAmount != nil && *input.ExpectedSalaryAmount < 0 {
		return ProfileDetails{}, errors.New("expected salary cannot be negative")
	}
	if input.CurrentSalaryCurrency == "" {
		input.CurrentSalaryCurrency = "INR"
	}
	if input.ExpectedSalaryCurrency == "" {
		input.ExpectedSalaryCurrency = "INR"
	}
	if input.AlternatePhoneE164 != nil {
		value := strings.TrimSpace(*input.AlternatePhoneE164)
		if value != "" && !alternatePhonePattern.MatchString(value) {
			return ProfileDetails{}, errors.New("alternate phone must use international E.164 format")
		}
		input.AlternatePhoneE164 = &value
	}
	raw, err := json.Marshal(input.Details)
	if err != nil {
		return ProfileDetails{}, err
	}
	// Discovery and onboarding transitions have dedicated endpoints. A stale or
	// forged profile form must never toggle either of these server-owned fields.
	_, err = s.db.Exec(ctx, `UPDATE candidate_profiles SET profile_details=($2::jsonb - 'discoverable_to_recruiters' - 'onboarding_status' - 'onboarding_method' - 'onboarding_return_to') || jsonb_build_object('discoverable_to_recruiters',COALESCE(profile_details->'discoverable_to_recruiters','false'::jsonb)) || jsonb_strip_nulls(jsonb_build_object('onboarding_status',profile_details->'onboarding_status','onboarding_method',profile_details->'onboarding_method','onboarding_return_to',profile_details->'onboarding_return_to')),current_salary_amount=$3,current_salary_currency=$4,expected_salary_amount=$5,expected_salary_currency=$6,alternate_phone_e164=CASE WHEN $7::text IS NULL THEN alternate_phone_e164 ELSE NULLIF($7,'') END,contact_reveal_enabled=COALESCE($8,contact_reveal_enabled) WHERE user_id=$1`, userID, raw, input.CurrentSalaryAmount, input.CurrentSalaryCurrency, input.ExpectedSalaryAmount, input.ExpectedSalaryCurrency, input.AlternatePhoneE164, input.ContactRevealEnabled)
	if err != nil {
		return ProfileDetails{}, err
	}
	return s.Details(ctx, userID)
}

func (s *Service) MarkActive(ctx context.Context, userID string) error {
	_, err := s.db.Exec(ctx, `UPDATE users SET last_active_at=now() WHERE id=$1 AND role='candidate' AND (last_active_at IS NULL OR last_active_at < now() - interval '5 minutes')`, userID)
	return err
}

// Contact sharing is independently controlled by the candidate and off by default.
func (s *Service) SetContactSharing(ctx context.Context, userID, alternate string, enabled bool) (ProfileDetails, error) {
	alternate = strings.TrimSpace(alternate)
	if alternate != "" && !alternatePhonePattern.MatchString(alternate) {
		return ProfileDetails{}, errors.New("alternate phone must use international E.164 format")
	}
	_, err := s.db.Exec(ctx, `UPDATE candidate_profiles SET alternate_phone_e164=NULLIF($2,''),contact_reveal_enabled=$3 WHERE user_id=$1`, userID, alternate, enabled)
	if err != nil {
		return ProfileDetails{}, err
	}
	return s.Details(ctx, userID)
}
