package emaildelivery

import (
	"context"
	"errors"
	"os"
	"testing"
	"time"

	"github.com/jackc/pgx/v5/pgxpool"
)

type qaProvider struct {
	suppressions map[string]Suppression
	sendErr      error
	sent         []Message
}

func (p *qaProvider) Send(_ context.Context, message Message) (string, error) {
	if p.sendErr != nil {
		return "", p.sendErr
	}
	p.sent = append(p.sent, message)
	return "qa-message-id", nil
}

func (p *qaProvider) Suppression(_ context.Context, email string) (Suppression, error) {
	if item, ok := p.suppressions[email]; ok {
		return item, nil
	}
	return Suppression{}, nil
}

func (p *qaProvider) Suppressions(context.Context) ([]SuppressedDestination, error) {
	return nil, nil
}

func (p *qaProvider) Account(context.Context) (AccountStatus, error) {
	return AccountStatus{Provider: "qa", Region: "ap-south-1", SendingEnabled: true}, nil
}

func TestP25EmailDeliverySuppressionAndRetryIsolatedDatabase(t *testing.T) {
	dsn := os.Getenv("MESSAGING_QA_TEST_DATABASE_URL")
	if dsn == "" {
		t.Skip("isolated messaging QA database not configured")
	}
	cfg, err := pgxpool.ParseConfig(dsn)
	if err != nil {
		t.Fatal(err)
	}
	if cfg.ConnConfig.Database != "sapienworx_ci" || (cfg.ConnConfig.Host != "127.0.0.1" && cfg.ConnConfig.Host != "localhost") {
		t.Fatal("refusing non-isolated database")
	}
	ctx := context.Background()
	db, err := pgxpool.NewWithConfig(ctx, cfg)
	if err != nil {
		t.Fatal(err)
	}
	defer db.Close()

	insert := func(email string) string {
		t.Helper()
		var id string
		err := db.QueryRow(ctx, `INSERT INTO email_outbox(kind,recipient_email,subject,text_body,html_body,expires_at)
			VALUES('p25_qa',$1,'P2.5 QA','Security message','<p>Security message</p>',now()+interval '10 minutes')
			RETURNING id::text`, email).Scan(&id)
		if err != nil {
			t.Fatal(err)
		}
		return id
	}

	t.Run("bounce is suppressed before send", func(t *testing.T) {
		email := "p25-bounce@example.invalid"
		id := insert(email)
		provider := &qaProvider{suppressions: map[string]Suppression{
			email: {Suppressed: true, Reason: "bounce", Detail: "qa bounce"},
		}}
		svc := NewService(db, provider, Config{Enabled: true, BatchSize: 10, MaxAttempts: 3})
		processed, err := svc.DispatchPass(ctx)
		if err != nil || processed != 1 {
			t.Fatalf("dispatch: processed=%d err=%v", processed, err)
		}
		if len(provider.sent) != 0 {
			t.Fatal("suppressed bounce was sent")
		}
		var status, reason string
		if err := db.QueryRow(ctx, `SELECT o.status,s.reason FROM email_outbox o JOIN email_suppressions s ON s.email=o.recipient_email WHERE o.id=$1`, id).Scan(&status, &reason); err != nil {
			t.Fatal(err)
		}
		if status != "suppressed" || reason != "bounce" {
			t.Fatalf("bounce state status=%s reason=%s", status, reason)
		}
	})

	t.Run("complaint is suppressed before send", func(t *testing.T) {
		email := "p25-complaint@example.invalid"
		id := insert(email)
		provider := &qaProvider{suppressions: map[string]Suppression{
			email: {Suppressed: true, Reason: "complaint", Detail: "qa complaint"},
		}}
		svc := NewService(db, provider, Config{Enabled: true, BatchSize: 10, MaxAttempts: 3})
		processed, err := svc.DispatchPass(ctx)
		if err != nil || processed != 1 {
			t.Fatalf("dispatch: processed=%d err=%v", processed, err)
		}
		var status, reason string
		if err := db.QueryRow(ctx, `SELECT o.status,s.reason FROM email_outbox o JOIN email_suppressions s ON s.email=o.recipient_email WHERE o.id=$1`, id).Scan(&status, &reason); err != nil {
			t.Fatal(err)
		}
		if status != "suppressed" || reason != "complaint" {
			t.Fatalf("complaint state status=%s reason=%s", status, reason)
		}
	})

	t.Run("successful send records provider message and event", func(t *testing.T) {
		email := "p25-success@example.invalid"
		id := insert(email)
		provider := &qaProvider{suppressions: map[string]Suppression{}}
		svc := NewService(db, provider, Config{Enabled: true, BatchSize: 10, MaxAttempts: 3})
		processed, err := svc.DispatchPass(ctx)
		if err != nil || processed != 1 {
			t.Fatalf("dispatch: processed=%d err=%v", processed, err)
		}
		if len(provider.sent) != 1 || provider.sent[0].To != email {
			t.Fatalf("provider sends=%+v", provider.sent)
		}
		var status, messageID string
		var events int
		if err := db.QueryRow(ctx, `SELECT status,provider_message_id FROM email_outbox WHERE id=$1`, id).Scan(&status, &messageID); err != nil {
			t.Fatal(err)
		}
		if err := db.QueryRow(ctx, `SELECT count(*) FROM email_delivery_events WHERE provider_message_id=$1 AND event_type='send'`, messageID).Scan(&events); err != nil {
			t.Fatal(err)
		}
		if status != "sent" || messageID != "qa-message-id" || events != 1 {
			t.Fatalf("send ledger status=%s message=%s events=%d", status, messageID, events)
		}
	})

	t.Run("transient provider failure schedules bounded retry", func(t *testing.T) {
		email := "p25-retry@example.invalid"
		id := insert(email)
		provider := &qaProvider{suppressions: map[string]Suppression{}, sendErr: errors.New("synthetic SES timeout")}
		svc := NewService(db, provider, Config{Enabled: true, BatchSize: 10, MaxAttempts: 3})
		before := time.Now().UTC()
		processed, err := svc.DispatchPass(ctx)
		if err != nil {
			t.Fatalf("dispatch pass should persist retry state, got %v", err)
		}
		if processed != 1 {
			t.Fatalf("processed=%d want 1", processed)
		}
		var status string
		var attempts int
		var next time.Time
		if err := db.QueryRow(ctx, `SELECT status,attempts,next_attempt_at FROM email_outbox WHERE id=$1`, id).Scan(&status, &attempts, &next); err != nil {
			t.Fatal(err)
		}
		if status != "failed" || attempts != 1 {
			t.Fatalf("retry state status=%s attempts=%d", status, attempts)
		}
		if next.Before(before.Add(50*time.Second)) || next.After(before.Add(90*time.Second)) {
			t.Fatalf("retry not bounded near 1 minute: %s", next.Sub(before))
		}
	})
}
