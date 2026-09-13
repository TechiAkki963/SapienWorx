package httpserver

import (
	"net/http"
	"strings"
)

func (s *Server) recruiterJobEducation(w http.ResponseWriter, r *http.Request) {
	id, ok := recruiterID(r)
	if !ok {
		return
	}
	var input struct {
		Education []string `json:"education"`
	}
	if !decodeJSON(w, r, &input) {
		return
	}
	for i := range input.Education {
		input.Education[i] = strings.TrimSpace(input.Education[i])
	}
	if err := s.recruiter.SetJobEducation(r.Context(), id, r.PathValue("jobID"), input.Education); err != nil {
		s.writeRecruiterError(w, r, err)
		return
	}
	w.WriteHeader(http.StatusNoContent)
}
