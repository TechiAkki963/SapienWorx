package httpserver

import "net/http"

func (s *Server) publicCandidateProfile(w http.ResponseWriter, r *http.Request) {
	profile, err := s.candidate.PublicProfile(r.Context(), r.PathValue("token"))
	if err != nil {
		s.writeCandidateError(w, r, err)
		return
	}
	writeJSON(w, http.StatusOK, profile)
}
