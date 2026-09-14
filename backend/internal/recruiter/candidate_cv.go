package recruiter

import (
	"context"
	"errors"

	"github.com/jackc/pgx/v5"
)

type CandidateCVObject struct {
	Key      string `json:"-"`
	Filename string `json:"filename"`
}

func (s *Service) CandidateCV(ctx context.Context, recruiterUserID, candidateUserID string) (CandidateCVObject, error) {
	companyID, _, _, err := s.recruiterCompany(ctx, recruiterUserID)
	if err != nil {
		return CandidateCVObject{}, err
	}
	var object CandidateCVObject
	err = s.db.QueryRow(ctx, `SELECT cp.cv_s3_key,COALESCE(cp.cv_original_filename,'resume.pdf')
		FROM candidate_profiles cp
		WHERE cp.user_id=$1
		AND cp.cv_s3_key IS NOT NULL
		AND cp.cv_uploaded_at IS NOT NULL
		AND EXISTS (
			SELECT 1
			FROM applications a
			JOIN jobs j ON j.id=a.job_id
			WHERE a.candidate_id=cp.user_id AND j.company_id=$2
		)`, candidateUserID, companyID).Scan(&object.Key, &object.Filename)
	if errors.Is(err, pgx.ErrNoRows) {
		return CandidateCVObject{}, ErrNotFound
	}
	return object, err
}
