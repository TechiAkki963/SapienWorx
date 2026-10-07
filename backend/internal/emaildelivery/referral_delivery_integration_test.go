package emaildelivery

import (
	"context"
	"errors"
	"github.com/jackc/pgx/v5/pgxpool"
	"os"
	"testing"
	"time"
)

type referralTestProvider struct{ sends int }

func (p *referralTestProvider) Send(context.Context, Message) (string, error) {
	p.sends++
	return "synthetic-message", nil
}
func (p *referralTestProvider) Suppression(context.Context, string) (Suppression, error) {
	return Suppression{}, nil
}
func (p *referralTestProvider) Suppressions(context.Context) ([]SuppressedDestination, error) {
	return nil, nil
}
func (p *referralTestProvider) Account(context.Context) (AccountStatus, error) {
	return AccountStatus{}, nil
}
func TestReferralDeliveryFailureDoesNotSuppressRetriableContent(t *testing.T) {
	dsn := os.Getenv("RECRUITER_PRODUCT_SCALE_TEST_DATABASE_URL")
	if dsn == "" {
		t.Skip("isolated local database not configured")
	}
	cfg, err := pgxpool.ParseConfig(dsn)
	if err != nil {
		t.Fatal(err)
	}
	if cfg.ConnConfig.Host != "127.0.0.1" || cfg.ConnConfig.Database != "sapienworx_ci" {
		t.Fatal("refusing non-local database")
	}
	ctx, cancel := context.WithTimeout(context.Background(), 30*time.Second)
	defer cancel()
	db, err := pgxpool.NewWithConfig(ctx, cfg)
	if err != nil {
		t.Fatal(err)
	}
	defer db.Close()
	var id string
	err = db.QueryRow(ctx, `INSERT INTO email_outbox(kind,recipient_email,subject,text_body,expires_at) VALUES('referral_invitation','synthetic@example.test','QA','[secure content resolved at dispatch]',now()+interval '1 day') RETURNING id::text`).Scan(&id)
	if err != nil {
		t.Fatal(err)
	}
	defer db.Exec(context.Background(), `DELETE FROM email_outbox WHERE id=$1`, id)
	provider := &referralTestProvider{}
	svc := NewService(db, provider, Config{Enabled: true})
	item := queuedMessage{ID: id, Kind: "referral_invitation", Recipient: "synthetic@example.test", Subject: "QA", Attempts: 1, DedupeKey: "synthetic"}
	svc.SetReferralContentResolver(func(context.Context, string, string) (string, error) {
		return "", errors.New("temporary database failure with sensitive details")
	})
	if err = svc.dispatchOne(ctx, item); err != nil {
		t.Fatal(err)
	}
	var status, detail string
	err = db.QueryRow(ctx, `SELECT status,last_error FROM email_outbox WHERE id=$1`, id).Scan(&status, &detail)
	if err != nil {
		t.Fatal(err)
	}
	if status != "failed" || detail != "secure referral delivery lookup failed" || provider.sends != 0 {
		t.Fatalf("transient failure must retry safely: %s %s sends=%d", status, detail, provider.sends)
	}
	svc.SetReferralContentResolver(func(context.Context, string, string) (string, error) { return "", ErrContentUnavailable })
	if err = svc.dispatchOne(ctx, item); err != nil {
		t.Fatal(err)
	}
	if err = db.QueryRow(ctx, `SELECT status FROM email_outbox WHERE id=$1`, id).Scan(&status); err != nil {
		t.Fatal(err)
	}
	if status != "suppressed" || provider.sends != 0 {
		t.Fatal("revoked content must never send")
	}
}
