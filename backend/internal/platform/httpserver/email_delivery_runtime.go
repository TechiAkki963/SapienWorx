package httpserver

import (
	"context"
	"errors"
	"github.com/TechiAkki963/SapienWorx/backend/internal/recruiter"
	"net/http"

	"github.com/TechiAkki963/SapienWorx/backend/internal/emaildelivery"
)

type emailDeliveryRuntime interface {
	Health(context.Context) (emaildelivery.Health, error)
}

func (s *Server) SetEmailDelivery(service emailDeliveryRuntime) {
	s.emailDelivery = service
	if worker, ok := service.(*emaildelivery.Service); ok && s.recruiter != nil {
		worker.SetReferralContentResolver(func(ctx context.Context, dedupe, recipient string) (string, error) {
			content, err := s.recruiter.ReferralDelivery(ctx, dedupe, recipient)
			if errors.Is(err, recruiter.ErrReferralUnavailable) {
				return "", emaildelivery.ErrContentUnavailable
			}
			return content, err
		})
	}
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
