package recruiter

import (
	"context"
	"encoding/json"
	"strings"
)

func (s *Service) RecordCandidateCVView(ctx context.Context, companyID, recruiterUserID, candidateUserID, requestID string) error {
	if !candidateUUID.MatchString(strings.TrimSpace(companyID)) ||
		!candidateUUID.MatchString(strings.TrimSpace(recruiterUserID)) ||
		!candidateUUID.MatchString(strings.TrimSpace(candidateUserID)) {
		return ErrInvalid
	}
	metadata, _ := json.Marshal(map[string]any{"source": "candidate_360", "resource": "candidate_cv"})
	_, err := s.db.Exec(ctx, `
		INSERT INTO subscription_usage_events(
			company_id, actor_user_id, candidate_id, meter_key, quantity, metadata, request_id
		) VALUES($1,$2,$3,'cv_view',1,$4::jsonb,NULLIF($5,''))
	`, companyID, recruiterUserID, candidateUserID, metadata, strings.TrimSpace(requestID))
	return err
}
