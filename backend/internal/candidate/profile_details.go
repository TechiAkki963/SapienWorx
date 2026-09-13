package candidate

import (
	"context"
	"encoding/json"
	"errors"

	"github.com/jackc/pgx/v5"
)

type ProfileDetails struct {
	Details                map[string]any `json:"details"`
	CurrentSalaryAmount    *float64       `json:"current_salary_amount,omitempty"`
	CurrentSalaryCurrency  string         `json:"current_salary_currency"`
	ExpectedSalaryAmount   *float64       `json:"expected_salary_amount,omitempty"`
	ExpectedSalaryCurrency string         `json:"expected_salary_currency"`
	CVOriginalFilename     *string        `json:"cv_original_filename,omitempty"`
}

type ProfileDetailsUpdate struct {
	Details                map[string]any `json:"details"`
	CurrentSalaryAmount    *float64       `json:"current_salary_amount"`
	CurrentSalaryCurrency  string         `json:"current_salary_currency"`
	ExpectedSalaryAmount   *float64       `json:"expected_salary_amount"`
	ExpectedSalaryCurrency string         `json:"expected_salary_currency"`
}

func (s *Service) Details(ctx context.Context, userID string) (ProfileDetails, error) {
	var result ProfileDetails
	var raw []byte
	err := s.db.QueryRow(ctx, `SELECT profile_details,current_salary_amount,current_salary_currency,expected_salary_amount,expected_salary_currency,cv_original_filename FROM candidate_profiles WHERE user_id=$1`, userID).Scan(
		&raw,
		&result.CurrentSalaryAmount,
		&result.CurrentSalaryCurrency,
		&result.ExpectedSalaryAmount,
		&result.ExpectedSalaryCurrency,
		&result.CVOriginalFilename,
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
	raw, err := json.Marshal(input.Details)
	if err != nil {
		return ProfileDetails{}, err
	}
	_, err = s.db.Exec(ctx, `UPDATE candidate_profiles SET profile_details=$2::jsonb,current_salary_amount=$3,current_salary_currency=$4,expected_salary_amount=$5,expected_salary_currency=$6 WHERE user_id=$1`, userID, raw, input.CurrentSalaryAmount, input.CurrentSalaryCurrency, input.ExpectedSalaryAmount, input.ExpectedSalaryCurrency)
	if err != nil {
		return ProfileDetails{}, err
	}
	return s.Details(ctx, userID)
}
