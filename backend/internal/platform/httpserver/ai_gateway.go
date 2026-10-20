package httpserver

import (
	"context"
	"net/http"

	"github.com/jackc/pgx/v5/pgxpool"

	"github.com/TechiAkki963/SapienWorx/backend/internal/intelligence/gateway"
	"github.com/TechiAkki963/SapienWorx/backend/internal/intelligence/parsing"
)

// SetAIGateway follows the existing runtime injection pattern. Product requests
// use separate, consented feature routes; no arbitrary prompt endpoint exists.
func (s *Server) SetAIGateway(service *gateway.Service) { s.aiGateway = service }

func (s *Server) adminAIStatus(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Cache-Control", "no-store")
	status := gateway.Health{State: "disabled", Provider: "openai"}
	metrics := []gateway.Metric{}
	budget := gateway.BudgetStatus{}
	quality := parsing.Statistics{}
	operations := gateway.OperationalStatus{}
	if s.aiGateway != nil {
		status = s.aiGateway.Health()
		metrics = s.aiGateway.Metrics()
		budget = s.aiGateway.BudgetStatus(r.Context())
		if db, ok := s.db.(*pgxpool.Pool); ok {
			operations = s.aiGateway.OperationalStatus(r.Context(), db)
		}
	}
	if s.aiParsing != nil {
		if source, ok := s.aiParsing.Store.(interface {
			Statistics(context.Context) parsing.Statistics
		}); ok {
			quality = source.Statistics(r.Context())
		}
	}
	writeJSON(w, http.StatusOK, struct {
		Health     gateway.Health            `json:"health"`
		Metrics    []gateway.Metric          `json:"metrics"`
		Budget     gateway.BudgetStatus      `json:"budget"`
		Parsing    parsing.Statistics        `json:"parsing"`
		Operations gateway.OperationalStatus `json:"operations"`
	}{status, metrics, budget, quality, operations})
}
