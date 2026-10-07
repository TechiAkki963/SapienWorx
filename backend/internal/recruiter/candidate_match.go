package recruiter

import (
	"context"
	"encoding/json"
	"errors"
	"strings"
	"time"

	"github.com/jackc/pgx/v5"
)

// CandidateMatch is the recruiter-facing, job-specific advisory result produced
// by the SapienWorx Intelligence matching engine. It deliberately exposes only
// non-sensitive matching signals and never represents an automated hiring decision.
type CandidateMatch struct {
	JobID        string         `json:"job_id"`
	JobTitle     string         `json:"job_title"`
	Score        float64        `json:"score"`
	Eligible     bool           `json:"eligible"`
	Components   map[string]any `json:"components"`
	Explanation  map[string]any `json:"explanation"`
	ModelVersion string         `json:"model_version"`
	ModelRef     string         `json:"model_ref"`
	GeneratedAt  time.Time      `json:"generated_at"`
}

// CandidateMatch returns the latest result for the active production matching
// model, scoped to a job owned by the recruiter's company and to a candidate the
// recruiter is already authorized to view.
func (s *Service) CandidateMatch(ctx context.Context, recruiterUserID, candidateUserID, jobID string) (*CandidateMatch, error) {
	if !candidateUUID.MatchString(strings.TrimSpace(candidateUserID)) || !candidateUUID.MatchString(strings.TrimSpace(jobID)) {
		return nil, ErrInvalid
	}

	companyID, _, _, err := s.recruiterCompany(ctx, recruiterUserID)
	if err != nil {
		return nil, err
	}

	var item CandidateMatch
	var componentsRaw, explanationRaw []byte
	err = s.db.QueryRow(ctx, `
		SELECT mr.job_id,j.title,mr.score,mr.eligible,mr.components,mr.explanation,
		       mv.version,mv.model_ref,mr.generated_at
		FROM intelligence.match_results mr
		JOIN intelligence.model_versions mv ON mv.id=mr.model_version_id
		JOIN jobs j ON j.id=mr.job_id
		WHERE mr.candidate_id=$1
		  AND mr.job_id=$2
		  AND j.company_id=$3
		  AND mv.engine_type='matching'
		  AND mv.status='production'
		  AND EXISTS (
		    SELECT 1
		    FROM candidate_profiles cp
		    WHERE cp.user_id=mr.candidate_id
		      AND (
		        EXISTS (
		          SELECT 1
		          FROM applications a
		          JOIN jobs aj ON aj.id=a.job_id
		          WHERE a.candidate_id=cp.user_id AND aj.company_id=$3
		        )
		        OR `+candidateDiscoverablePredicate+`
		      )
		  )
		ORDER BY mv.activated_at DESC NULLS LAST,mr.generated_at DESC
		LIMIT 1
	`, candidateUserID, jobID, companyID).Scan(
		&item.JobID,
		&item.JobTitle,
		&item.Score,
		&item.Eligible,
		&componentsRaw,
		&explanationRaw,
		&item.ModelVersion,
		&item.ModelRef,
		&item.GeneratedAt,
	)
	if errors.Is(err, pgx.ErrNoRows) {
		return nil, nil
	}
	if err != nil {
		return nil, err
	}

	item.Components = map[string]any{}
	item.Explanation = map[string]any{}
	if len(componentsRaw) > 0 {
		if err := json.Unmarshal(componentsRaw, &item.Components); err != nil {
			return nil, err
		}
	}
	if len(explanationRaw) > 0 {
		if err := json.Unmarshal(explanationRaw, &item.Explanation); err != nil {
			return nil, err
		}
	}
	return &item, nil
}
