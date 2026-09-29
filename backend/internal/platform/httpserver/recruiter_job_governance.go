package httpserver

import (
	"net/http"
	"strconv"
)

func (s *Server) recruiterTeam(w http.ResponseWriter, r *http.Request) {
	id, ok := recruiterID(r)
	if !ok {
		return
	}
	items, err := s.recruiter.RecruiterTeam(r.Context(), id)
	if err != nil {
		s.writeRecruiterError(w, r, err)
		return
	}
	writeJSON(w, http.StatusOK, map[string]any{"items": items})
}

func (s *Server) recruiterDuplicateJob(w http.ResponseWriter, r *http.Request) {
	id, ok := recruiterID(r)
	if !ok {
		return
	}
	item, err := s.recruiter.DuplicateJob(r.Context(), id, r.PathValue("jobID"))
	if err != nil {
		s.writeRecruiterError(w, r, err)
		return
	}
	writeJSON(w, http.StatusCreated, item)
}

func (s *Server) recruiterJobHistory(w http.ResponseWriter, r *http.Request) {
	id, ok := recruiterID(r)
	if !ok {
		return
	}
	limit, _ := strconv.Atoi(r.URL.Query().Get("limit"))
	items, err := s.recruiter.JobAuditHistory(r.Context(), id, r.PathValue("jobID"), limit)
	if err != nil {
		s.writeRecruiterError(w, r, err)
		return
	}
	writeJSON(w, http.StatusOK, map[string]any{"items": items})
}
