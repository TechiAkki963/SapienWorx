package httpserver

import (
	"errors"
	"net/http"

	"github.com/TechiAkki963/SapienWorx/backend/internal/privacy"
)

func (s *Server) userPrivacyRequests(w http.ResponseWriter, r *http.Request) {
	claims, ok := ClaimsFromContext(r.Context())
	if !ok {
		writeError(w, r, http.StatusUnauthorized, "unauthorized", "authentication required")
		return
	}
	if s.privacy == nil {
		writeError(w, r, http.StatusServiceUnavailable, "privacy_unavailable", "privacy service is unavailable")
		return
	}
	if r.Method == http.MethodGet {
		items, err := s.privacy.Requests(r.Context(), claims.Subject)
		if err != nil {
			s.writePrivacyError(w, r, err)
			return
		}
		writeJSON(w, http.StatusOK, map[string]any{"items": items})
		return
	}
	var input struct {
		RequestType string `json:"request_type"`
	}
	if !decodeJSON(w, r, &input) {
		return
	}
	item, err := s.privacy.CreateRequest(r.Context(), claims.Subject, input.RequestType)
	if err != nil {
		s.writePrivacyError(w, r, err)
		return
	}
	writeJSON(w, http.StatusAccepted, item)
}

func (s *Server) userAccountErasure(w http.ResponseWriter, r *http.Request) {
	claims, ok := ClaimsFromContext(r.Context())
	if !ok {
		writeError(w, r, http.StatusUnauthorized, "unauthorized", "authentication required")
		return
	}
	if s.privacy == nil {
		writeError(w, r, http.StatusServiceUnavailable, "privacy_unavailable", "privacy service is unavailable")
		return
	}
	reviewRequired, err := s.privacy.EraseAccount(r.Context(), claims.Subject)
	if err != nil {
		s.writePrivacyError(w, r, err)
		return
	}
	s.clearAuthCookies(w)
	if reviewRequired {
		writeJSON(w, http.StatusAccepted, map[string]string{"status": "awaiting_review"})
		return
	}
	w.WriteHeader(http.StatusNoContent)
}

func (s *Server) writePrivacyError(w http.ResponseWriter, r *http.Request, err error) {
	switch {
	case errors.Is(err, privacy.ErrInvalid):
		writeError(w, r, http.StatusBadRequest, "invalid_privacy_request", "privacy request is invalid")
	case errors.Is(err, privacy.ErrNotFound):
		writeError(w, r, http.StatusNotFound, "not_found", "privacy account was not found")
	default:
		s.logger.Error("privacy operation failed", "error", err, "request_id", RequestIDFromContext(r.Context()))
		writeError(w, r, http.StatusInternalServerError, "internal_error", "privacy operation could not be completed")
	}
}
