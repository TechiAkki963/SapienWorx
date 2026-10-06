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
	"github.com/TechiAkki963/SapienWorx/backend/internal/emaildelivery"
	"github.com/TechiAkki963/SapienWorx/backend/internal/platform/config"
	"github.com/TechiAkki963/SapienWorx/backend/internal/platform/database"
	"github.com/TechiAkki963/SapienWorx/backend/internal/platform/httpserver"
	"github.com/TechiAkki963/SapienWorx/backend/internal/recruiter"
	"github.com/TechiAkki963/SapienWorx/backend/internal/storage"
	"github.com/TechiAkki963/SapienWorx/backend/internal/workforce"
	awsconfig "github.com/aws/aws-sdk-go-v2/config"
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

	authService := auth.NewService(db, tokens, auth.ServiceConfig{RefreshTTL: cfg.Auth.RefreshTokenTTL, OTPTTL: cfg.Auth.OTPTTL, OTPResend: cfg.Auth.OTPResendInterval, OTPSecret: cfg.Auth.OTPSecret, Development: cfg.Environment == "development" && os.Getenv("AUTH_ENABLE_DEV_OTP") == "true"})
	if os.Getenv("CANDIDATE_PHONE_CHANGE_ENABLED") == "true" {
		sender, err := auth.NewSNSSMSSender(ctx, cfg.AWS.Region)
		if err != nil {
			return err
		}
		authService.SetPhoneCodeSender(sender)
	}
	candidateService := candidate.NewService(db)
	recruiterService := recruiter.NewService(db)
	adminService := admin.NewService(db)
	workforceService := workforce.NewService(db)
	server := httpserver.New(cfg, db, tokens, authService, candidateService, recruiterService, adminService, workforceService, logger)
	var emailProvider emaildelivery.Provider
	if cfg.Email.Enabled {
		awsCfg, awsErr := awsconfig.LoadDefaultConfig(ctx, awsconfig.WithRegion(cfg.AWS.Region))
		if awsErr != nil {
			return awsErr
		}
		emailProvider = emaildelivery.NewSESProvider(awsCfg, cfg.Email.FromAddress)
	}
	emailService := emaildelivery.NewService(db, emailProvider, emaildelivery.Config{Enabled: cfg.Email.Enabled, PollInterval: cfg.Email.WorkerInterval, BatchSize: cfg.Email.BatchSize, MaxAttempts: cfg.Email.MaxAttempts})
	server.SetEmailDelivery(emailService)
	go emailService.Run(ctx, func(runErr error) {
		logger.Warn("email delivery pass failed", "error", runErr)
	})
	if cfg.Email.Enabled {
		runSavedSearchAlerts := func() {
			passCtx, cancel := context.WithTimeout(ctx, 30*time.Second)
			defer cancel()
			queued, alertErr := recruiterService.ProcessSavedSearchAlerts(passCtx, 20)
			if alertErr != nil {
				logger.Warn("saved search alert pass failed", "error", alertErr)
			} else if queued > 0 {
				logger.Info("saved search alerts queued", "count", queued)
			}
		}
		runSavedSearchAlerts()
		go func() {
			ticker := time.NewTicker(time.Hour)
			defer ticker.Stop()
			for {
				select {
				case <-ctx.Done():
					return
				case <-ticker.C:
					runSavedSearchAlerts()
				}
			}
		}()
	}
	if cfg.AWS.S3Bucket != "" {
		presigner, presignErr := storage.NewS3Presigner(ctx, cfg.AWS.Region, cfg.AWS.S3Bucket, cfg.AWS.S3PresignTTL)
		if presignErr != nil {
			return presignErr
		}
		server.SetObjectStorage(presigner)
		if _, err := server.RunPrivacyFulfilmentPass(ctx); err != nil {
			logger.Warn("initial privacy fulfilment pass failed", "error", err)
		}
		go func() {
			ticker := time.NewTicker(time.Minute)
			defer ticker.Stop()
			for {
				select {
				case <-ctx.Done():
					return
				case <-ticker.C:
					passCtx, cancel := context.WithTimeout(ctx, 30*time.Second)
					processed, passErr := server.RunPrivacyFulfilmentPass(passCtx)
					cancel()
					if passErr != nil {
						logger.Warn("privacy fulfilment pass failed", "error", passErr)
					} else if processed > 0 {
						logger.Info("privacy fulfilment jobs processed", "count", processed)
					}
				}
			}
		}()
	}
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
