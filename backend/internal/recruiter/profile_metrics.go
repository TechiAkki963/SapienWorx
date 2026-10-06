package recruiter

import "context"

// Called only after a successful server-side resource read. Permission and
// verified identity are checked again when recording, including concurrent
// opt-out, candidate deactivation and tenant ownership. No client event endpoint.
func (s *Service) recordProfileEvents(ctx context.Context, recruiterID string, candidateIDs []string, kind string) error {
	if len(candidateIDs) == 0 {
		return nil
	}
	_, err := s.db.Exec(ctx, `
 INSERT INTO candidate_profile_events(candidate_id,recruiter_id,event_kind)
 SELECT cp.user_id,rp.user_id,$3
 FROM candidate_profiles cp JOIN users cu ON cu.id=cp.user_id
 CROSS JOIN recruiter_profiles rp JOIN users ru ON ru.id=rp.user_id
 WHERE cp.user_id=ANY($2::uuid[]) AND rp.user_id=$1 AND rp.verification_status='verified'
 AND ru.role='recruiter' AND ru.status='active' AND ru.is_active AND ru.email_verified_at IS NOT NULL
 AND cu.role='candidate' AND cu.status='active' AND cu.is_active
 AND (($3='search_appearance' AND (`+candidateDiscoverablePredicate+`)) OR
 ($3='profile_view' AND ((`+candidateDiscoverablePredicate+`) OR EXISTS(SELECT 1 FROM applications a JOIN jobs j ON j.id=a.job_id WHERE a.candidate_id=cp.user_id AND j.company_id=rp.company_id) OR EXISTS(SELECT 1 FROM talent_pool_memberships t WHERE t.candidate_id=cp.user_id AND t.recruiter_id=rp.user_id))))
 ON CONFLICT(candidate_id,recruiter_id,event_kind,event_day) DO NOTHING`, recruiterID, candidateIDs, kind)
	return err
}
