package httpserver

import (
	"context"
	"log/slog"
	"net/http"
	"time"

	"github.com/TechiAkki963/SapienWorx/backend/internal/auth"
	"github.com/TechiAkki963/SapienWorx/backend/internal/platform/config"
)

type DatabaseHealth interface {
	Ping(context.Context) error
}

type Server struct {
	http      *http.Server
	db        DatabaseHealth
	dbTimeout time.Duration
	logger    *slog.Logger
	tokens    *auth.TokenManager
}

func New(cfg config.Config, db DatabaseHealth, tokens *auth.TokenManager, logger *slog.Logger) *Server {
	s := &Server{db: db, dbTimeout: cfg.Database.HealthTimeout, logger: logger, tokens: tokens}
	mux := http.NewServeMux()
	mux.HandleFunc("GET /health/live", s.live)
	mux.HandleFunc("GET /health/ready", s.ready)
	mux.Handle("GET /api/v1/auth/me", Chain(http.HandlerFunc(s.me), Authenticate(tokens)))

	handler := Chain(mux,
		RequestID,
		Recover(logger),
		AccessLog(logger),
		SecurityHeaders,
		CORS(cfg.HTTP.AllowedOrigins),
		MaxBodyBytes(cfg.HTTP.MaxBodyBytes),
	)

	s.http = &http.Server{
		Addr:              cfg.HTTP.Address,
		Handler:           handler,
		ReadTimeout:       cfg.HTTP.ReadTimeout,
		ReadHeaderTimeout: cfg.HTTP.ReadHeaderTimeout,
		WriteTimeout:      cfg.HTTP.WriteTimeout,
		IdleTimeout:       cfg.HTTP.IdleTimeout,
	}
	return s
}

func (s *Server) ListenAndServe() error { return s.http.ListenAndServe() }
func (s *Server) Shutdown(ctx context.Context) error {
	return s.http.Shutdown(ctx)
}

func (s *Server) live(w http.ResponseWriter, _ *http.Request) {
	writeJSON(w, http.StatusOK, map[string]string{"status": "ok", "service": "sapienworx-api"})
}

func (s *Server) ready(w http.ResponseWriter, r *http.Request) {
	ctx, cancel := context.WithTimeout(r.Context(), s.dbTimeout)
	defer cancel()
	if err := s.db.Ping(ctx); err != nil {
		s.logger.Warn("readiness check failed", "error", err, "request_id", RequestIDFromContext(r.Context()))
		writeError(w, r, http.StatusServiceUnavailable, "not_ready", "service dependencies are not ready")
		return
	}
	writeJSON(w, http.StatusOK, map[string]string{"status": "ready"})
}

func (s *Server) me(w http.ResponseWriter, r *http.Request) {
	claims, ok := ClaimsFromContext(r.Context())
	if !ok {
		writeError(w, r, http.StatusUnauthorized, "unauthorized", "authentication required")
		return
	}
	writeJSON(w, http.StatusOK, map[string]any{"id": claims.Subject, "role": claims.Role})
}
