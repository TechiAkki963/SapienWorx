package httpserver

import (
	"net/http"
	"strconv"
)

func (s *Server) recruiterTalentOverview(w http.ResponseWriter, r *http.Request) {
	id, ok := recruiterID(r)
	if !ok {
		return
	}
	days := 30
	if raw := r.URL.Query().Get("days"); raw != "" {
		var err error
		days, err = strconv.Atoi(raw)
		if err != nil {
			writeError(w, r, 400, "invalid_request", "Choose 7, 30 or 90 days")
			return
		}
	}
	result, err := s.recruiter.TalentOverview(r.Context(), id, days)
	if err != nil {
		s.writeRecruiterError(w, r, err)
		return
	}
	w.Header().Set("Cache-Control", "no-store")
	writeJSON(w, 200, result)
}
func (s *Server) candidateOutreachInterest(w http.ResponseWriter, r *http.Request) {
	claims, ok := ClaimsFromContext(r.Context())
	if !ok {
		writeError(w, r, 401, "unauthorized", "Sign in to continue")
		return
	}
	result, err := s.recruiter.CandidateOutreachInterest(r.Context(), claims.Subject, r.PathValue("threadID"), r.Method == http.MethodPost)
	if err != nil {
		s.writeRecruiterError(w, r, err)
		return
	}
	w.Header().Set("Cache-Control", "no-store")
	writeJSON(w, 200, result)
}

func (s *Server) recruiterTalentUsage(w http.ResponseWriter, r *http.Request) {
	id, ok := recruiterID(r)
	if !ok {
		return
	}
	result, err := s.recruiter.TalentPlan(r.Context(), id)
	if err != nil {
		s.writeRecruiterError(w, r, err)
		return
	}
	w.Header().Set("Cache-Control", "no-store")
	writeJSON(w, 200, result)
}
