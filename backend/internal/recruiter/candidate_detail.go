package recruiter

import (
	"context"
	"encoding/base64"
	"encoding/json"
	"errors"
	"time"

	"github.com/jackc/pgx/v5"
)

type CandidateDetail struct {
	UserID                string         `json:"user_id"`
	FullName              string         `json:"full_name"`
	Headline              *string        `json:"headline,omitempty"`
	Email                 string         `json:"email"`
	Phone                 *string        `json:"phone,omitempty"`
	CurrentCity           *string        `json:"current_city,omitempty"`
	CurrentState          *string        `json:"current_state,omitempty"`
	CountryCode           string         `json:"country_code"`
	TotalExperienceMonths int            `json:"total_experience_months"`
	NoticePeriodDays      *int           `json:"notice_period_days,omitempty"`
	ProfileCompletion     int            `json:"profile_completion"`
	LastActiveAt          *time.Time     `json:"last_active_at,omitempty"`
	ProfileUpdatedAt      time.Time      `json:"profile_updated_at"`
	PhotoDataURL          string         `json:"photo_data_url,omitempty"`
	Details               map[string]any `json:"details"`
}

func (s *Service) CandidateDetail(ctx context.Context, recruiterUserID, candidateUserID string) (CandidateDetail, error) {
	companyID, _, _, err := s.recruiterCompany(ctx, recruiterUserID)
	if err != nil {
		return CandidateDetail{}, err
	}

	var detail CandidateDetail
	var raw []byte
	var photo []byte
	var photoMime *string
	err = s.db.QueryRow(ctx, `
		SELECT cp.user_id,cp.full_name,cp.headline,u.email,u.phone_e164,cp.current_city,cp.current_state,cp.country_code,
		       cp.total_experience_months,cp.notice_period_days,cp.profile_completion,u.last_active_at,cp.updated_at,
		       cp.profile_photo,cp.profile_photo_mime,cp.profile_details
		FROM candidate_profiles cp
		JOIN users u ON u.id=cp.user_id
		WHERE cp.user_id=$1
		  AND EXISTS (
		    SELECT 1 FROM applications a
		    JOIN jobs j ON j.id=a.job_id
		    WHERE a.candidate_id=cp.user_id AND j.company_id=$2
		  )
	`, candidateUserID, companyID).Scan(
		&detail.UserID,
		&detail.FullName,
		&detail.Headline,
		&detail.Email,
		&detail.Phone,
		&detail.CurrentCity,
		&detail.CurrentState,
		&detail.CountryCode,
		&detail.TotalExperienceMonths,
		&detail.NoticePeriodDays,
		&detail.ProfileCompletion,
		&detail.LastActiveAt,
		&detail.ProfileUpdatedAt,
		&photo,
		&photoMime,
		&raw,
	)
	if errors.Is(err, pgx.ErrNoRows) {
		return CandidateDetail{}, ErrNotFound
	}
	if err != nil {
		return CandidateDetail{}, err
	}

	var storedDetails map[string]any
	if len(raw) > 0 {
		if err := json.Unmarshal(raw, &storedDetails); err != nil {
			return CandidateDetail{}, err
		}
	}
	detail.Details = recruiterVisibleCandidateDetails(storedDetails)
	if len(photo) > 0 && photoMime != nil {
		detail.PhotoDataURL = "data:" + *photoMime + ";base64," + base64.StdEncoding.EncodeToString(photo)
	}
	return detail, nil
}
