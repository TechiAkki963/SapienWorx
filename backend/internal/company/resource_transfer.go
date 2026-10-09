package company

import (
	"context"
	"encoding/json"
	"github.com/jackc/pgx/v5"
)

type OwnedResources struct {
	Jobs      int64 `json:"jobs"`
	Searches  int64 `json:"saved_searches"`
	Pools     int64 `json:"talent_pools"`
	Sequences int64 `json:"sequences"`
	Campaigns int64 `json:"campaigns"`
}

func (s *SQLStore) OwnedResources(ctx context.Context, actor, target string) (OwnedResources, error) {
	var result OwnedResources
	if !validID(target) {
		return result, ErrNotFound
	}
	m, err := s.Owner(ctx, actor)
	if err != nil {
		return result, err
	}
	var belongs bool
	if err = s.db.QueryRow(ctx, `SELECT EXISTS(SELECT 1 FROM recruiter_profiles WHERE user_id=$1 AND company_id=$2)`, target, m.CompanyID).Scan(&belongs); err != nil {
		return result, err
	}
	if !belongs {
		return result, ErrNotFound
	}
	err = s.db.QueryRow(ctx, `SELECT
	 (SELECT count(*) FROM jobs WHERE company_id=$2 AND coalesce(assigned_recruiter_id,created_by_recruiter_id)=$1),
	 (SELECT count(*) FROM recruiter_saved_searches WHERE recruiter_id=$1),
	 (SELECT count(*) FROM recruiter_talent_pools WHERE company_id=$2 AND owner_id=$1),
	 (SELECT count(*) FROM outreach_sequences WHERE recruiter_id=$1),
	 (SELECT count(*) FROM outreach_campaigns WHERE recruiter_id=$1)`, target, m.CompanyID).Scan(&result.Jobs, &result.Searches, &result.Pools, &result.Sequences, &result.Campaigns)
	return result, err
}

// Handoff changes operational ownership, preserving creators, events, messages
// and usage attribution. Campaigns pause so a new owner cannot trigger sends.
func transferResourcesTx(ctx context.Context, tx pgx.Tx, m Member, target, to, reason string) error {
	if !m.Owner() {
		return ErrForbidden
	}
	if !validID(to) || to == target {
		return ErrInvalid
	}
	var role, status string
	var raw []byte
	var ready bool
	err := tx.QueryRow(ctx, `SELECT coalesce(cm.role,'legacy_recruiter'),coalesce(cm.status,'active'),coalesce(cm.scope,'{"all":true}'),u.is_active AND u.status='active' AND u.email_verified_at IS NOT NULL AND rp.verification_status='verified'
	 FROM recruiter_profiles rp JOIN users u ON u.id=rp.user_id LEFT JOIN company_memberships cm ON cm.user_id=rp.user_id AND cm.company_id=rp.company_id
	 WHERE rp.user_id=$1 AND rp.company_id=$2`, to, m.CompanyID).Scan(&role, &status, &raw, &ready)
	if err != nil {
		return ErrNotFound
	}
	var scope Scope
	if err = json.Unmarshal(raw, &scope); err != nil {
		return err
	}
	// Private sourcing objects have company-wide scope. A limited-scope member
	// cannot receive a bundle that would broaden their access.
	if !ready || status != "active" || role == "collaborator" || !scope.All {
		return ErrForbidden
	}
	var collision bool
	if err = tx.QueryRow(ctx, `SELECT EXISTS(SELECT 1 FROM outreach_campaigns old JOIN outreach_campaigns destination ON destination.recruiter_id=$2 AND destination.launch_idempotency_key=old.launch_idempotency_key WHERE old.recruiter_id=$1 AND old.launch_idempotency_key IS NOT NULL)`, target, to).Scan(&collision); err != nil {
		return err
	}
	if collision {
		return ErrInvalid
	}
	counts := map[string]int64{}
	for _, item := range []struct{ key, query string }{
		{"jobs", `UPDATE jobs SET assigned_recruiter_id=$2 WHERE company_id=$3 AND coalesce(assigned_recruiter_id,created_by_recruiter_id)=$1`},
		{"saved_searches", `UPDATE recruiter_saved_searches SET created_by_user_id=coalesce(created_by_user_id,recruiter_id),recruiter_id=$2 WHERE recruiter_id=$1`},
		{"talent_pools", `UPDATE recruiter_talent_pools SET created_by_user_id=coalesce(created_by_user_id,owner_id),owner_id=$2 WHERE owner_id=$1 AND company_id=$3`},
		{"templates", `UPDATE message_templates SET created_by_user_id=coalesce(created_by_user_id,recruiter_id),recruiter_id=$2 WHERE recruiter_id=$1`},
		{"conversations", `UPDATE chat_threads SET created_by_user_id=coalesce(created_by_user_id,recruiter_id),recruiter_id=$2 WHERE recruiter_id=$1`},
		{"sequences", `UPDATE outreach_sequences SET created_by_user_id=coalesce(created_by_user_id,recruiter_id),recruiter_id=$2 WHERE recruiter_id=$1`},
		{"campaigns", `UPDATE outreach_campaigns SET created_by_user_id=coalesce(created_by_user_id,recruiter_id),recruiter_id=$2,status=CASE WHEN status='running' THEN 'paused'::outreach_campaign_status ELSE status END WHERE recruiter_id=$1`},
	} {
		args := []any{target, to}
		if item.key == "jobs" || item.key == "talent_pools" {
			args = append(args, m.CompanyID)
		}
		command, e := tx.Exec(ctx, item.query, args...)
		if e != nil {
			return e
		}
		counts[item.key] = command.RowsAffected()
	}
	return companyAudit(ctx, tx, m.UserID, m.CompanyID, "team.resources_transferred", target, map[string]any{"to": to, "reason": reason, "resources": counts, "campaigns_paused": true})
}
