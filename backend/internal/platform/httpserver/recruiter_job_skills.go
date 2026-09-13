package httpserver

import (
	"net/http"
	"strings"
)

func (s *Server) recruiterJobSkills(w http.ResponseWriter, r *http.Request) {
	id, ok := recruiterID(r)
	if !ok {
		return
	}
	var input struct {
		Skills []string `json:"skills"`
	}
	if !decodeJSON(w, r, &input) {
		return
	}
	for i := range input.Skills {
		input.Skills[i] = strings.TrimSpace(input.Skills[i])
	}
	if err := s.recruiter.SetJobSkills(r.Context(), id, r.PathValue("jobID"), input.Skills); err != nil {
		s.writeRecruiterError(w, r, err)
		return
	}
	w.WriteHeader(http.StatusNoContent)
}
