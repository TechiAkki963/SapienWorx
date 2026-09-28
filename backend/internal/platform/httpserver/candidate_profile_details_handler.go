package httpserver

import (
	"net/http"

	"github.com/TechiAkki963/SapienWorx/backend/internal/candidate"
)

func (s *Server) candidateProfileDetails(w http.ResponseWriter, r *http.Request) {
	id, ok := candidateID(r)
	if !ok {
		writeError(w, r, http.StatusUnauthorized, "unauthorized", "authentication required")
		return
	}

	if r.Method == http.MethodGet {
		result, err := s.candidate.Details(r.Context(), id)
		if err != nil {
			s.writeCandidateError(w, r, err)
			return
		}
		writeJSON(w, http.StatusOK, result)
		return
	}

	var input candidate.ProfileDetailsUpdate
	if !decodeJSON(w, r, &input) {
		return
	}
	result, err := s.candidate.UpdateDetails(r.Context(), id, input)
	if err != nil {
		s.writeCandidateError(w, r, err)
		return
	}
	writeJSON(w, http.StatusOK, result)
}

func (s *Server) candidateOnboarding(w http.ResponseWriter, r *http.Request) {
	id, ok := candidateID(r)
	if !ok {
		writeError(w, r, http.StatusUnauthorized, "unauthorized", "authentication required")
		return
	}
	var input struct {
		Status   string `json:"status"`
		ReturnTo string `json:"return_to"`
	}
	if !decodeJSON(w, r, &input) {
		return
	}
	result, err := s.candidate.SetOnboardingState(r.Context(), id, input.Status, input.ReturnTo)
	if err != nil {
		if err == candidate.ErrInvalidOnboardingTransition {
			writeError(w, r, http.StatusConflict, "invalid_onboarding_transition", "the onboarding state could not be changed")
			return
		}
		s.writeCandidateError(w, r, err)
		return
	}
	writeJSON(w, http.StatusOK, result)
}
