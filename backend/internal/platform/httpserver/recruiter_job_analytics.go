package httpserver

import "net/http"

func (s *Server) recruiterJobAnalytics(w http.ResponseWriter, r *http.Request) {
	id, ok := recruiterID(r)
	if !ok {
		return
	}
	result, err := s.recruiter.JobAnalytics(r.Context(), id, r.PathValue("jobID"))
	if err != nil {
		s.writeRecruiterError(w, r, err)
		return
	}
	writeJSON(w, http.StatusOK, result)
}
