package httpserver

import "net/http"

func (s *Server) candidateContactSharing(w http.ResponseWriter, r *http.Request) {
	id, ok := candidateID(r)
	if !ok {
		return
	}
	var input struct {
		AlternatePhoneE164 string `json:"alternate_phone_e164"`
		Enabled            *bool  `json:"enabled"`
	}
	if !decodeJSON(w, r, &input) {
		return
	}
	if input.Enabled == nil {
		writeError(w, r, http.StatusBadRequest, "validation_error", "enabled is required")
		return
	}
	result, err := s.candidate.SetContactSharing(r.Context(), id, input.AlternatePhoneE164, *input.Enabled)
	if err != nil {
		writeError(w, r, http.StatusBadRequest, "validation_error", "invalid contact sharing preference")
		return
	}
	writeJSON(w, http.StatusOK, result)
}
