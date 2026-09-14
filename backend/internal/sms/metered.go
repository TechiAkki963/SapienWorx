package sms

import (
	"context"
	"log/slog"

	"github.com/jackc/pgx/v5/pgxpool"
)

type MeteredSender struct {
	inner  Sender
	db     *pgxpool.Pool
	logger *slog.Logger
}

func NewMeteredSender(inner Sender, db *pgxpool.Pool, logger *slog.Logger) *MeteredSender {
	return &MeteredSender{inner: inner, db: db, logger: logger}
}

func (s *MeteredSender) SendOTP(ctx context.Context, phone, code, purpose string) error {
	if err := s.inner.SendOTP(ctx, phone, code, purpose); err != nil {
		return err
	}
	if _, err := s.db.Exec(ctx, `INSERT INTO platform_metrics_daily(metric_date,sns_sms_sent,sns_billing_cycle_start,computed_at)
		VALUES(current_date,1,date_trunc('month',current_date)::date,now())
		ON CONFLICT(metric_date) DO UPDATE SET
			sns_sms_sent=platform_metrics_daily.sns_sms_sent+1,
			sns_billing_cycle_start=EXCLUDED.sns_billing_cycle_start,
			computed_at=now()`); err != nil {
		s.logger.Error("failed to persist SNS usage metric after successful send", "error", err, "purpose", purpose)
	}
	return nil
}
