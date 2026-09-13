package httpserver

import (
	"net/http"

	"github.com/TechiAkki963/SapienWorx/backend/internal/recruiter"
)

func (s *Server) recruiterJobBuilder(w http.ResponseWriter, r *http.Request) {
	id, ok := recruiterID(r)
	if !ok {
		return
	}
	var input recruiter.DetailedJobInput
	if !decodeJSON(w, r, &input) {
		return
	}
	job, err := s.recruiter.CreateDetailedJob(r.Context(), id, input)
	if err != nil {
		s.writeRecruiterError(w, r, err)
		return
	}
	writeJSON(w, http.StatusCreated, job)
}
