package httpserver

import (
	"github.com/TechiAkki963/SapienWorx/backend/internal/candidate"
	"net/http"
)

func (s *Server) candidatePreferences(w http.ResponseWriter, r *http.Request) {
	id, ok := candidateID(r)
	if !ok {
		writeError(w, r, 401, "unauthorized", "authentication required")
		return
	}
	var result candidate.Preferences
	var err error
	if r.Method == http.MethodGet {
		result, err = s.candidate.Preferences(r.Context(), id)
	} else {
		var input candidate.PreferencesUpdate
		if !decodeJSON(w, r, &input) {
			return
		}
		result, err = s.candidate.UpdatePreferences(r.Context(), id, input)
	}
	if err != nil {
		s.writeCandidateError(w, r, err)
		return
	}
	writeJSON(w, 200, result)
}
