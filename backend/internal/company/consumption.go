package company

import (
	"context"
	"github.com/jackc/pgx/v5"
	"time"
)

// RequireFeatureTx shares the company lock with policy writes and consumption.
// Background work rechecks access immediately before persisting a delivery.
func RequireFeatureTx(ctx context.Context, tx pgx.Tx, userID, feature string) error {
	var id string
	var active, seat bool
	err := tx.QueryRow(ctx, `SELECT rp.company_id,COALESCE(m.status='active',true) AND u.is_active AND u.status='active' AND rp.verification_status='verified' AND c.verification_status='verified' AND COALESCE(m.role<>'collaborator',true) AND COALESCE((m.scope->>'all')::boolean,true),COALESCE(m.talent_seat,true) FROM recruiter_profiles rp JOIN users u ON u.id=rp.user_id JOIN companies c ON c.id=rp.company_id LEFT JOIN company_memberships m ON m.user_id=rp.user_id AND m.company_id=rp.company_id WHERE rp.user_id=$1`, userID).Scan(&id, &active, &seat)
	if err != nil {
		return err
	}
	if !active || !seat {
		return ErrInactive
	}
	if _, err = tx.Exec(ctx, `SELECT id FROM companies WHERE id=$1 FOR UPDATE`, id); err != nil {
		return err
	}
	p, grants, err := readSubscription(ctx, tx, id)
	if err != nil {
		return err
	}
	if !Resolve(p, grants, time.Now().UTC()).Allows(feature) {
		return ErrInactive
	}
	return nil
}
func capacityForMember(role string) string {
	if role == "sub_admin" {
		return "sub_admins"
	}
	if role == "recruiter" || role == "legacy_recruiter" {
		return "recruiters"
	}
	return ""
}
func checkMemberCapacity(ctx context.Context, tx pgx.Tx, id, userID, role string, talent bool) error {
	p, grants, err := readSubscription(ctx, tx, id)
	if err != nil {
		return err
	}
	e := Resolve(p, grants, time.Now().UTC())
	key := capacityForMember(role)
	if key != "" {
		if limit := e.Limit(key, false); limit != nil {
			var used int64
			if err = tx.QueryRow(ctx, `SELECT count(*) FROM recruiter_profiles rp JOIN users u ON u.id=rp.user_id LEFT JOIN company_memberships m ON m.user_id=rp.user_id WHERE rp.company_id=$1 AND rp.user_id<>$2 AND u.is_active AND u.status IN('active','pending_verification') AND COALESCE(m.status,'active')='active' AND CASE WHEN COALESCE(m.role,'recruiter')='sub_admin' THEN 'sub_admins' WHEN COALESCE(m.role,'recruiter')='recruiter' THEN 'recruiters' ELSE '' END=$3`, id, userID, key).Scan(&used); err != nil {
				return err
			}
			if used >= *limit {
				return ErrLimit
			}
		}
	}
	if talent {
		if !e.Allows("talent.discovery") {
			return ErrInactive
		}
		if limit := e.Limit("talent_seats", false); limit != nil {
			var used int64
			if err = tx.QueryRow(ctx, `SELECT count(*) FROM recruiter_profiles rp JOIN users u ON u.id=rp.user_id LEFT JOIN company_memberships m ON m.user_id=rp.user_id WHERE rp.company_id=$1 AND rp.user_id<>$2 AND u.is_active AND u.status IN('active','pending_verification') AND COALESCE(m.status,'active')='active' AND COALESCE(m.talent_seat,true)`, id, userID).Scan(&used); err != nil {
				return err
			}
			if used >= *limit {
				return ErrLimit
			}
		}
	}
	return nil
}
func (s *SQLStore) HiringRelationship(ctx context.Context, userID, candidateID string) (bool, error) {
	var exists bool
	err := s.db.QueryRow(ctx, `SELECT EXISTS(SELECT 1 FROM applications a JOIN jobs j ON j.id=a.job_id JOIN recruiter_profiles rp ON rp.company_id=j.company_id WHERE rp.user_id=$1 AND a.candidate_id=$2) OR EXISTS(SELECT 1 FROM chat_threads t JOIN recruiter_profiles participant ON participant.user_id=t.recruiter_id JOIN recruiter_profiles viewer ON viewer.company_id=participant.company_id WHERE viewer.user_id=$1 AND t.candidate_id=$2 AND EXISTS(SELECT 1 FROM chat_messages message WHERE message.thread_id=t.id))`, userID, candidateID).Scan(&exists)
	return exists, err
}

func ConsumeOutreachTx(ctx context.Context, tx pgx.Tx, userID string, quantity int, key string) error {
	if quantity == 0 {
		return nil
	}
	if quantity < 0 || quantity > 1000 || len(key) > 140 {
		return ErrInvalid
	}
	if err := RequireFeatureTx(ctx, tx, userID, "talent.outreach"); err != nil {
		return err
	}
	var id string
	if err := tx.QueryRow(ctx, `SELECT company_id FROM recruiter_profiles WHERE user_id=$1`, userID).Scan(&id); err != nil {
		return err
	}
	p, grants, err := readSubscription(ctx, tx, id)
	if err != nil {
		return err
	}
	e := Resolve(p, grants, time.Now().UTC())
	if !e.Managed {
		return nil
	}
	if e.PeriodStart == nil || e.PeriodEnd == nil {
		return ErrInactive
	}
	key = key + ":" + e.PeriodStart.UTC().Format(time.RFC3339Nano)
	var exists bool
	if err = tx.QueryRow(ctx, `SELECT EXISTS(SELECT 1 FROM subscription_usage_events WHERE company_id=$1 AND meter_key='outreach_message' AND idempotency_key=$2)`, id, key).Scan(&exists); err != nil {
		return err
	}
	if exists {
		return nil
	}
	var used int64
	if err = tx.QueryRow(ctx, `SELECT COALESCE(sum(quantity),0) FROM subscription_usage_events WHERE company_id=$1 AND meter_key='outreach_message' AND billing_period_start=$2`, id, e.PeriodStart).Scan(&used); err != nil {
		return err
	}
	if limit := e.Limit("outreach_message", true); limit != nil && used+int64(quantity) > *limit {
		return ErrLimit
	}
	_, err = tx.Exec(ctx, `INSERT INTO subscription_usage_events(company_id,actor_user_id,meter_key,quantity,billing_period_start,billing_period_end,idempotency_key) VALUES($1,$2,'outreach_message',$3,$4,$5,$6) ON CONFLICT DO NOTHING`, id, userID, quantity, e.PeriodStart, e.PeriodEnd, key)
	return err
}
