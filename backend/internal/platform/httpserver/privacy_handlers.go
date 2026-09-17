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

func (s *Server) userPrivacyExport(w http.ResponseWriter, r *http.Request) {
	claims, ok := ClaimsFromContext(r.Context())
	if !ok {
		writeError(w, r, http.StatusUnauthorized, "unauthorized", "authentication required")
		return
	}
	if s.privacy == nil {
		writeError(w, r, http.StatusServiceUnavailable, "privacy_unavailable", "privacy service is unavailable")
		return
	}
	bundle, err := s.privacy.BuildSafeExport(r.Context(), claims.Subject)
	if err != nil {
		s.writePrivacyError(w, r, err)
		return
	}
	w.Header().Set("Cache-Control", "no-store")
	w.Header().Set("Content-Disposition", `attachment; filename="sapienworx-data-export.json"`)
	writeJSON(w, http.StatusOK, bundle)
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
	status, err := s.privacy.EraseAccount(r.Context(), claims.Subject)
	if err != nil {
		s.writePrivacyError(w, r, err)
		return
	}
	s.clearAuthCookies(w)
	switch status {
	case "awaiting_review":
		writeJSON(w, http.StatusAccepted, map[string]string{"status": "awaiting_review"})
	case "in_progress":
		writeJSON(w, http.StatusAccepted, map[string]string{"status": "in_progress"})
	default:
		w.WriteHeader(http.StatusNoContent)
	}
}

func (s *Server) writePrivacyError(w http.ResponseWriter, r *http.Request, err error) {
	switch {
	case errors.Is(err, privacy.ErrInvalid):
		writeError(w, r, http.StatusBadRequest, "invalid_privacy_request", "privacy request is invalid")
	case errors.Is(err, privacy.ErrNotFound):
		writeError(w, r, http.StatusNotFound, "not_found", "privacy account was not found")
	case errors.Is(err, privacy.ErrReview):
		writeError(w, r, http.StatusConflict, "privacy_review_required", "privacy request requires review")
	default:
		s.logger.Error("privacy operation failed", "error", err, "request_id", RequestIDFromContext(r.Context()))
		writeError(w, r, http.StatusInternalServerError, "internal_error", "privacy operation could not be completed")
	}
}
