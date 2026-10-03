package emaildelivery

import (
	"context"
	"errors"
	"fmt"
	"strings"
	"time"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
)

type Config struct {
	Enabled      bool
	PollInterval time.Duration
	BatchSize    int
	MaxAttempts  int
}

type Service struct {
	db       *pgxpool.Pool
	provider Provider
	cfg      Config
	now      func() time.Time
}

type Health struct {
	Enabled         bool          `json:"enabled"`
	Provider        AccountStatus `json:"provider"`
	Pending         int64         `json:"pending"`
	Failed          int64         `json:"failed"`
	Sent24H         int64         `json:"sent_24h"`
	Suppressed      int64         `json:"suppressed"`
	Bounces         int64         `json:"bounces"`
	Complaints      int64         `json:"complaints"`
	OldestPendingAt *time.Time    `json:"oldest_pending_at,omitempty"`
	CheckedAt       time.Time     `json:"checked_at"`
}

type queuedMessage struct {
	ID        string
	Kind      string
	Recipient string
	Subject   string
	TextBody  string
	HTMLBody  *string
	Attempts  int
}

func NewService(db *pgxpool.Pool, provider Provider, cfg Config) *Service {
	if cfg.PollInterval <= 0 {
		cfg.PollInterval = 5 * time.Second
	}
	if cfg.BatchSize < 1 {
		cfg.BatchSize = 10
	}
	if cfg.BatchSize > 50 {
		cfg.BatchSize = 50
	}
	if cfg.MaxAttempts < 1 {
		cfg.MaxAttempts = 5
	}
	return &Service{db: db, provider: provider, cfg: cfg, now: time.Now}
}

func (s *Service) Enabled() bool {
	return s != nil && s.cfg.Enabled && s.provider != nil
}

func (s *Service) PollInterval() time.Duration {
	if s == nil {
		return 5 * time.Second
	}
	return s.cfg.PollInterval
}

func (s *Service) DispatchPass(ctx context.Context) (int, error) {
	if !s.Enabled() {
		return 0, nil
	}
	items, err := s.claim(ctx)
	if err != nil {
		return 0, err
	}
	processed := 0
	for _, item := range items {
		if err := s.dispatchOne(ctx, item); err != nil {
			return processed, err
		}
		processed++
	}
	return processed, nil
}

func (s *Service) claim(ctx context.Context) ([]queuedMessage, error) {
	tx, err := s.db.BeginTx(ctx, pgx.TxOptions{})
	if err != nil {
		return nil, err
	}
	defer tx.Rollback(ctx)

	// Recover rows left in sending by a process crash. A 5-minute lease is well above the provider HTTP timeout.
	if _, err = tx.Exec(ctx, `UPDATE email_outbox
		SET status='failed',
		    last_error=COALESCE(last_error,'delivery worker lease expired'),
		    next_attempt_at=now()
		WHERE status='sending' AND updated_at<now()-interval '5 minutes'`); err != nil {
		return nil, err
	}

	rows, err := tx.Query(ctx, `SELECT id,kind,recipient_email,subject,text_body,html_body,attempts
		FROM email_outbox
		WHERE status IN ('pending','failed') AND next_attempt_at<=now() AND attempts<$1
		ORDER BY created_at
		FOR UPDATE SKIP LOCKED
		LIMIT $2`, s.cfg.MaxAttempts, s.cfg.BatchSize)
	if err != nil {
		return nil, err
	}
	items := make([]queuedMessage, 0)
	for rows.Next() {
		var item queuedMessage
		if err := rows.Scan(&item.ID, &item.Kind, &item.Recipient, &item.Subject, &item.TextBody, &item.HTMLBody, &item.Attempts); err != nil {
			rows.Close()
			return nil, err
		}
		items = append(items, item)
	}
	if err := rows.Err(); err != nil {
		rows.Close()
		return nil, err
	}
	rows.Close()

	for i := range items {
		if _, err := tx.Exec(ctx, "UPDATE email_outbox SET status='sending',attempts=attempts+1,last_error=NULL WHERE id=$1", items[i].ID); err != nil {
			return nil, err
		}
		items[i].Attempts++
	}
	if err := tx.Commit(ctx); err != nil {
		return nil, err
	}
	return items, nil
}

