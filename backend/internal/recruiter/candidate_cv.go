package recruiter

import (
	"context"
	"errors"

	"github.com/jackc/pgx/v5"
)

type CandidateCVObject struct {
	Key           string `json:"-"`
	Filename      string `json:"filename"`
	CompanyID     string `json:"-"`
	ApplicationID string `json:"application_id"`
	Provenance    string `json:"provenance"`
}

func (s *Service) CandidateCV(ctx context.Context, recruiterUserID, candidateUserID string, applicationIDs ...string) (CandidateCVObject, error) {
	if !candidateUUID.MatchString(candidateUserID) || len(applicationIDs) > 1 {
		return CandidateCVObject{}, ErrInvalid
	}
	applicationID := ""
	if len(applicationIDs) == 1 {
		applicationID = applicationIDs[0]
		if applicationID != "" && !candidateUUID.MatchString(applicationID) {
			return CandidateCVObject{}, ErrInvalid
		}
	}
	companyID, _, _, err := s.recruiterCompany(ctx, recruiterUserID)
	if err != nil {
		return CandidateCVObject{}, err
	}
	var object CandidateCVObject
	err = s.db.QueryRow(ctx, `SELECT a.submitted_cv_key,COALESCE(a.submitted_cv_filename,'resume.pdf'),a.id::text,a.submitted_cv_provenance
		FROM applications a JOIN jobs j ON j.id=a.job_id JOIN candidate_profiles cp ON cp.user_id=a.candidate_id
		WHERE a.candidate_id=$1 AND j.company_id=$2 AND ($3='' OR a.id::text=$3)
		AND a.submitted_cv_key IS NOT NULL AND a.submitted_cv_uploaded_at IS NOT NULL
		ORDER BY a.applied_at DESC,a.id LIMIT 1`, candidateUserID, companyID, applicationID).Scan(&object.Key, &object.Filename, &object.ApplicationID, &object.Provenance)
	if errors.Is(err, pgx.ErrNoRows) {
		return CandidateCVObject{}, ErrNotFound
	}
	if err != nil {
		return CandidateCVObject{}, err
	}
	object.CompanyID = companyID
	return object, nil
}
