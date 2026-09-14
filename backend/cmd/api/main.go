package main

import (
	"context"
	"errors"
	"log/slog"
	"net/http"
	"os"
	"os/signal"
	"syscall"
	"time"

	"github.com/TechiAkki963/SapienWorx/backend/internal/admin"
	"github.com/TechiAkki963/SapienWorx/backend/internal/auth"
	"github.com/TechiAkki963/SapienWorx/backend/internal/candidate"
	"github.com/TechiAkki963/SapienWorx/backend/internal/platform/config"
	"github.com/TechiAkki963/SapienWorx/backend/internal/platform/database"
	"github.com/TechiAkki963/SapienWorx/backend/internal/platform/httpserver"
	"github.com/TechiAkki963/SapienWorx/backend/internal/recruiter"
	"github.com/TechiAkki963/SapienWorx/backend/internal/sms"
)

func main() {
	logger := slog.New(slog.NewJSONHandler(os.Stdout, &slog.HandlerOptions{Level: slog.LevelInfo}))
	if err := run(logger); err != nil {
		logger.Error("api stopped with error", "error", err)
		os.Exit(1)
	}
}

func run(logger *slog.Logger) error {
	cfg, err := config.Load()
	if err != nil {
		return err
	}
	logger.Info("starting SapienWorx API", "config", cfg.String())
	ctx, stop := signal.NotifyContext(context.Background(), os.Interrupt, syscall.SIGTERM)
	defer stop()
	db, err := database.Open(ctx, cfg.Database, logger)
	if err != nil {
		return err
	}
	defer db.Close()
	tokens, err := auth.NewTokenManager(cfg.Auth.JWTSecret, cfg.Auth.Issuer, cfg.Auth.Audience, cfg.Auth.AccessTokenTTL, cfg.Auth.ClockSkew)
	if err != nil {
		return err
	}
	var sender sms.Sender
	if cfg.AWS.SMSEnabled {
		snsSender, senderErr := sms.NewSNSClient(ctx, cfg.AWS.Region, cfg.AWS.SNSSenderID)
		if senderErr != nil {
			return senderErr
		}
		sender = sms.NewMeteredSender(snsSender, db, logger, cfg.AWS.SMSDailyLimit)
	} else if cfg.Environment == "production" {
		sender = sms.DisabledSender{}
	} else {
		sender = sms.NewLogSender(logger)
	}
	authService := auth.NewService(db, tokens, sender, auth.ServiceConfig{RefreshTTL: cfg.Auth.RefreshTokenTTL, OTPTTL: cfg.Auth.OTPTTL, OTPResend: cfg.Auth.OTPResendInterval, OTPSecret: cfg.Auth.OTPSecret, Development: cfg.Environment != "production"})
	candidateService := candidate.NewService(db)
	recruiterService := recruiter.NewService(db)
	adminService := admin.NewService(db)
	server := httpserver.New(cfg, db, tokens, authService, candidateService, recruiterService, adminService, logger)
	errCh := make(chan error, 1)
	go func() {
		logger.Info("http server listening", "address", cfg.HTTP.Address)
		errCh <- server.ListenAndServe()
	}()
	select {
	case <-ctx.Done():
		logger.Info("shutdown signal received")
	case err := <-errCh:
		if !errors.Is(err, http.ErrServerClosed) {
			return err
		}
		return nil
	}
	shutdownCtx, cancel := context.WithTimeout(context.Background(), cfg.HTTP.ShutdownTimeout)
	defer cancel()
	if err := server.Shutdown(shutdownCtx); err != nil {
		return err
	}
	select {
	case err := <-errCh:
		if err != nil && !errors.Is(err, http.ErrServerClosed) {
			return err
		}
	case <-time.After(time.Second):
	}
	logger.Info("shutdown complete")
	return nil
}
