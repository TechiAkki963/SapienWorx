package company

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
	"time"
)

type SQLStore struct{ db *pgxpool.Pool }

func NewSQLStore(db *pgxpool.Pool) *SQLStore { return &SQLStore{db: db} }

type querier interface {
	QueryRow(context.Context, string, ...any) pgx.Row
	Query(context.Context, string, ...any) (pgx.Rows, error)
}

func readSubscription(ctx context.Context, db querier, id string) (Subscription, []Override, error) {
	s := Subscription{CompanyID: id}
	var features, capacity, usage, free []byte
	err := db.QueryRow(ctx, `SELECT COALESCE(s.managed,false),COALESCE(s.plan_name,'Existing access preserved'),COALESCE(s.state,'free'),s.period_start,s.period_end,s.grace_until,COALESCE(s.cancel_at_end,false),COALESCE(s.features,'{}'),COALESCE(s.capacity,'{}'),COALESCE(s.usage_limits,'{}'),COALESCE(s.free_capacity,'{}'),COALESCE(s.limits_approved,false) FROM companies c LEFT JOIN company_subscription_settings s ON s.company_id=c.id WHERE c.id=$1`, id).Scan(&s.Managed, &s.PlanName, &s.State, &s.PeriodStart, &s.PeriodEnd, &s.GraceUntil, &s.CancelAtEnd, &features, &capacity, &usage, &free, &s.LimitsApproved)
	if errors.Is(err, pgx.ErrNoRows) {
		return s, nil, ErrNotFound
	}
	if err != nil {
		return s, nil, err
	}
	for _, pair := range []struct {
		raw    []byte
		target any
	}{{features, &s.Features}, {capacity, &s.Capacity}, {usage, &s.Usage}, {free, &s.FreeCapacity}} {
		if err = json.Unmarshal(pair.raw, pair.target); err != nil {
			return s, nil, err
		}
	}
	rows, err := db.Query(ctx, `SELECT id,entitlement_key,enabled,additional,expires_at,reason FROM company_entitlement_overrides WHERE company_id=$1 AND revoked_at IS NULL AND expires_at>now() ORDER BY created_at,id`, id)
	if err != nil {
		return s, nil, err
	}
	defer rows.Close()
	grants := []Override{}
	for rows.Next() {
		var g Override
		if err = rows.Scan(&g.ID, &g.Key, &g.Enabled, &g.Additional, &g.ExpiresAt, &g.Reason); err != nil {
			return s, nil, err
		}
		grants = append(grants, g)
	}
	return s, grants, rows.Err()
}
func (s *SQLStore) Subscription(ctx context.Context, id string) (Subscription, []Override, error) {
	return readSubscription(ctx, s.db, id)
}
func (s *SQLStore) CompanyForRecruiter(ctx context.Context, userID string) (string, error) {
	var id string
	err := s.db.QueryRow(ctx, `SELECT rp.company_id FROM recruiter_profiles rp JOIN users u ON u.id=rp.user_id JOIN companies c ON c.id=rp.company_id WHERE rp.user_id=$1 AND rp.verification_status='verified' AND c.verification_status='verified' AND u.is_active AND u.status='active'`, userID).Scan(&id)
	if errors.Is(err, pgx.ErrNoRows) {
		err = ErrForbidden
	}
	return id, err
}
func (s *SQLStore) SetSubscription(ctx context.Context, actor string, in Subscription, reason string) error {
	if ValidateSubscription(in) != nil || len(reason) < 10 || len(reason) > 2000 {
		return ErrInvalid
	}
	tx, err := s.db.Begin(ctx)
	if err != nil {
		return err
	}
	defer tx.Rollback(ctx)
	var id string
	if err = tx.QueryRow(ctx, `SELECT id FROM companies WHERE id=$1 FOR UPDATE`, in.CompanyID).Scan(&id); errors.Is(err, pgx.ErrNoRows) {
		return ErrNotFound
	} else if err != nil {
		return err
	}
	blobs := [][]byte{}
	for _, v := range []any{in.Features, in.Capacity, in.Usage, in.FreeCapacity} {
		if v == nil {
			v = map[string]any{}
		}
		raw, e := json.Marshal(v)
		if e != nil {
			return e
		}
		if string(raw) == "null" {
			raw = []byte("{}")
		}
		blobs = append(blobs, raw)
	}
	_, err = tx.Exec(ctx, `INSERT INTO company_subscription_settings(company_id,managed,plan_name,state,period_start,period_end,grace_until,cancel_at_end,features,capacity,usage_limits,free_capacity,limits_approved,updated_by) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14) ON CONFLICT(company_id) DO UPDATE SET managed=EXCLUDED.managed,plan_name=EXCLUDED.plan_name,state=EXCLUDED.state,period_start=EXCLUDED.period_start,period_end=EXCLUDED.period_end,grace_until=EXCLUDED.grace_until,cancel_at_end=EXCLUDED.cancel_at_end,features=EXCLUDED.features,capacity=EXCLUDED.capacity,usage_limits=EXCLUDED.usage_limits,free_capacity=EXCLUDED.free_capacity,limits_approved=EXCLUDED.limits_approved,updated_by=EXCLUDED.updated_by,updated_at=now()`, id, in.Managed, in.PlanName, in.State, in.PeriodStart, in.PeriodEnd, in.GraceUntil, in.CancelAtEnd, blobs[0], blobs[1], blobs[2], blobs[3], in.LimitsApproved, actor)
	if err != nil {
		return err
	}
	if err = platformAudit(ctx, tx, actor, id, "company.subscription.updated", map[string]any{"reason": reason, "policy": in}); err != nil {
		return err
	}
	return tx.Commit(ctx)
}
func platformAudit(ctx context.Context, tx pgx.Tx, actor, id, action string, details any) error {
	raw, err := json.Marshal(details)
	if err != nil {
		return err
	}
	_, err = tx.Exec(ctx, `INSERT INTO admin_audit_logs(admin_id,action_type,target_entity_type,target_entity_id,metadata) VALUES($1,$2,'company',$3,$4)`, actor, action, id, raw)
	return err
}

