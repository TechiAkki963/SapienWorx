package httpserver

import (
	"errors"
	"net/http"
	"strings"

	"github.com/TechiAkki963/SapienWorx/backend/internal/admin"
)

func (s *Server) adminTrustRiskFlags(w http.ResponseWriter, r *http.Request) {
	items, err := s.admin.TrustRiskFlags(r.Context())
	if err != nil {
		s.logger.Error("trust risk queue unavailable", "error", err, "request_id", RequestIDFromContext(r.Context()))
		writeError(w, r, http.StatusServiceUnavailable, "trust_risk_unavailable", "trust review queue is temporarily unavailable")
		return
	}
	writeJSON(w, http.StatusOK, map[string]any{"items": items})
}

func (s *Server) adminTrustRiskReview(w http.ResponseWriter, r *http.Request) {
	claims, ok := ClaimsFromContext(r.Context())
	if !ok {
		writeError(w, r, http.StatusForbidden, "admin_forbidden", "administrator access denied")
		return
	}
	var input struct {
		Status string `json:"status"`
		Note   string `json:"note"`
	}
	if !decodeJSON(w, r, &input) {
		return
	}
	err := s.admin.ReviewTrustRiskFlag(r.Context(), strings.TrimSpace(r.PathValue("flagID")), claims.Subject, input.Status, input.Note, clientIP(r.RemoteAddr), RequestIDFromContext(r.Context()))
	switch {
	case err == nil:
		writeJSON(w, http.StatusOK, map[string]string{"status": strings.ToLower(strings.TrimSpace(input.Status))})
	case errors.Is(err, admin.ErrInvalid):
		writeError(w, r, http.StatusBadRequest, "invalid_trust_review", "trust review update is invalid")
	case errors.Is(err, admin.ErrNotFound):
		writeError(w, r, http.StatusNotFound, "trust_risk_not_found", "trust risk signal was not found")
	case errors.Is(err, admin.ErrConflict):
		writeError(w, r, http.StatusConflict, "trust_risk_already_closed", "trust risk signal has already reached a terminal review state")
	default:
		s.logger.Error("trust review update failed", "error", err, "request_id", RequestIDFromContext(r.Context()))
		writeError(w, r, http.StatusServiceUnavailable, "trust_risk_unavailable", "trust review could not be updated")
	}
}
