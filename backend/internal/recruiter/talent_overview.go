package recruiter

import (
	"context"
	"encoding/json"
	"time"

	"github.com/TechiAkki963/SapienWorx/backend/internal/company"
)

type TalentOverviewPool struct {
	ID    string `json:"id"`
	Name  string `json:"name"`
	Kind  string `json:"kind"`
	Count *int   `json:"count"`
}
type TalentOverviewAlert struct {
	ID        string     `json:"id"`
	Name      string     `json:"name"`
	Enabled   bool       `json:"enabled"`
	Frequency string     `json:"frequency"`
	Matches   *int       `json:"matches"`
	CheckedAt *time.Time `json:"checked_at,omitempty"`
}
type TalentOutreachSummary struct {
	Days          int `json:"days"`
	Sent          int `json:"sent"`
	Opened        int `json:"opened"`
	Replies       int `json:"replies"`
	UnreadReplies int `json:"unread_replies"`
	Interested    int `json:"interested"`
	Failed        int `json:"failed"`
}
type TalentOverview struct {
	Recent                []RecentSearch        `json:"recent_searches"`
	Pools                 []TalentOverviewPool  `json:"pools"`
	Alerts                []TalentOverviewAlert `json:"alerts"`
	Outreach              TalentOutreachSummary `json:"outreach"`
	Candidates            []TalentPoolCandidate `json:"recommended_candidates"`
	RecommendationsReason string                `json:"recommendations_reason"`
	ObservedAt            time.Time             `json:"observed_at"`
}

// Fixed-size queries provide operational evidence without loading Discover or
// running every smart pool/saved search on initial navigation.
func (s *Service) TalentOverview(ctx context.Context, userID string, days int) (TalentOverview, error) {
	companyID, _, _, err := s.recruiterCompany(ctx, userID)
	if err != nil {
		return TalentOverview{}, err
	}
	if !validEnumInt(days, 7, 30, 90) {
		return TalentOverview{}, ErrInvalid
	}
	result := TalentOverview{Recent: []RecentSearch{}, Pools: []TalentOverviewPool{}, Alerts: []TalentOverviewAlert{}, Candidates: []TalentPoolCandidate{}, ObservedAt: time.Now(), RecommendationsReason: "Recently saved candidates available to your workspace"}
	result.Outreach.Days = days
	rows, err := s.db.Query(ctx, `SELECT id,filters,created_at FROM recruiter_search_activity WHERE recruiter_id=$1 ORDER BY created_at DESC,id DESC LIMIT 4`, userID)
	if err != nil {
		return result, err
	}
	for rows.Next() {
		var item RecentSearch
		var raw []byte
		if err = rows.Scan(&item.ID, &raw, &item.CreatedAt); err != nil {
			rows.Close()
			return result, err
		}
		if err = json.Unmarshal(raw, &item.Filters); err != nil {
			rows.Close()
			return result, err
		}
		result.Recent = append(result.Recent, item)
	}
	err = rows.Err()
	rows.Close()
	if err != nil {
		return result, err
	}
	rows, err = s.db.Query(ctx, `SELECT p.id,p.name,p.kind,CASE WHEN p.kind='manual' THEN (SELECT count(*)::integer FROM recruiter_talent_pool_entries e JOIN candidate_profiles cp ON cp.user_id=e.candidate_id JOIN users u ON u.id=cp.user_id WHERE e.pool_id=p.id AND u.is_active AND u.status='active' AND (`+candidateDiscoverablePredicate+` OR EXISTS(SELECT 1 FROM applications a JOIN jobs j ON j.id=a.job_id WHERE a.candidate_id=cp.user_id AND j.company_id=$1))) ELSE NULL END FROM recruiter_talent_pools p WHERE `+poolACL+` ORDER BY p.updated_at DESC,p.id LIMIT 4`, companyID, userID)
	if err != nil {
		return result, err
	}
	for rows.Next() {
		var item TalentOverviewPool
		if err = rows.Scan(&item.ID, &item.Name, &item.Kind, &item.Count); err != nil {
			rows.Close()
			return result, err
		}
		result.Pools = append(result.Pools, item)
	}
	err = rows.Err()
	rows.Close()
	if err != nil {
		return result, err
	}
	rows, err = s.db.Query(ctx, `SELECT id,name,alert_enabled,alert_frequency,last_match_count,last_matches_evaluated_at FROM recruiter_saved_searches WHERE recruiter_id=$1 ORDER BY updated_at DESC,id LIMIT 4`, userID)
	if err != nil {
		return result, err
	}
	for rows.Next() {
		var item TalentOverviewAlert
		if err = rows.Scan(&item.ID, &item.Name, &item.Enabled, &item.Frequency, &item.Matches, &item.CheckedAt); err != nil {
			rows.Close()
			return result, err
		}
		result.Alerts = append(result.Alerts, item)
	}
	err = rows.Err()
	rows.Close()
	if err != nil {
		return result, err
	}
	err = s.db.QueryRow(ctx, `WITH enrolled AS (
 SELECT e.*,c.recruiter_id FROM outreach_campaign_enrollments e JOIN outreach_campaigns c ON c.id=e.campaign_id WHERE c.recruiter_id=$1 AND e.last_sent_at>=now()-make_interval(days=>$2)
 ) SELECT (SELECT COALESCE(sum(recipient_count),0) FROM outreach_send_ledger WHERE recruiter_id=$1 AND created_at>=now()-make_interval(days=>$2)),
 count(*) FILTER(WHERE EXISTS(SELECT 1 FROM chat_messages m WHERE m.thread_id=e.thread_id AND m.sender_type='recruiter' AND m.is_read AND m.created_at>=e.created_at)),
 count(*) FILTER(WHERE EXISTS(SELECT 1 FROM chat_messages m WHERE m.thread_id=e.thread_id AND m.sender_type='candidate' AND m.created_at>=e.created_at)),
 count(*) FILTER(WHERE EXISTS(SELECT 1 FROM chat_messages m WHERE m.thread_id=e.thread_id AND m.sender_type='candidate' AND NOT m.is_read AND m.created_at>=e.created_at)),
 count(*) FILTER(WHERE EXISTS(SELECT 1 FROM outreach_interest_events i WHERE i.enrollment_id=e.id)),
 (SELECT count(*) FROM outreach_campaign_enrollments f JOIN outreach_campaigns c ON c.id=f.campaign_id WHERE c.recruiter_id=$1 AND f.status='failed' AND f.updated_at>=now()-make_interval(days=>$2)) FROM enrolled e`, userID, days).Scan(&result.Outreach.Sent, &result.Outreach.Opened, &result.Outreach.Replies, &result.Outreach.UnreadReplies, &result.Outreach.Interested, &result.Outreach.Failed)
	if err != nil {
		return result, err
	}
	candidates, err := s.PaginatedTalentPool(ctx, userID, "", "", 1, 5)
	if err != nil {
		return result, err
	}
	result.Candidates = candidates.Items
	return result, nil
}
func validEnumInt(value int, values ...int) bool {
	for _, v := range values {
		if v == value {
			return true
		}
	}
	return false
}

