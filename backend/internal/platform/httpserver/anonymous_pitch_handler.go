package httpserver

import "net/http"

func (s *Server) recruiterCandidatePitch(w http.ResponseWriter, r *http.Request) {
	id, ok := recruiterID(r)
	if !ok {
		return
	}
	result, err := s.recruiter.CandidateAnonymousPitch(r.Context(), id, r.PathValue("candidateID"))
	if err != nil {
		s.writeRecruiterError(w, r, err)
		return
	}
	writeJSON(w, http.StatusOK, result)
}
