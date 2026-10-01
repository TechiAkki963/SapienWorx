package recruiter

import (
	"context"
	"errors"

	"github.com/jackc/pgx/v5"
)

type CandidateCVObject struct {
	Key         string `json:"-"`
	Filename    string `json:"filename"`
	CompanyID   string `json:"-"`
	RecruiterID string `json:"-"`
	CandidateID string `json:"-"`
}

func (s *Service) CandidateCV(ctx context.Context, recruiterUserID, candidateUserID string) (CandidateCVObject, error) {
	companyID, _, _, err := s.recruiterCompany(ctx, recruiterUserID)
	if err != nil {
		return CandidateCVObject{}, err
	}
	var object CandidateCVObject
	object.CompanyID = companyID
	object.RecruiterID = recruiterUserID
	object.CandidateID = candidateUserID
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


func (s *Service) RecordCandidateCVView(ctx context.Context, object CandidateCVObject) error {
	if object.CompanyID == "" || object.RecruiterID == "" || object.CandidateID == "" {
		return ErrInvalid
	}
	_, err := s.db.Exec(ctx, `
		INSERT INTO subscription_usage_events(company_id,recruiter_id,candidate_id,event_type,quantity)
		VALUES($1,$2,$3,'candidate_cv_view',1)
	`, object.CompanyID, object.RecruiterID, object.CandidateID)
	return err
}
