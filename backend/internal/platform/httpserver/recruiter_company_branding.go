package httpserver

import "net/http"

func (s *Server) recruiterCompanyBranding(w http.ResponseWriter, r *http.Request) {
	id, ok := recruiterID(r)
	if !ok {
		return
	}
	if r.Method == http.MethodGet {
		result, err := s.recruiter.CompanyBranding(r.Context(), id)
		if err != nil {
			s.writeRecruiterError(w, r, err)
			return
		}
		writeJSON(w, http.StatusOK, result)
		return
	}
	var input struct {
		LogoURL string `json:"logo_url"`
	}
	if !decodeJSON(w, r, &input) {
		return
	}
	if err := s.recruiter.UpdateCompanyLogo(r.Context(), id, input.LogoURL); err != nil {
		s.writeRecruiterError(w, r, err)
		return
	}
	w.WriteHeader(http.StatusNoContent)
}
