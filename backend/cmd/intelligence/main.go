package main

import (
	"context"
	"fmt"
	"log/slog"
	"os"
	"os/signal"
	"strconv"
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
	environment, dbCfg, err := intelligenceDatabaseConfig()
	if err != nil {
		return err
	}
	_ = environment
	ctx, stop := signal.NotifyContext(context.Background(), os.Interrupt, syscall.SIGTERM)
	defer stop()
	db, err := database.Open(ctx, dbCfg, logger)
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

func intelligenceDatabaseConfig() (string, config.DatabaseConfig, error) {
	environment := strings.TrimSpace(os.Getenv("APP_ENV"))
	if environment == "" {
		environment = "development"
	}
	databaseURL := strings.TrimSpace(os.Getenv("INTELLIGENCE_DATABASE_URL"))
	if databaseURL == "" {
		databaseURL = strings.TrimSpace(os.Getenv("DATABASE_URL"))
	}
	if strings.EqualFold(environment, "production") && strings.TrimSpace(os.Getenv("INTELLIGENCE_DATABASE_URL")) == "" {
		return "", config.DatabaseConfig{}, fmt.Errorf("INTELLIGENCE_DATABASE_URL is required in production for the separate Intelligence Engine database role")
	}
	if databaseURL == "" {
		return "", config.DatabaseConfig{}, fmt.Errorf("INTELLIGENCE_DATABASE_URL or DATABASE_URL is required")
	}
	maxConns, err := parseInt32Env("DB_MAX_CONNS", 2)
	if err != nil {
		return "", config.DatabaseConfig{}, err
	}
	minConns, err := parseInt32Env("DB_MIN_CONNS", 0)
	if err != nil {
		return "", config.DatabaseConfig{}, err
	}
	if minConns < 0 || maxConns < 1 || minConns > maxConns || maxConns > 4 {
		return "", config.DatabaseConfig{}, fmt.Errorf("intelligence database pool bounds are invalid")
	}
	return environment, config.DatabaseConfig{
		URL:             databaseURL,
		MaxConns:        maxConns,
		MinConns:        minConns,
		MaxConnLifetime: parseDurationEnv("DB_MAX_CONN_LIFETIME", 20*time.Minute),
		MaxConnIdleTime: parseDurationEnv("DB_MAX_CONN_IDLE_TIME", 2*time.Minute),
		HealthTimeout:   parseDurationEnv("DB_HEALTH_TIMEOUT", 2*time.Second),
	}, nil
}

func parseInt32Env(name string, fallback int32) (int32, error) {
	raw := strings.TrimSpace(os.Getenv(name))
	if raw == "" {
		return fallback, nil
	}
	value, err := strconv.ParseInt(raw, 10, 32)
	if err != nil {
		return 0, fmt.Errorf("%s must be an integer", name)
	}
	return int32(value), nil
}

func parseDurationEnv(name string, fallback time.Duration) time.Duration {
	raw := strings.TrimSpace(os.Getenv(name))
	if raw == "" {
		return fallback
	}
	value, err := time.ParseDuration(raw)
	if err != nil || value <= 0 {
		return fallback
	}
	return value
}

func healthcheck(logger *slog.Logger) error {
	_, dbCfg, err := intelligenceDatabaseConfig()
	if err != nil {
		return err
	}
	ctx, cancel := context.WithTimeout(context.Background(), 4*time.Second)
	defer cancel()
	db, err := database.Open(ctx, dbCfg, logger)
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
