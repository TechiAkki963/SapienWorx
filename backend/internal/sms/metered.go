package sms

import (
	"context"
	"errors"
	"log/slog"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
)

var ErrDailyLimit = errors.New("daily SMS send limit reached")

type MeteredSender struct {
	inner      Sender
	db         *pgxpool.Pool
	logger     *slog.Logger
	dailyLimit int
}

func NewMeteredSender(inner Sender, db *pgxpool.Pool, logger *slog.Logger, dailyLimit int) *MeteredSender {
	return &MeteredSender{inner: inner, db: db, logger: logger, dailyLimit: dailyLimit}
}

func (s *MeteredSender) SendOTP(ctx context.Context, phone, code, purpose string) error {
	var reserved int
	err := s.db.QueryRow(ctx, `INSERT INTO platform_metrics_daily(metric_date,sns_sms_sent,sns_billing_cycle_start,computed_at)
		VALUES(current_date,1,date_trunc('month',current_date)::date,now())
		ON CONFLICT(metric_date) DO UPDATE SET
			sns_sms_sent=platform_metrics_daily.sns_sms_sent+1,
			sns_billing_cycle_start=EXCLUDED.sns_billing_cycle_start,
			computed_at=now()
		WHERE platform_metrics_daily.sns_sms_sent < $1
		RETURNING sns_sms_sent`, s.dailyLimit).Scan(&reserved)
	if errors.Is(err, pgx.ErrNoRows) {
		return ErrDailyLimit
	}
	if err != nil {
		return err
	}

	if err := s.inner.SendOTP(ctx, phone, code, purpose); err != nil {
		if _, rollbackErr := s.db.Exec(ctx, `UPDATE platform_metrics_daily SET sns_sms_sent=GREATEST(sns_sms_sent-1,0),computed_at=now() WHERE metric_date=current_date`); rollbackErr != nil {
			s.logger.Error("failed to release SNS quota after send failure", "error", rollbackErr, "purpose", purpose)
		}
		return err
	}
	return nil
}
