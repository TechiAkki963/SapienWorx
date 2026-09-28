package httpserver

import (
	"net/http"
	"strconv"
	"strings"

	"github.com/TechiAkki963/SapienWorx/backend/internal/recruiter"
)

func (s *Server) recruiterCandidateContact(w http.ResponseWriter, r *http.Request) {
	id, ok := recruiterID(r)
	if !ok {
		return
	}
	contact, err := s.recruiter.CandidateContact(r.Context(), id, r.PathValue("candidateID"))
	if err != nil {
		s.writeRecruiterError(w, r, err)
		return
	}
	w.Header().Set("Cache-Control", "no-store")
	writeJSON(w, http.StatusOK, contact)
}

func (s *Server) recruiterCandidateComments(w http.ResponseWriter, r *http.Request) {
	id, ok := recruiterID(r)
	if !ok {
		return
	}
	candidateID := r.PathValue("candidateID")
	if r.Method == http.MethodGet {
		page, err := strconv.Atoi(r.URL.Query().Get("page"))
		if r.URL.Query().Get("page") == "" {
			page, err = 1, nil
		}
		if err != nil {
			s.writeRecruiterError(w, r, recruiter.ErrInvalid)
			return
		}
		result, err := s.recruiter.CandidateComments(r.Context(), id, candidateID, r.URL.Query().Get("job_id"), page)
		if err != nil {
			s.writeRecruiterError(w, r, err)
			return
		}
		w.Header().Set("Cache-Control", "no-store")
		writeJSON(w, http.StatusOK, result)
		return
	}
	var input recruiter.CandidateCommentInput
	if !decodeJSON(w, r, &input) {
		return
	}
	if err := s.recruiter.AddCandidateComment(r.Context(), id, candidateID, input); err != nil {
		s.writeRecruiterError(w, r, err)
		return
	}
	w.WriteHeader(http.StatusNoContent)
}

func (s *Server) recruiterCandidateComment(w http.ResponseWriter, r *http.Request) {
	id, ok := recruiterID(r)
	if !ok {
		return
	}
	action := "delete"
	text := ""
	if r.Method == http.MethodPatch {
		action = "edit"
		var input struct {
			Text string `json:"text"`
		}
		if !decodeJSON(w, r, &input) {
			return
		}
		text = strings.TrimSpace(input.Text)
	}
	if err := s.recruiter.ChangeCandidateComment(r.Context(), id, r.PathValue("candidateID"), r.PathValue("commentID"), action, text); err != nil {
		s.writeRecruiterError(w, r, err)
		return
	}
	w.WriteHeader(http.StatusNoContent)
}
