package httpserver

import "net/http"

func (s *Server) candidateRecommendations(w http.ResponseWriter, r *http.Request) {
	claims, ok := ClaimsFromContext(r.Context())
	if !ok {
		return
	}
	items, err := s.candidate.Recommendations(r.Context(), claims.Subject, 65, 8)
	if err != nil {
		s.logger.Error("candidate recommendations failed", "error", err, "request_id", RequestIDFromContext(r.Context()))
		writeError(w, r, http.StatusInternalServerError, "internal_error", "recommendations could not be loaded")
		return
	}
	writeJSON(w, http.StatusOK, map[string]any{"items": items, "minimum_match": 65})
}
