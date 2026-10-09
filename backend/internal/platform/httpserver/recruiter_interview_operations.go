package httpserver

import (
	"github.com/TechiAkki963/SapienWorx/backend/internal/recruiter"
	"net/http"
)

func (s *Server) recruiterInterviewFeedback(w http.ResponseWriter, r *http.Request) {
	id, ok := recruiterID(r)
	if !ok {
		return
	}
	w.Header().Set("Cache-Control", "no-store")
	if r.Method == http.MethodGet {
		items, err := s.recruiter.InterviewFeedback(r.Context(), id, r.PathValue("interviewID"))
		if err != nil {
			s.writeRecruiterError(w, r, err)
			return
		}
		writeJSON(w, http.StatusOK, map[string]any{"items": items})
		return
	}
	var in recruiter.InterviewFeedback
	if !decodeJSON(w, r, &in) {
		return
	}
	if err := s.recruiter.SaveInterviewFeedback(r.Context(), id, r.PathValue("interviewID"), in); err != nil {
		s.writeRecruiterError(w, r, err)
		return
	}
	w.WriteHeader(http.StatusNoContent)
}
func (s *Server) recruiterInterviewResponse(w http.ResponseWriter, r *http.Request) {
	id, ok := recruiterID(r)
	if !ok {
		return
	}
	var in struct {
		Response string `json:"response"`
	}
	if !decodeJSON(w, r, &in) {
		return
	}
	if err := s.recruiter.RespondInterview(r.Context(), id, r.PathValue("interviewID"), in.Response); err != nil {
		s.writeRecruiterError(w, r, err)
		return
	}
	w.WriteHeader(http.StatusNoContent)
}
