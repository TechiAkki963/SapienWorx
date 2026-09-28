package main

import (
	"context"
	"fmt"
	"log/slog"
	"os"
	"os/signal"
	"strings"
	"syscall"
	"time"

	"github.com/TechiAkki963/SapienWorx/backend/internal/intelligence/engine"
	"github.com/TechiAkki963/SapienWorx/backend/internal/platform/config"
	"github.com/TechiAkki963/SapienWorx/backend/internal/platform/database"
)

func main() {
	logger := slog.New(slog.NewJSONHandler(os.Stdout, &slog.HandlerOptions{Level: slog.LevelInfo}))
	if len(os.Args) > 1 && os.Args[1] == "healthcheck" {
		if err := healthcheck(logger); err != nil {
			logger.Error("intelligence healthcheck failed", "error", err)
			os.Exit(1)
		}
		return
	}
	if err := run(logger); err != nil {
		logger.Error("intelligence engine stopped with error", "error", err)
		os.Exit(1)
	}
}

func run(logger *slog.Logger) error {
	cfg, err := intelligenceConfig()
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


func intelligenceConfig() (config.Config, error) {
	cfg, err := config.Load()
	if err != nil {
		return config.Config{}, err
	}
	intelligenceDatabaseURL := strings.TrimSpace(os.Getenv("INTELLIGENCE_DATABASE_URL"))
	if strings.EqualFold(cfg.Environment, "production") && intelligenceDatabaseURL == "" {
		return config.Config{}, fmt.Errorf("INTELLIGENCE_DATABASE_URL is required in production for the separate Intelligence Engine database role")
	}
	if intelligenceDatabaseURL != "" {
		cfg.Database.URL = intelligenceDatabaseURL
	}
	return cfg, nil
}

func healthcheck(logger *slog.Logger) error {
	cfg, err := intelligenceConfig()
	if err != nil {
		return err
	}
	ctx, cancel := context.WithTimeout(context.Background(), 4*time.Second)
	defer cancel()
	db, err := database.Open(ctx, cfg.Database, logger)
	if err != nil {
		return err
	}
	defer db.Close()
	var healthy bool
	if err := db.QueryRow(ctx, `SELECT status='healthy' AND last_seen_at>=now()-interval '2 minutes' FROM intelligence.engine_heartbeats WHERE engine_key='sapienworx-intelligence'`).Scan(&healthy); err != nil {
		return err
	}
	if !healthy {
		return fmt.Errorf("intelligence heartbeat is stale or degraded")
	}
	return nil
}
