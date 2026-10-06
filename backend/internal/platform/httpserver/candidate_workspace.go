package httpserver

import "net/http"

// Only image uploads need a larger envelope. All unrelated JSON routes retain
// the configured body bound, and decoded photo size is checked by the handler.
func CandidateUploadBodyLimit(defaultLimit int64) Middleware {
	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			limit := defaultLimit
			if (r.URL.Path == "/api/v1/candidate/profile/photo" && (r.Method == http.MethodPost || r.Method == http.MethodPatch)) || (r.URL.Path == "/api/v1/users/profile-image" && r.Method == http.MethodPost) {
				limit = 7 << 20
			}
			r.Body = http.MaxBytesReader(w, r.Body, limit)
			next.ServeHTTP(w, r)
		})
	}
}

func (s *Server) candidateProfileMetrics(w http.ResponseWriter, r *http.Request) {
	id, ok := candidateID(r)
	if !ok {
		writeError(w, r, http.StatusUnauthorized, "unauthorized", "authentication required")
		return
	}
	result, err := s.candidate.ProfileMetrics(r.Context(), id)
	if err != nil {
		s.writeCandidateError(w, r, err)
		return
	}
	writeJSON(w, http.StatusOK, result)
}

func (s *Server) candidateJobLocations(w http.ResponseWriter, r *http.Request) {
	items, err := s.candidate.JobLocations(r.Context(), r.URL.Query().Get("q"))
	if err != nil {
		s.writeCandidateError(w, r, err)
		return
	}
	writeJSON(w, http.StatusOK, map[string]any{"items": items})
}
