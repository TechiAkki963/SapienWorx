package httpserver

import (
	"github.com/TechiAkki963/SapienWorx/backend/internal/candidate"
	"net/http"
	"strings"
)

func (s *Server) candidateApplicationState(w http.ResponseWriter, r *http.Request) {
	id, ok := candidateID(r)
	if !ok {
		writeError(w, r, 401, "unauthorized", "authentication required")
		return
	}
	items, err := s.candidate.ApplicationStates(r.Context(), id, strings.Split(r.URL.Query().Get("job_ids"), ","), r.URL.Query().Get("details") == "true")
	if err != nil {
		s.writeCandidateError(w, r, err)
		return
	}
	writeJSON(w, 200, map[string]any{"items": items})
}
func (s *Server) candidateApplicationDraft(w http.ResponseWriter, r *http.Request) {
	id, ok := candidateID(r)
	if !ok {
		writeError(w, r, 401, "unauthorized", "authentication required")
		return
	}
	var input candidate.ApplicationSubmission
	if !decodeJSON(w, r, &input) {
		return
	}
	result, err := s.candidate.SaveApplicationDraft(r.Context(), id, input)
	if err != nil {
		s.writeCandidateError(w, r, err)
		return
	}
	writeJSON(w, 200, result)
}
func (s *Server) candidateJobEvent(w http.ResponseWriter, r *http.Request) {
	id, ok := candidateID(r)
	if !ok {
		writeError(w, r, 401, "unauthorized", "authentication required")
		return
	}
	var input struct {
		JobID string `json:"job_id"`
		Event string `json:"event"`
	}
	if !decodeJSON(w, r, &input) {
		return
	}
	if err := s.candidate.RecordClientJobEvent(r.Context(), id, input.JobID, input.Event); err != nil {
		s.writeCandidateError(w, r, err)
		return
	}
	w.WriteHeader(http.StatusNoContent)
}