type OutreachInterest struct {
	Available  bool `json:"available"`
	Interested bool `json:"interested"`
}

func (s *Service) CandidateOutreachInterest(ctx context.Context, candidateID, threadID string, record bool) (OutreachInterest, error) {
	if !candidateUUID.MatchString(threadID) {
		return OutreachInterest{}, ErrInvalid
	}
	var own bool
	if err := s.db.QueryRow(ctx, `SELECT EXISTS(SELECT 1 FROM chat_threads WHERE id=$1 AND candidate_id=$2)`, threadID, candidateID).Scan(&own); err != nil {
		return OutreachInterest{}, err
	}
	if !own {
		return OutreachInterest{}, ErrNotFound
	}
	if record {
		tag, err := s.db.Exec(ctx, `INSERT INTO outreach_interest_events(enrollment_id,candidate_id) SELECT e.id,$2 FROM outreach_campaign_enrollments e JOIN chat_threads t ON t.id=e.thread_id WHERE e.thread_id=$1 AND t.candidate_id=$2 AND e.candidate_id=$2 AND e.last_sent_at IS NOT NULL ON CONFLICT(enrollment_id) DO NOTHING`, threadID, candidateID)
		if err != nil {
			return OutreachInterest{}, err
		}
		_ = tag
	}
	var result OutreachInterest
	err := s.db.QueryRow(ctx, `SELECT EXISTS(SELECT 1 FROM outreach_campaign_enrollments WHERE thread_id=$1 AND candidate_id=$2 AND last_sent_at IS NOT NULL),EXISTS(SELECT 1 FROM outreach_interest_events i JOIN outreach_campaign_enrollments e ON e.id=i.enrollment_id WHERE e.thread_id=$1 AND i.candidate_id=$2)`, threadID, candidateID).Scan(&result.Available, &result.Interested)
	if record && !result.Available && err == nil {
		return result, ErrNotFound
	}
	return result, err
}

// TalentPlan is loaded only from the contextual usage action, never as part of
// the operational overview. Membership binds the read to the caller's company.
type TalentPlan struct {
	Entitlements company.Effective `json:"entitlements"`
	Usage        map[string]int64  `json:"usage"`
	Owner        bool              `json:"owner"`
}

func (s *Service) TalentPlan(ctx context.Context, actor string) (TalentPlan, error) {
	store := company.NewSQLStore(s.db)
	m, err := store.Member(ctx, actor)
	if err != nil {
		return TalentPlan{}, err
	}
	if !m.Can("applications.view") {
		return TalentPlan{}, company.ErrForbidden
	}
	subscription, grants, err := store.Subscription(ctx, m.CompanyID)
	if err != nil {
		return TalentPlan{}, err
	}
	usage, err := store.Usage(ctx, m.CompanyID)
	if err != nil {
		return TalentPlan{}, err
	}
	return TalentPlan{Entitlements: company.Resolve(subscription, grants, time.Now().UTC()), Usage: usage, Owner: m.Owner()}, nil
}
