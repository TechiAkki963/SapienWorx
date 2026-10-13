package recruiter

import (
	"context"
	"encoding/json"
	"strings"
)

func (s *Service) RecordCandidateCVView(ctx context.Context, companyID, recruiterUserID, candidateUserID, requestID string) error {
	return s.RecordCandidateCVAccess(ctx, companyID, recruiterUserID, candidateUserID, "", "view", requestID)
}

func (s *Service) RecordCandidateCVAccess(ctx context.Context, companyID, recruiterUserID, candidateUserID, applicationID, action, requestID string) error {
	if !candidateUUID.MatchString(strings.TrimSpace(companyID)) ||
		!candidateUUID.MatchString(strings.TrimSpace(recruiterUserID)) ||
		!candidateUUID.MatchString(strings.TrimSpace(candidateUserID)) {
		return ErrInvalid
	}
	if action != "view" && action != "download" || applicationID != "" && !candidateUUID.MatchString(applicationID) {
		return ErrInvalid
	}
	metadata, _ := json.Marshal(map[string]any{"source": "explicit_user_action", "resource": "application_cv", "application_id": applicationID, "action": action})
	_, err := s.db.Exec(ctx, `
		INSERT INTO subscription_usage_events(
			company_id, actor_user_id, candidate_id, meter_key, quantity, metadata, request_id
		) VALUES($1,$2,$3,$6,1,$4::jsonb,NULLIF($5,''))
        ON CONFLICT (request_id) WHERE request_id IS NOT NULL DO NOTHING
	`, companyID, recruiterUserID, candidateUserID, metadata, strings.TrimSpace(requestID), "cv_"+action)
	return err
}