// ConsumeUnlock serializes company usage with subscription changes. A profile is
// billed once per company/candidate/paid period, even across recruiters/retries.
func (s *SQLStore) ConsumeUnlock(ctx context.Context, actor, candidateID string) error {
	id, err := s.CompanyForRecruiter(ctx, actor)
	if err != nil {
		return err
	}
	tx, err := s.db.Begin(ctx)
	if err != nil {
		return err
	}
	defer tx.Rollback(ctx)
	if _, err = tx.Exec(ctx, `SELECT id FROM companies WHERE id=$1 FOR UPDATE`, id); err != nil {
		return err
	}
	if err = RequireFeatureTx(ctx, tx, actor, "talent.discovery"); err != nil {
		return err
	}
	policy, grants, err := readSubscription(ctx, tx, id)
	if err != nil {
		return err
	}
	e := Resolve(policy, grants, time.Now().UTC())
	if !e.Allows("talent.discovery") {
		return ErrInactive
	}
	if !e.Managed {
		return tx.Commit(ctx)
	}
	if e.PeriodStart == nil || e.PeriodEnd == nil {
		return ErrInactive
	}
	key := fmt.Sprintf("%s:%s", candidateID, e.PeriodStart.UTC().Format(time.RFC3339Nano))
	var exists bool
	if err = tx.QueryRow(ctx, `SELECT EXISTS(SELECT 1 FROM subscription_usage_events WHERE company_id=$1 AND meter_key='talent_profile_unlock' AND idempotency_key=$2)`, id, key).Scan(&exists); err != nil {
		return err
	}
	if exists {
		return tx.Commit(ctx)
	}
	var used int64
	if err = tx.QueryRow(ctx, `SELECT COALESCE(sum(quantity),0) FROM subscription_usage_events WHERE company_id=$1 AND meter_key='talent_profile_unlock' AND billing_period_start=$2`, id, e.PeriodStart).Scan(&used); err != nil {
		return err
	}
	if limit := e.Limit("talent_profile_unlock", true); limit != nil && used >= *limit {
		return ErrLimit
	}
	_, err = tx.Exec(ctx, `INSERT INTO subscription_usage_events(company_id,actor_user_id,candidate_id,meter_key,quantity,billing_period_start,billing_period_end,idempotency_key) VALUES($1,$2,$3,'talent_profile_unlock',1,$4,$5,$6) ON CONFLICT DO NOTHING`, id, actor, candidateID, e.PeriodStart, e.PeriodEnd, key)
	if err != nil {
		return err
	}
	return tx.Commit(ctx)
}
func (s *SQLStore) Usage(ctx context.Context, id string) (map[string]int64, error) {
	result := map[string]int64{}
	rows, err := s.db.Query(ctx, `SELECT meter_key,COALESCE(sum(quantity),0) FROM subscription_usage_events e JOIN company_subscription_settings s ON s.company_id=e.company_id WHERE e.company_id=$1 AND e.billing_period_start=s.period_start GROUP BY meter_key`, id)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	for rows.Next() {
		var key string
		var value int64
		if err = rows.Scan(&key, &value); err != nil {
			return nil, err
		}
		result[key] = value
	}
	return result, rows.Err()
}
