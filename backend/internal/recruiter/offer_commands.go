package recruiter

import (
	"context"
	"encoding/json"
	"strings"
	"time"

	"github.com/TechiAkki963/SapienWorx/backend/internal/company"
	"github.com/jackc/pgx/v5"
)

func resolveOfferApprovers(ctx context.Context, tx pgx.Tx, m company.Member, requester, job string, steps []OfferApprovalStep) ([][]string, error) {
	result := make([][]string, len(steps))
	seen := map[string]bool{}
	for i, step := range steps {
		ids := append([]string{}, step.UserIDs...)
		if step.Role != "" {
			rows, err := tx.Query(ctx, `SELECT cm.user_id FROM company_memberships cm JOIN users u ON u.id=cm.user_id WHERE cm.company_id=$1 AND cm.role=$2 AND cm.status='active' AND u.is_active AND u.status='active' AND ($3='' OR COALESCE((cm.scope->>'all')::boolean,false) OR cm.scope->'departments' ? $3) ORDER BY cm.user_id`, m.CompanyID, step.Role, step.Department)
			if err != nil {
				return nil, err
			}
			for rows.Next() {
				var id string
				if err = rows.Scan(&id); err != nil {
					rows.Close()
					return nil, err
				}
				if id != requester {
					ids = append(ids, id)
				}
			}
			err = rows.Err()
			rows.Close()
			if err != nil {
				return nil, err
			}
		}
		if len(ids) == 0 || len(ids) > 20 {
			return nil, ErrOfferApproval
		}
		for _, id := range ids {
			if id == requester || seen[id] {
				return nil, ErrOfferApproval
			}
			reviewer, err := company.MemberTx(ctx, tx, id)
			if err != nil || reviewer.CompanyID != m.CompanyID || !company.JobAllowedTx(ctx, tx, reviewer, job) {
				return nil, ErrOfferApproval
			}
			allowed, err := offerPermission(ctx, tx, reviewer, "offer.approve")
			if err != nil {
				return nil, err
			}
			canRead, err := offerPermission(ctx, tx, reviewer, "offer.view_compensation")
			if err != nil {
				return nil, err
			}
			if !allowed || !canRead {
				return nil, ErrOfferApproval
			}
			seen[id] = true
			result[i] = append(result[i], id)
		}
	}
	return result, nil
}
func (s *sqlOfferStore) Command(ctx context.Context, actor, id string, candidate bool, in OfferCommand) (GovernedOffer, error) {
	if !validUUID(id) || len(in.Reason) > 2000 || in.ExpectedVersion < 1 || in.ExpectedRevision < 1 || len(in.TermsHash) != 64 {
		return GovernedOffer{}, ErrInvalid
	}
	tx, err := s.db.Begin(ctx)
	if err != nil {
		return GovernedOffer{}, err
	}
	defer tx.Rollback(ctx)
	var m company.Member
	var companyID, requester string
	var currentVersion int
	// Tenant row first, then company lock, then authoritative membership/version.
	query := `SELECT o.company_id,o.active_version FROM recruiter_offers o JOIN applications a ON a.id=o.application_id JOIN jobs j ON j.id=a.job_id WHERE o.id=$1 AND j.company_id=o.company_id`
	if candidate {
		query += ` AND a.candidate_id=$2 AND EXISTS(SELECT 1 FROM users u WHERE u.id=$2 AND u.is_active AND u.status='active')`
		err = tx.QueryRow(ctx, query, id, actor).Scan(&companyID, &currentVersion)
	} else {
		m, err = company.MemberTx(ctx, tx, actor)
		if err != nil {
			return GovernedOffer{}, err
		}
		query += ` AND o.company_id=$2`
		err = tx.QueryRow(ctx, query, id, m.CompanyID).Scan(&companyID, &currentVersion)
	}
	if err != nil {
		return GovernedOffer{}, offerError(err)
	}
	if err = company.LockCompanyTx(ctx, tx, companyID); err != nil {
		return GovernedOffer{}, err
	}
	if !candidate {
		m, err = company.MemberTx(ctx, tx, actor)
		if err != nil {
			return GovernedOffer{}, err
		}
	} else {
		m = company.Member{CompanyID: companyID, UserID: actor}
	}
	request := struct {
		ID        string
		Candidate bool
		Input     OfferCommand
	}{id, candidate, in}
	if previous, cached, e := cachedOfferCommand(ctx, tx, companyID, actor, in.CommandKey, request); e != nil {
		return GovernedOffer{}, e
	} else if cached {
		tx.Rollback(ctx)
		return s.Offer(ctx, actor, previous, candidate)
	}
	x, err := loadOffer(ctx, tx, m, id, candidate, actor)
	if err != nil {
		return GovernedOffer{}, err
	}
	if x.ActiveVersion != in.ExpectedVersion || x.Revision != in.ExpectedRevision || x.TermsHash != in.TermsHash {
		return GovernedOffer{}, ErrOfferStale
	}
	var policyRaw []byte
	var expiry *time.Time
	if err = tx.QueryRow(ctx, `SELECT v.approval_policy,v.created_by,v.expires_at FROM governed_offer_versions v JOIN recruiter_offers o ON o.id=v.offer_id WHERE v.offer_id=$1 AND v.version=o.active_version FOR UPDATE OF v,o`, id).Scan(&policyRaw, &requester, &expiry); err != nil {
		return GovernedOffer{}, offerError(err)
	}
	var policy OfferApprovalPolicy
	if err = json.Unmarshal(policyRaw, &policy); err != nil {
		return GovernedOffer{}, err
	}
	if err = ValidateOfferPolicy(policy); err != nil {
		return GovernedOffer{}, err
	}
	status := x.Status
	reason := strings.TrimSpace(in.Reason)
	if candidate {
		if !validEnum(in.Action, "view", "accept", "decline", "clarification") || !validEnum(status, "sent", "viewed") {
			return GovernedOffer{}, ErrInvalid
		}
		if expiry != nil && time.Now().UTC().After(expiry.Add(24*time.Hour)) {
			return GovernedOffer{}, ErrOfferStale
		}
		switch in.Action {
		case "view":
			status = "viewed"
		case "accept":
			status = "accepted"
		case "decline":
			status = "declined"
		case "clarification":
			if len(reason) < 5 {
				return GovernedOffer{}, ErrInvalid
			}
		}
	} else {
		permission := "offer.edit"
		switch in.Action {
		case "send":
			permission = "offer.send"
		case "withdraw", "cancel":
			permission = "offer.withdraw"
		case "approve", "reject", "request_changes":
			permission = "offer.approve"
		case "submit":
			permission = "offer.edit"
		case "preview":
			permission = "offer.download_documents"
		default:
			return GovernedOffer{}, ErrInvalid
		}
		if err = requireOfferPermission(ctx, tx, m, permission); err != nil {
			return GovernedOffer{}, err
		}
		if validEnum(in.Action, "submit", "send") {
			if err = requireOfferFeature(ctx, tx, m, "offers.studio"); err != nil {
				return GovernedOffer{}, err
			}
			if err = requireOfferPermission(ctx, tx, m, "offer.view_compensation"); err != nil {
				return GovernedOffer{}, err
			}
		}
		switch in.Action {
		case "preview":
			if x.Snapshot == nil || x.Snapshot.Incomplete {
				return GovernedOffer{}, ErrInvalid
			}
			if err = requireOfferPermission(ctx, tx, m, "offer.view_compensation"); err != nil {
				return GovernedOffer{}, err
			}
			if err = s.ensureLetter(ctx, tx, m, x); err != nil {
				return GovernedOffer{}, err
			}
		case "submit":
			if status != "draft" {
				return GovernedOffer{}, ErrInvalid
			}
			// Review evidence belongs to immutable terms. A change request must
			// produce a new version; old decisions cannot be reset or overwritten.
			var reviewed bool
			if err = tx.QueryRow(ctx, `SELECT EXISTS(SELECT 1 FROM offer_approval_requests WHERE offer_id=$1 AND version=$2 AND decision<>'pending')`, id, x.ActiveVersion).Scan(&reviewed); err != nil {
				return GovernedOffer{}, err
			}
			if reviewed {
				return GovernedOffer{}, ErrOfferApproval
			}
			if x.Snapshot == nil {
				return GovernedOffer{}, ErrOfferForbidden
			}
			if x.Snapshot.Incomplete {
				return GovernedOffer{}, ErrInvalid
			}
			if _, err = CalculateOfferFields(x.Snapshot.Currency, x.Snapshot.Fields, x.Snapshot.Values); err != nil {
				return GovernedOffer{}, err
			}
			facts, kinds := offerPolicyFacts(*x.Snapshot)
			steps, err := offerPolicySteps(policy, facts, kinds)
			if err != nil {
				return GovernedOffer{}, err
			}
			if len(steps) > 0 {
				if err = requireOfferFeature(ctx, tx, m, "offers.approvals"); err != nil {
					return GovernedOffer{}, err
				}
				if policy.Mode != "single" {
					if err = requireOfferFeature(ctx, tx, m, "offers."+policy.Mode+"_approvals"); err != nil {
						return GovernedOffer{}, err
					}
				}
				effective, err := company.EffectiveTx(ctx, tx, companyID)
				if err != nil {
					return GovernedOffer{}, err
				}
				if limit := effective.Limit("offer_approval_steps", false); limit != nil && int64(len(steps)) > *limit {
					return GovernedOffer{}, company.ErrLimit
				}
				reviewers, err := resolveOfferApprovers(ctx, tx, m, requester, x.JobID, steps)
				if err != nil {
					return GovernedOffer{}, err
				}
				for i, ids := range reviewers {
					for _, reviewer := range ids {
						if _, err = tx.Exec(ctx, `INSERT INTO offer_approval_requests(offer_id,version,company_id,step,approver_id) VALUES($1,$2,$3,$4,$5) ON CONFLICT DO NOTHING`, id, x.ActiveVersion, companyID, i+1, reviewer); err != nil {
							return GovernedOffer{}, err
						}
						if _, err = tx.Exec(ctx, `INSERT INTO recruiter_notifications(recipient_id,company_id,category,title,message,entity_type,entity_id) VALUES($1,$2,'offers','Offer approval required','An offer is ready for your review.','offer',$3)`, reviewer, companyID, id); err != nil {
							return GovernedOffer{}, err
						}
					}
				}
				status = "awaiting_approval"
			} else {
				status = "approved"
			}
		case "approve", "reject", "request_changes":
			if status != "awaiting_approval" || actor == requester {
				return GovernedOffer{}, ErrOfferApproval
			}
			if err = requireOfferPermission(ctx, tx, m, "offer.view_compensation"); err != nil {
				return GovernedOffer{}, err
			}
			var step int
			err = tx.QueryRow(ctx, `SELECT step FROM offer_approval_requests WHERE offer_id=$1 AND version=$2 AND approver_id=$3 AND decision='pending'`, id, x.ActiveVersion, actor).Scan(&step)
			if err != nil {
				return GovernedOffer{}, ErrOfferApproval
			}
			if validEnum(policy.Mode, "sequential", "conditional") {
				var previousPending bool
				if err = tx.QueryRow(ctx, `SELECT EXISTS(SELECT 1 FROM offer_approval_requests WHERE offer_id=$1 AND version=$2 AND step<$3 AND decision<>'approved')`, id, x.ActiveVersion, step).Scan(&previousPending); err != nil {
					return GovernedOffer{}, err
				}
				if previousPending {
					return GovernedOffer{}, ErrOfferApproval
				}
			}
			decision := "approved"
			if in.Action == "reject" {
				decision = "rejected"
				status = "cancelled"
			}
			if in.Action == "request_changes" {
				decision = "changes_requested"
				status = "draft"
			}
			if decision != "approved" && len(reason) < 10 {
				return GovernedOffer{}, ErrInvalid
			}
			if _, err = tx.Exec(ctx, `UPDATE offer_approval_requests SET decision=$4,reason=$5,acted_at=now() WHERE offer_id=$1 AND version=$2 AND approver_id=$3 AND decision='pending'`, id, x.ActiveVersion, actor, decision, reason); err != nil {
				return GovernedOffer{}, err
			}
			var pending bool
			if err = tx.QueryRow(ctx, `SELECT EXISTS(SELECT 1 FROM offer_approval_requests WHERE offer_id=$1 AND version=$2 AND decision<>'approved')`, id, x.ActiveVersion).Scan(&pending); err != nil {
				return GovernedOffer{}, err
			}
			if !pending {
				status = "approved"
			}
		case "send":
			if status != "approved" || expiry == nil || time.Now().UTC().After(expiry.Add(24*time.Hour)) {
				return GovernedOffer{}, ErrOfferApproval
			}
			var stage string
			if err = tx.QueryRow(ctx, `SELECT stage::text FROM applications WHERE id=$1 FOR UPDATE`, x.ApplicationID).Scan(&stage); err != nil {
				return GovernedOffer{}, err
			}
			if stage != "offer" {
				return GovernedOffer{}, ErrInvalid
			}
			var rejected bool
			if err = tx.QueryRow(ctx, `SELECT EXISTS(SELECT 1 FROM offer_approval_requests WHERE offer_id=$1 AND version=$2 AND decision<>'approved')`, id, x.ActiveVersion).Scan(&rejected); err != nil {
				return GovernedOffer{}, err
			}
			if rejected {
				return GovernedOffer{}, ErrOfferApproval
			}
			if err = offerQuota(ctx, tx, m, "offer_monthly_sends", 1); err != nil {
				return GovernedOffer{}, err
			}
			if err = s.ensureLetter(ctx, tx, m, x); err != nil {
				return GovernedOffer{}, err
			}
			status = "sent"
			if _, err = tx.Exec(ctx, `INSERT INTO candidate_notifications(candidate_id,kind,title,body,action_url) VALUES($1,'offer','Your offer is ready','Review your offer and respond in your secure candidate workspace.',$2)`, x.CandidateID, "/candidate/offers/"+id); err != nil {
				return GovernedOffer{}, err
			}
		case "withdraw", "cancel":
			if validEnum(status, "accepted", "declined", "withdrawn", "expired", "cancelled") || len(reason) < 10 {
				return GovernedOffer{}, ErrInvalid
			}
			status = "withdrawn"
			if in.Action == "cancel" && validEnum(x.Status, "draft", "awaiting_approval", "approved") {
				status = "cancelled"
			}
		}
	}
	evidence := map[string]any{}
	if candidate && validEnum(in.Action, "accept", "decline") {
		evidence = map[string]any{"candidate_id": actor, "version": x.ActiveVersion, "terms_hash": x.TermsHash, "decision": in.Action, "reason": reason, "recorded_at": time.Now().UTC()}
	}
	raw, err := json.Marshal(evidence)
	if err != nil {
		return GovernedOffer{}, err
	}
	_, err = tx.Exec(ctx, `UPDATE governed_offer_versions SET status=$3,revision=revision+1,sent_at=CASE WHEN $4='send' THEN now() ELSE sent_at END,viewed_at=CASE WHEN $4='view' THEN COALESCE(viewed_at,now()) ELSE viewed_at END,responded_at=CASE WHEN $5 THEN now() ELSE responded_at END,response_evidence=CASE WHEN $5 THEN $6::jsonb ELSE response_evidence END WHERE offer_id=$1 AND version=$2`, id, x.ActiveVersion, status, in.Action, candidate && validEnum(in.Action, "accept", "decline"), raw)
	if err != nil {
		return GovernedOffer{}, err
	}
	_, err = tx.Exec(ctx, `UPDATE recruiter_offers SET status=$2,updated_at=now(),sent_at=CASE WHEN $3='send' THEN now() ELSE sent_at END,responded_at=CASE WHEN $4 THEN now() ELSE responded_at END WHERE id=$1`, id, status, in.Action, candidate && validEnum(in.Action, "accept", "decline"))
	if err != nil {
		return GovernedOffer{}, err
	}
	event := in.Action
	if event == "send" {
		event = "sent"
	}
	if err = offerEvent(ctx, tx, companyID, id, actor, event, x.ActiveVersion, map[string]any{"reason": reason, "terms_hash": x.TermsHash, "previous_status": x.Status, "status": status}); err != nil {
		return GovernedOffer{}, err
	}
	if candidate && validEnum(in.Action, "accept", "decline", "clarification") {
		if _, err = tx.Exec(ctx, `INSERT INTO recruiter_notifications(recipient_id,company_id,category,title,message,entity_type,entity_id) VALUES($1,$2,'offers','Candidate responded to an offer','Open the secure offer workspace to review the response.','offer',$3)`, requester, companyID, id); err != nil {
			return GovernedOffer{}, err
		}
	}
	if err = recordOfferCommand(ctx, tx, companyID, actor, in.CommandKey, id, request); err != nil {
		return GovernedOffer{}, err
	}
	if err = tx.Commit(ctx); err != nil {
		return GovernedOffer{}, err
	}
	return s.Offer(ctx, actor, id, candidate)
}

