package company

import (
	"context"
	"github.com/jackc/pgx/v5"
	"time"
)

func LockCompanyTx(ctx context.Context, tx pgx.Tx, id string) error {
	_, err := tx.Exec(ctx, `SELECT id FROM companies WHERE id=$1 FOR UPDATE`, id)
	return err
}

// Capacity checks run in the same transaction as creation, serialized with
// policy changes. Existing objects are preserved when a lower limit is set.
func CheckCapacityTx(ctx context.Context, tx pgx.Tx, id, key string, additional int64) error {
	if additional <= 0 {
		return nil
	}
	if err := LockCompanyTx(ctx, tx, id); err != nil {
		return err
	}
	p, grants, err := readSubscription(ctx, tx, id)
	if err != nil {
		return err
	}
	limit := Resolve(p, grants, time.Now().UTC()).Limit(key, false)
	if limit == nil {
		return nil
	}
	query := ""
	switch key {
	case "active_jobs":
		query = `SELECT count(*) FROM jobs WHERE company_id=$1 AND status='active'`
	case "saved_searches":
		query = `SELECT count(*) FROM recruiter_saved_searches s JOIN recruiter_profiles rp ON rp.user_id=s.recruiter_id WHERE rp.company_id=$1`
	case "smart_pools":
		query = `SELECT count(*) FROM recruiter_talent_pools WHERE company_id=$1 AND kind='smart'`
	case "outreach_sequences":
		query = `SELECT count(*) FROM outreach_sequences s JOIN recruiter_profiles rp ON rp.user_id=s.recruiter_id WHERE rp.company_id=$1 AND s.status<>'archived'`
	default:
		return ErrInvalid
	}
	var used int64
	if err = tx.QueryRow(ctx, query, id).Scan(&used); err != nil {
		return err
	}
	if used+additional > *limit {
		return ErrLimit
	}
	return nil
}
