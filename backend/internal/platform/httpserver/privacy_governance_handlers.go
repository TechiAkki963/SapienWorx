package httpserver

import (
	"encoding/json"
	"errors"
	"net/http"
	"strings"

	"github.com/TechiAkki963/SapienWorx/backend/internal/privacy"
)

func (s *Server) publicSubprocessors(w http.ResponseWriter, r *http.Request) {
	if s.privacy == nil {
		writeError(w, r, http.StatusServiceUnavailable, "privacy_unavailable", "privacy service is unavailable")
		return
	}
	items, err := s.privacy.PublicSubprocessors(r.Context())
	if err != nil {
		s.writePrivacyError(w, r, err)
		return
	}
	writeJSON(w, http.StatusOK, map[string]any{"items": items})
}

func (s *Server) adminPrivacyRequests(w http.ResponseWriter, r *http.Request) {
	if s.privacy == nil {
		writeError(w, r, http.StatusServiceUnavailable, "privacy_unavailable", "privacy service is unavailable")
		return
	}
	items, err := s.privacy.AdminRequests(r.Context())
	if err != nil {
		s.writePrivacyError(w, r, err)
		return
	}
	writeJSON(w, http.StatusOK, map[string]any{"items": items})
}

func (s *Server) adminPrivacyRequestTransition(w http.ResponseWriter, r *http.Request) {
	if s.privacy == nil {
		writeError(w, r, http.StatusServiceUnavailable, "privacy_unavailable", "privacy service is unavailable")
		return
	}
	claims, ok := ClaimsFromContext(r.Context())
	if !ok {
		writeError(w, r, http.StatusForbidden, "admin_forbidden", "master admin access denied")
		return
	}
	var input struct {
		Status string `json:"status"`
	}
	decoder := json.NewDecoder(r.Body)
	decoder.DisallowUnknownFields()
	if err := decoder.Decode(&input); err != nil {
		writeError(w, r, http.StatusBadRequest, "invalid_request", "valid JSON with a status is required")
		return
	}
	requestID := strings.TrimSpace(r.PathValue("requestID"))
	err := s.privacy.TransitionRequestStatus(r.Context(), requestID, input.Status, claims.Subject)
	switch {
	case err == nil:
		writeJSON(w, http.StatusOK, map[string]string{"id": requestID, "status": strings.TrimSpace(input.Status)})
	case errors.Is(err, privacy.ErrPrivacyRequestNotFound):
		writeError(w, r, http.StatusNotFound, "privacy_request_not_found", "privacy request was not found")
	case errors.Is(err, privacy.ErrInvalidPrivacyRequestStatus):
		writeError(w, r, http.StatusBadRequest, "invalid_privacy_status", "privacy request status is invalid")
	case errors.Is(err, privacy.ErrInvalidPrivacyRequestTransition):
		writeError(w, r, http.StatusConflict, "invalid_privacy_transition", "privacy request status transition is not allowed")
	case errors.Is(err, privacy.ErrPrivacyRequestJobsIncomplete):
		writeError(w, r, http.StatusConflict, "privacy_jobs_incomplete", "privacy fulfilment jobs must finish before this terminal transition")
	default:
		s.writePrivacyError(w, r, err)
	}
}

func (s *Server) adminPrivacyIncidents(w http.ResponseWriter, r *http.Request) {
	if s.privacy == nil {
		writeError(w, r, http.StatusServiceUnavailable, "privacy_unavailable", "privacy service is unavailable")
		return
	}
	items, err := s.privacy.Incidents(r.Context())
	if err != nil {
		s.writePrivacyError(w, r, err)
		return
	}
	writeJSON(w, http.StatusOK, map[string]any{"items": items})
}

func (s *Server) adminPrivacySubprocessors(w http.ResponseWriter, r *http.Request) {
	if s.privacy == nil {
		writeError(w, r, http.StatusServiceUnavailable, "privacy_unavailable", "privacy service is unavailable")
		return
	}
	items, err := s.privacy.PublicSubprocessors(r.Context())
	if err != nil {
		s.writePrivacyError(w, r, err)
		return
	}
	writeJSON(w, http.StatusOK, map[string]any{"items": items})
}

func (s *Server) adminPrivacyProcessingActivities(w http.ResponseWriter, r *http.Request) {
	if s.privacy == nil {
		writeError(w, r, http.StatusServiceUnavailable, "privacy_unavailable", "privacy service is unavailable")
		return
	}
	items, err := s.privacy.ProcessingActivities(r.Context())
	if err != nil {
		s.writePrivacyError(w, r, err)
		return
	}
	writeJSON(w, http.StatusOK, map[string]any{"items": items})
}
