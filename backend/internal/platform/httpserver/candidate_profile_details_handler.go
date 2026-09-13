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
