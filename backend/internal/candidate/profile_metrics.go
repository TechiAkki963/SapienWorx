package candidate

import (
	"context"
	"time"
)

type ProfileMetrics struct {
	ProfileViews      int       `json:"profile_views"`
	SearchAppearances int       `json:"search_appearances"`
	RecruiterActions  int       `json:"recruiter_actions"`
	PeriodDays        int       `json:"period_days"`
	ComputedAt        time.Time `json:"computed_at"`
}

// Profile views are distinct verified recruiters in the last 30 days. Search
// appearances are successful returned-result recruiter-days, deduplicating page
// refreshes. Actions count distinct verified recruiters with an audited action,
// not passive impressions. No company/actor identity or private metadata leaks.
func (s *Service) ProfileMetrics(ctx context.Context, userID string) (ProfileMetrics, error) {
	result := ProfileMetrics{PeriodDays: 30}
	err := s.db.QueryRow(ctx, `
 WITH verified AS (
 SELECT rp.user_id FROM recruiter_profiles rp JOIN users u ON u.id=rp.user_id
 WHERE rp.verification_status='verified' AND u.role='recruiter' AND u.status='active' AND u.is_active AND u.email_verified_at IS NOT NULL
 ) , actions AS (
 SELECT e.recruiter_id AS actor FROM candidate_profile_events e WHERE e.candidate_id=$1 AND e.event_kind='recruiter_action' AND e.occurred_at>=now()-interval '30 days'
 UNION
 SELECT t.recruiter_id AS actor FROM talent_pool_memberships t WHERE t.candidate_id=$1 AND t.created_at>=now()-interval '30 days'
 UNION
 SELECT a.actor_recruiter_id FROM application_stage_audit a JOIN applications ap ON ap.id=a.application_id WHERE ap.candidate_id=$1 AND a.changed_at>=now()-interval '30 days' AND a.new_stage NOT IN('new_application','rejected','withdrawn')
 UNION
 SELECT i.recruiter_id FROM interviews i JOIN applications ap ON ap.id=i.application_id WHERE ap.candidate_id=$1 AND i.created_at>=now()-interval '30 days'
 UNION
 SELECT a.actor_recruiter_id FROM interview_change_audit a JOIN interviews i ON i.id=a.interview_id JOIN applications ap ON ap.id=i.application_id WHERE ap.candidate_id=$1 AND a.changed_at>=now()-interval '30 days'
 UNION
 SELECT m.sender_id FROM chat_messages m JOIN chat_threads t ON t.id=m.thread_id WHERE t.candidate_id=$1 AND m.sender_type='recruiter' AND m.created_at>=now()-interval '30 days'
 UNION
 SELECT e.actor_user_id FROM subscription_usage_events e WHERE e.candidate_id=$1 AND e.meter_key='cv_view' AND e.occurred_at>=now()-interval '30 days'
 )
 SELECT
 (SELECT count(DISTINCT e.recruiter_id) FROM candidate_profile_events e JOIN verified v ON v.user_id=e.recruiter_id WHERE e.candidate_id=$1 AND e.event_kind='profile_view' AND e.occurred_at>=now()-interval '30 days'),
 (SELECT count(*) FROM candidate_profile_events e JOIN verified v ON v.user_id=e.recruiter_id WHERE e.candidate_id=$1 AND e.event_kind='search_appearance' AND e.occurred_at>=now()-interval '30 days'),
 (SELECT count(DISTINCT a.actor) FROM actions a JOIN verified v ON v.user_id=a.actor),current_timestamp
 `, userID).Scan(&result.ProfileViews, &result.SearchAppearances, &result.RecruiterActions, &result.ComputedAt)
	return result, err
}
