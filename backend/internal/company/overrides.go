package company

import (
	"context"
	"github.com/jackc/pgx/v5"
	"strings"
	"time"
)

func (s *SQLStore) GrantOverride(ctx context.Context, actor, id string, in Override) error {
	in.Reason = strings.TrimSpace(in.Reason)
	if len(in.Reason) < 10 || len(in.Reason) > 2000 || !in.ExpiresAt.After(time.Now()) || in.ExpiresAt.After(time.Now().Add(365*24*time.Hour)) || (in.Enabled == nil) == (in.Additional == nil) {
		return ErrInvalid
	}
	if in.Enabled != nil && !contains(PremiumFeatures, in.Key) {
		return ErrInvalid
	}
	if in.Additional != nil && (!contains(CapacityKeys, in.Key) && !contains(UsageKeys, in.Key) || *in.Additional < 1 || *in.Additional > 1000000000) {
		return ErrInvalid
	}
	tx, err := s.db.Begin(ctx)
	if err != nil {
		return err
	}
	defer tx.Rollback(ctx)
	var tenant string
	if err = tx.QueryRow(ctx, `SELECT id FROM companies WHERE id=$1 FOR UPDATE`, id).Scan(&tenant); err != nil {
		return ErrNotFound
	}
	var grant string
	err = tx.QueryRow(ctx, `INSERT INTO company_entitlement_overrides(company_id,entitlement_key,enabled,additional,expires_at,reason,created_by) VALUES($1,$2,$3,$4,$5,$6,$7) RETURNING id`, id, in.Key, in.Enabled, in.Additional, in.ExpiresAt, in.Reason, actor).Scan(&grant)
	if err != nil {
		return err
	}
	if err = platformAudit(ctx, tx, actor, id, "company.entitlement.granted", map[string]any{"grant_id": grant, "key": in.Key, "expires_at": in.ExpiresAt, "reason": in.Reason}); err != nil {
		return err
	}
	return tx.Commit(ctx)
}
func (s *SQLStore) OwnTalentSeat(ctx context.Context, actor string, enabled bool, reason string) error {
	m, err := s.Owner(ctx, actor)
	if err != nil {
		return err
	}
	if len(strings.TrimSpace(reason)) < 10 || len(reason) > 2000 {
		return ErrInvalid
	}
	tx, err := s.db.BeginTx(ctx, pgx.TxOptions{})
	if err != nil {
		return err
	}
	defer tx.Rollback(ctx)
	if _, err = tx.Exec(ctx, `SELECT id FROM companies WHERE id=$1 FOR UPDATE`, m.CompanyID); err != nil {
		return err
	}
	if err = checkMemberCapacity(ctx, tx, m.CompanyID, actor, "primary_admin", enabled); err != nil {
		return err
	}
	if _, err = tx.Exec(ctx, `UPDATE company_memberships SET talent_seat=$3 WHERE company_id=$1 AND user_id=$2 AND role='primary_admin'`, m.CompanyID, actor, enabled); err != nil {
		return err
	}
	if err = companyAudit(ctx, tx, actor, m.CompanyID, "team.owner_talent_seat", actor, map[string]any{"enabled": enabled, "reason": reason}); err != nil {
		return err
	}
	return tx.Commit(ctx)
}
