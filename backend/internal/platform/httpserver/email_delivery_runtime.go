package httpserver

import (
	"context"
	"net/http"

	"github.com/TechiAkki963/SapienWorx/backend/internal/emaildelivery"
)

type emailDeliveryRuntime interface {
	Health(context.Context) (emaildelivery.Health, error)
}

func (s *Server) SetEmailDelivery(service emailDeliveryRuntime) {
	s.emailDelivery = service
}

func (s *Server) adminEmailHealth(w http.ResponseWriter, r *http.Request) {
	if s.emailDelivery == nil {
		writeError(w, r, http.StatusServiceUnavailable, "email_delivery_unavailable", "email delivery runtime is unavailable")
		return
	}
	result, err := s.emailDelivery.Health(r.Context())
	if err != nil {
		s.logger.Error("email delivery health failed", "error", err, "request_id", RequestIDFromContext(r.Context()))
		writeError(w, r, http.StatusServiceUnavailable, "email_delivery_unavailable", "email delivery health could not be read")
		return
	}
	writeJSON(w, http.StatusOK, result)
}