func (s *Service) ExpireGovernedOffers(ctx context.Context, limit int) (int, error) {
	if limit < 1 || limit > 100 {
		limit = 50
	}
	rows, err := s.db.Query(ctx, `SELECT DISTINCT o.company_id FROM recruiter_offers o JOIN governed_offer_versions v ON v.offer_id=o.id AND v.version=o.active_version WHERE o.status IN ('sent','viewed') AND v.expires_at<(now() AT TIME ZONE 'UTC')::date ORDER BY o.company_id LIMIT $1`, limit)
	if err != nil {
		return 0, err
	}
	companies := []string{}
	for rows.Next() {
		var id string
		if err = rows.Scan(&id); err != nil {
			rows.Close()
			return 0, err
		}
		companies = append(companies, id)
	}
	err = rows.Err()
	rows.Close()
	if err != nil {
		return 0, err
	}
	count := 0
	for _, id := range companies {
		tx, err := s.db.Begin(ctx)
		if err != nil {
			return count, err
		}
		if err = company.LockCompanyTx(ctx, tx, id); err != nil {
			tx.Rollback(ctx)
			return count, err
		}
		_, err = tx.Exec(ctx, `WITH expired AS (SELECT o.id,o.active_version FROM recruiter_offers o JOIN governed_offer_versions v ON v.offer_id=o.id AND v.version=o.active_version WHERE o.company_id=$1 AND o.status IN ('sent','viewed') AND v.expires_at<(now() AT TIME ZONE 'UTC')::date ORDER BY o.id LIMIT $2 FOR UPDATE OF o,v), versions AS (UPDATE governed_offer_versions v SET status='expired',revision=revision+1 FROM expired e WHERE v.offer_id=e.id AND v.version=e.active_version RETURNING v.offer_id,v.version), offers AS (UPDATE recruiter_offers o SET status='expired',updated_at=now() FROM versions v WHERE o.id=v.offer_id RETURNING o.id) INSERT INTO governed_offer_events(company_id,offer_id,version,kind) SELECT $1,v.offer_id,v.version,'expired' FROM versions v JOIN offers o ON o.id=v.offer_id`, id, limit)
		if err != nil {
			tx.Rollback(ctx)
			return count, err
		}
		if err = tx.Commit(ctx); err != nil {
			return count, err
		}
		count++
	}
	return count, nil
}
