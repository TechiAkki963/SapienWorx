package httpserver

import (
	"errors"
	"net/http"
	"strconv"
	"strings"

	"github.com/TechiAkki963/SapienWorx/backend/internal/recruiter"
)

func recruiterID(r *http.Request) (string, bool) {
	claims, ok := ClaimsFromContext(r.Context())
	return claims.Subject, ok
}

func (s *Server) recruiterDashboard(w http.ResponseWriter, r *http.Request) {
	id, ok := recruiterID(r)
	if !ok {
		return
	}
	result, err := s.recruiter.Dashboard(r.Context(), id)
	if err != nil {
		s.writeRecruiterError(w, r, err)
		return
	}
	writeJSON(w, http.StatusOK, result)
}

func (s *Server) recruiterJobs(w http.ResponseWriter, r *http.Request) {
	id, ok := recruiterID(r)
	if !ok {
		return
	}
	if r.Method == http.MethodGet {
		items, err := s.recruiter.Jobs(r.Context(), id)
		if err != nil {
			s.writeRecruiterError(w, r, err)
			return
		}
		writeJSON(w, http.StatusOK, map[string]any{"items": items})
		return
	}
	var input recruiter.JobInput
	if !decodeJSON(w, r, &input) {
		return
	}
	item, err := s.recruiter.CreateJob(r.Context(), id, input)
	if err != nil {
		s.writeRecruiterError(w, r, err)
		return
	}
	writeJSON(w, http.StatusCreated, item)
}

func (s *Server) recruiterJobStatus(w http.ResponseWriter, r *http.Request) {
	id, ok := recruiterID(r)
	if !ok {
		return
	}
	var input struct {
		Status string `json:"status"`
	}
	if !decodeJSON(w, r, &input) {
		return
	}
	if err := s.recruiter.SetJobStatus(r.Context(), id, r.PathValue("jobID"), strings.TrimSpace(input.Status)); err != nil {
		s.writeRecruiterError(w, r, err)
		return
	}
	w.WriteHeader(http.StatusNoContent)
}

func (s *Server) recruiterPipeline(w http.ResponseWriter, r *http.Request) {
	id, ok := recruiterID(r)
	if !ok {
		return
	}
	page, _ := strconv.Atoi(r.URL.Query().Get("page"))
	limit, _ := strconv.Atoi(r.URL.Query().Get("limit"))
	result, err := s.recruiter.Pipeline(r.Context(), id, r.URL.Query().Get("q"), r.URL.Query().Get("stage"), r.URL.Query().Get("job_id"), page, limit)
	if err != nil {
		s.writeRecruiterError(w, r, err)
		return
	}
	writeJSON(w, http.StatusOK, result)
}

func (s *Server) recruiterCandidateDetail(w http.ResponseWriter, r *http.Request) {
	id, ok := recruiterID(r)
	if !ok {
		return
	}
	result, err := s.recruiter.CandidateDetail(r.Context(), id, r.PathValue("candidateID"))
	if err != nil {
		s.writeRecruiterError(w, r, err)
		return
	}
	writeJSON(w, http.StatusOK, result)
}

func (s *Server) recruiterApplicationStage(w http.ResponseWriter, r *http.Request) {
	id, ok := recruiterID(r)
	if !ok {
		return
	}
	var input struct {
		Stage string `json:"stage"`
	}
	if !decodeJSON(w, r, &input) {
		return
	}
	if err := s.recruiter.UpdateStage(r.Context(), id, r.PathValue("applicationID"), strings.TrimSpace(input.Stage)); err != nil {
		s.writeRecruiterError(w, r, err)
		return
	}
	w.WriteHeader(http.StatusNoContent)
}

func (s *Server) recruiterInterviews(w http.ResponseWriter, r *http.Request) {
	id, ok := recruiterID(r)
	if !ok {
		return
	}
	if r.Method == http.MethodGet {
		items, err := s.recruiter.Interviews(r.Context(), id)
		if err != nil {
			s.writeRecruiterError(w, r, err)
			return
		}
		writeJSON(w, http.StatusOK, map[string]any{"items": items})
		return
	}
	var input recruiter.InterviewInput
	if !decodeJSON(w, r, &input) {
		return
	}
	item, err := s.recruiter.ScheduleInterview(r.Context(), id, input)
	if err != nil {
		s.writeRecruiterError(w, r, err)
		return
	}
	writeJSON(w, http.StatusCreated, item)
}

func (s *Server) writeRecruiterError(w http.ResponseWriter, r *http.Request, err error) {
	switch {
	case errors.Is(err, recruiter.ErrNotFound):
		writeError(w, r, http.StatusNotFound, "not_found", "recruiter resource was not found or is unavailable")
	case errors.Is(err, recruiter.ErrInvalid):
		writeError(w, r, http.StatusBadRequest, "validation_error", "invalid recruiter workspace input")
	default:
		s.logger.Error("recruiter operation failed", "error", err, "request_id", RequestIDFromContext(r.Context()))
		writeError(w, r, http.StatusInternalServerError, "internal_error", "recruiter operation failed")
	}
}
