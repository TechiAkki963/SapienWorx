package recruiter

import (
	"context"
	"errors"
	"fmt"
	"strings"

	"github.com/jackc/pgx/v5"
)

type AnonymousPitch struct {
	CandidateRef          string  `json:"candidate_ref"`
	Headline              *string `json:"headline,omitempty"`
	CountryCode           string  `json:"country_code"`
	TotalExperienceMonths int     `json:"total_experience_months"`
	NoticePeriodDays      *int    `json:"notice_period_days,omitempty"`
	ProfileCompletion     int     `json:"profile_completion"`
}

// CandidateAnonymousPitch deliberately selects only the fields permitted in
// anonymous mode. Identity, contact data, photo, current company, DOB and the
// free-form profile_details document are never loaded and therefore cannot be
// leaked into the client DOM by this endpoint.
func (s *Service) CandidateAnonymousPitch(ctx context.Context, recruiterUserID, candidateUserID string) (AnonymousPitch, error) {
	companyID, _, _, err := s.recruiterCompany(ctx, recruiterUserID)
	if err != nil {
		return AnonymousPitch{}, err
	}
	var pitch AnonymousPitch
	var ref string
	err = s.db.QueryRow(ctx, `
		SELECT cp.user_id::text,cp.headline,cp.country_code,cp.total_experience_months,cp.notice_period_days,cp.profile_completion
		FROM candidate_profiles cp
		WHERE cp.user_id=$1
		  AND EXISTS (
		    SELECT 1 FROM applications a
		    JOIN jobs j ON j.id=a.job_id
		    WHERE a.candidate_id=cp.user_id AND j.company_id=$2
		  )
	`, candidateUserID, companyID).Scan(&ref, &pitch.Headline, &pitch.CountryCode, &pitch.TotalExperienceMonths, &pitch.NoticePeriodDays, &pitch.ProfileCompletion)
	if errors.Is(err, pgx.ErrNoRows) {
		return AnonymousPitch{}, ErrNotFound
	}
	if err != nil {
		return AnonymousPitch{}, err
	}
	compact := strings.ReplaceAll(ref, "-", "")
	if len(compact) > 8 {
		compact = compact[:8]
	}
	pitch.CandidateRef = fmt.Sprintf("SWX-%s", strings.ToUpper(compact))
	return pitch, nil
}