func (s *Service) dispatchOne(ctx context.Context, item queuedMessage) error {
	var localReason, localDetail string
	err := s.db.QueryRow(ctx, "SELECT reason,COALESCE(detail,'') FROM email_suppressions WHERE email=lower($1)", item.Recipient).Scan(&localReason, &localDetail)
	if err == nil {
		return s.markSuppressed(ctx, item, localReason, localDetail)
	}
	if err != nil && !errors.Is(err, pgx.ErrNoRows) {
		return err
	}

	suppression, err := s.provider.Suppression(ctx, item.Recipient)
	if err != nil {
		return s.markFailed(ctx, item, err)
	}
	if suppression.Suppressed {
		reason := strings.ToLower(strings.TrimSpace(suppression.Reason))
		if reason != "bounce" && reason != "complaint" {
			reason = "manual"
		}
		_, err = s.db.Exec(ctx, `INSERT INTO email_suppressions(email,reason,source,detail)
			VALUES(lower($1),$2,'ses',$3)
			ON CONFLICT(email) DO UPDATE
			SET reason=EXCLUDED.reason,source=EXCLUDED.source,detail=EXCLUDED.detail,last_seen_at=now()`,
			item.Recipient, reason, suppression.Detail)
		if err != nil {
			return err
		}
		return s.markSuppressed(ctx, item, reason, suppression.Detail)
	}

	html := ""
	if item.HTMLBody != nil {
		html = *item.HTMLBody
	}
	messageID, err := s.provider.Send(ctx, Message{
		To:       item.Recipient,
		Subject:  item.Subject,
		TextBody: item.TextBody,
		HTMLBody: html,
	})
	if err != nil {
		return s.markFailed(ctx, item, err)
	}

	tx, err := s.db.BeginTx(ctx, pgx.TxOptions{})
	if err != nil {
		return err
	}
	defer tx.Rollback(ctx)
	if _, err = tx.Exec(ctx, "UPDATE email_outbox SET status='sent',provider_message_id=$2,sent_at=now(),last_error=NULL WHERE id=$1", item.ID, messageID); err != nil {
		return err
	}
	if _, err = tx.Exec(ctx, `INSERT INTO email_delivery_events(provider,provider_message_id,event_type,recipient_email,payload)
		VALUES('ses',$1,'send',lower($2),jsonb_build_object('kind',$3,'outbox_id',$4))`,
		messageID, item.Recipient, item.Kind, item.ID); err != nil {
		return err
	}
	return tx.Commit(ctx)
}

func (s *Service) markSuppressed(ctx context.Context, item queuedMessage, reason, detail string) error {
	eventType := reason
	if eventType != "bounce" && eventType != "complaint" {
		eventType = "reject"
	}
	tx, err := s.db.BeginTx(ctx, pgx.TxOptions{})
	if err != nil {
		return err
	}
	defer tx.Rollback(ctx)
	if _, err = tx.Exec(ctx, "UPDATE email_outbox SET status='suppressed',last_error=$2 WHERE id=$1", item.ID, truncate(detail, 1000)); err != nil {
		return err
	}
	if _, err = tx.Exec(ctx, `INSERT INTO email_delivery_events(provider,event_type,recipient_email,payload)
		VALUES('ses',$1,lower($2),jsonb_build_object('reason',$3,'outbox_id',$4))`,
		eventType, item.Recipient, reason, item.ID); err != nil {
		return err
	}
	return tx.Commit(ctx)
}

func (s *Service) markFailed(ctx context.Context, item queuedMessage, cause error) error {
	delay := retryDelay(item.Attempts)
	if item.Attempts >= s.cfg.MaxAttempts {
		delay = 365 * 24 * time.Hour
	}
	_, err := s.db.Exec(ctx, "UPDATE email_outbox SET status='failed',last_error=$2,next_attempt_at=$3 WHERE id=$1", item.ID, truncate(cause.Error(), 1000), s.now().UTC().Add(delay))
	return err
}

func retryDelay(attempt int) time.Duration {
	switch {
	case attempt <= 1:
		return time.Minute
	case attempt == 2:
		return 5 * time.Minute
	case attempt == 3:
		return 15 * time.Minute
	default:
		return time.Hour
	}
}

func truncate(value string, max int) string {
	if len(value) <= max {
		return value
	}
	return value[:max]
}

func (s *Service) Health(ctx context.Context) (Health, error) {
	result := Health{Enabled: s.Enabled(), CheckedAt: s.now().UTC()}
	err := s.db.QueryRow(ctx, `SELECT
		count(*) FILTER (WHERE status='pending'),
		count(*) FILTER (WHERE status='failed'),
		count(*) FILTER (WHERE status='sent' AND sent_at>=now()-interval '24 hours'),
		count(*) FILTER (WHERE status='suppressed'),
		min(created_at) FILTER (WHERE status IN ('pending','failed'))
		FROM email_outbox`).Scan(&result.Pending, &result.Failed, &result.Sent24H, &result.Suppressed, &result.OldestPendingAt)
	if err != nil {
		return Health{}, err
	}
	if err = s.db.QueryRow(ctx, `SELECT
		count(*) FILTER (WHERE reason='bounce'),
		count(*) FILTER (WHERE reason='complaint')
		FROM email_suppressions`).Scan(&result.Bounces, &result.Complaints); err != nil {
		return Health{}, err
	}
	if s.Enabled() {
		provider, accountErr := s.provider.Account(ctx)
		if accountErr != nil {
			return Health{}, fmt.Errorf("SES account health: %w", accountErr)
		}
		result.Provider = provider
	}
	return result, nil
}

func (s *Service) Run(ctx context.Context, onError func(error)) {
	if !s.Enabled() {
		return
	}
	ticker := time.NewTicker(s.PollInterval())
	defer ticker.Stop()
	for {
		if _, err := s.DispatchPass(ctx); err != nil && onError != nil {
			onError(err)
		}
		select {
		case <-ctx.Done():
			return
		case <-ticker.C:
		}
	}
}
