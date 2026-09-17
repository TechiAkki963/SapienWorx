package httpserver

import "net/http"

func (s *Server) publicSubprocessors(w http.ResponseWriter, r *http.Request) {
	if s.privacy == nil {
		writeError(w, r, http.StatusServiceUnavailable, "privacy_unavailable", "privacy service is unavailable")
		return
	}
	items, err := s.privacy.PublicSubprocessors(r.Context())
	if err != nil {
		s.writePrivacyError(w, r, err)
		return
	}
	writeJSON(w, http.StatusOK, map[string]any{"items": items})
}

func (s *Server) adminPrivacyRequests(w http.ResponseWriter, r *http.Request) {
	if s.privacy == nil {
		writeError(w, r, http.StatusServiceUnavailable, "privacy_unavailable", "privacy service is unavailable")
		return
	}
	items, err := s.privacy.AdminRequests(r.Context())
	if err != nil {
		s.writePrivacyError(w, r, err)
		return
	}
	writeJSON(w, http.StatusOK, map[string]any{"items": items})
}

func (s *Server) adminPrivacyIncidents(w http.ResponseWriter, r *http.Request) {
	if s.privacy == nil {
		writeError(w, r, http.StatusServiceUnavailable, "privacy_unavailable", "privacy service is unavailable")
		return
	}
	items, err := s.privacy.Incidents(r.Context())
	if err != nil {
		s.writePrivacyError(w, r, err)
		return
	}
	writeJSON(w, http.StatusOK, map[string]any{"items": items})
}

func (s *Server) adminPrivacySubprocessors(w http.ResponseWriter, r *http.Request) {
	if s.privacy == nil {
		writeError(w, r, http.StatusServiceUnavailable, "privacy_unavailable", "privacy service is unavailable")
		return
	}
	items, err := s.privacy.PublicSubprocessors(r.Context())
	if err != nil {
		s.writePrivacyError(w, r, err)
		return
	}
	writeJSON(w, http.StatusOK, map[string]any{"items": items})
}

func (s *Server) adminPrivacyProcessingActivities(w http.ResponseWriter, r *http.Request) {
	if s.privacy == nil {
		writeError(w, r, http.StatusServiceUnavailable, "privacy_unavailable", "privacy service is unavailable")
		return
	}
	items, err := s.privacy.ProcessingActivities(r.Context())
	if err != nil {
		s.writePrivacyError(w, r, err)
		return
	}
	writeJSON(w, http.StatusOK, map[string]any{"items": items})
}
