package main

import (
	"context"
	"log/slog"
	"os"
	"os/signal"
	"syscall"
	"time"

	"github.com/TechiAkki963/SapienWorx/backend/internal/intelligence/engine"
	"github.com/TechiAkki963/SapienWorx/backend/internal/platform/config"
	"github.com/TechiAkki963/SapienWorx/backend/internal/platform/database"
)

func main() {
	logger := slog.New(slog.NewJSONHandler(os.Stdout, &slog.HandlerOptions{Level: slog.LevelInfo}))
	if err := run(logger); err != nil {
		logger.Error("intelligence engine stopped with error", "error", err)
		os.Exit(1)
	}
}

func run(logger *slog.Logger) error {
	cfg, err := config.Load()
	if err != nil {
		return err
	}
	ctx, stop := signal.NotifyContext(context.Background(), os.Interrupt, syscall.SIGTERM)
	defer stop()
	db, err := database.Open(ctx, cfg.Database, logger)
	if err != nil {
		return err
	}
	defer db.Close()

	processor := engine.NewProcessor(db, logger)
	logger.Info("starting SapienWorx Intelligence Engine", "version", engine.Version)
	evalTicker := time.NewTicker(15 * time.Minute)
	defer evalTicker.Stop()
	errCh := make(chan error, 1)
	go func() { errCh <- processor.Run(ctx, 2*time.Second) }()
	for {
		select {
		case <-ctx.Done():
			return nil
		case err := <-errCh:
			return err
		case <-evalTicker.C:
			evalCtx, cancel := context.WithTimeout(ctx, 2*time.Minute)
			if err := processor.EvaluateCandidateModels(evalCtx); err != nil {
				logger.Warn("candidate model evaluation pass failed", "error", err)
			}
			cancel()
		}
	}
}
