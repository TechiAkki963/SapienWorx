package sms

import (
	"context"
	"errors"
	"log/slog"
)

var ErrUnavailable = errors.New("sms delivery is unavailable")

type Sender interface {
	SendOTP(context.Context, string, string, string) error
}

type LogSender struct {
	logger *slog.Logger
}

func NewLogSender(logger *slog.Logger) *LogSender { return &LogSender{logger: logger} }

func (s *LogSender) SendOTP(_ context.Context, phone, code, purpose string) error {
	s.logger.Warn("development OTP generated", "phone", phone, "purpose", purpose, "code", code)
	return nil
}

type DisabledSender struct{}

func (DisabledSender) SendOTP(context.Context, string, string, string) error { return ErrUnavailable }
