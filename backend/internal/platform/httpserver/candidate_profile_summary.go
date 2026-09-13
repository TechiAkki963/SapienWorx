package httpserver

import (
	"encoding/base64"
	"net/http"
	"strings"
)

func (s *Server) candidateProfileSummary(w http.ResponseWriter, r *http.Request) {
	id, ok := candidateID(r)
	if !ok {
		writeError(w, r, http.StatusUnauthorized, "unauthorized", "authentication required")
		return
	}
	result, err := s.candidate.Summary(r.Context(), id)
	if err != nil {
		s.writeCandidateError(w, r, err)
		return
	}
	writeJSON(w, http.StatusOK, result)
}

func (s *Server) candidateProfilePhoto(w http.ResponseWriter, r *http.Request) {
	id, ok := candidateID(r)
	if !ok {
		writeError(w, r, http.StatusUnauthorized, "unauthorized", "authentication required")
		return
	}
	var input struct {
		DataURL string `json:"data_url"`
	}
	if !decodeJSON(w, r, &input) {
		return
	}
	parts := strings.SplitN(strings.TrimSpace(input.DataURL), ",", 2)
	if len(parts) != 2 || !strings.HasPrefix(parts[0], "data:image/") || !strings.Contains(parts[0], ";base64") {
		writeError(w, r, http.StatusBadRequest, "validation_error", "invalid profile photo")
		return
	}
	mime := strings.TrimPrefix(strings.SplitN(parts[0], ";", 2)[0], "data:")
	data, err := base64.StdEncoding.DecodeString(parts[1])
	if err != nil {
		writeError(w, r, http.StatusBadRequest, "validation_error", "invalid profile photo encoding")
		return
	}
	if err := s.candidate.UpdatePhoto(r.Context(), id, mime, data); err != nil {
		writeError(w, r, http.StatusBadRequest, "validation_error", err.Error())
		return
	}
	w.WriteHeader(http.StatusNoContent)
}
