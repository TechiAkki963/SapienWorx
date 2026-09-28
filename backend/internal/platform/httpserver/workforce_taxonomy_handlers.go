package httpserver

import (
	"errors"
	"net/http"
	"strconv"
	"strings"

	"github.com/TechiAkki963/SapienWorx/backend/internal/workforce"
)

func (s *Server) workforceTaxonomySuggest(w http.ResponseWriter, r *http.Request) {
	query := strings.TrimSpace(r.URL.Query().Get("q"))
	types := r.URL.Query()["type"]
	limit, _ := strconv.Atoi(r.URL.Query().Get("limit"))
	items, err := s.workforce.Suggest(r.Context(), query, types, limit)
	if err != nil {
		if errors.Is(err, workforce.ErrInvalid) {
			writeError(w, r, http.StatusBadRequest, "invalid_taxonomy_query", "taxonomy query is invalid")
			return
		}
		s.logger.Error("taxonomy suggestion lookup failed", "error", err, "request_id", RequestIDFromContext(r.Context()))
		writeError(w, r, http.StatusServiceUnavailable, "taxonomy_unavailable", "taxonomy suggestions are temporarily unavailable")
		return
	}
	writeJSON(w, http.StatusOK, map[string]any{"items": items})
}

func (s *Server) adminWorkforceTaxonomy(w http.ResponseWriter, r *http.Request) {
	result, err := s.workforce.Dashboard(r.Context())
	if err != nil {
		s.logger.Error("taxonomy dashboard lookup failed", "error", err, "request_id", RequestIDFromContext(r.Context()))
		writeError(w, r, http.StatusServiceUnavailable, "taxonomy_unavailable", "taxonomy dashboard is temporarily unavailable")
		return
	}
	writeJSON(w, http.StatusOK, result)
}

func (s *Server) adminResolveWorkforceTaxonomyTerm(w http.ResponseWriter, r *http.Request) {
	actor, ok := adminClaimsID(r)
	if !ok {
		writeError(w, r, http.StatusForbidden, "admin_forbidden", "master admin access denied")
		return
	}
	var input workforce.ResolveInput
	if !decodeJSON(w, r, &input) {
		return
	}
	err := s.workforce.ResolveProvisional(r.Context(), strings.TrimSpace(r.PathValue("termID")), actor, input)
	switch {
	case errors.Is(err, workforce.ErrInvalid):
		writeError(w, r, http.StatusBadRequest, "invalid_taxonomy_resolution", "taxonomy resolution is invalid")
	case errors.Is(err, workforce.ErrNotFound):
		writeError(w, r, http.StatusNotFound, "taxonomy_term_not_found", "provisional taxonomy term was not found")
	case errors.Is(err, workforce.ErrConflict):
		writeError(w, r, http.StatusConflict, "taxonomy_term_resolved", "provisional taxonomy term has already been reviewed")
	case err != nil:
		s.logger.Error("taxonomy provisional review failed", "error", err, "term_id", r.PathValue("termID"), "request_id", RequestIDFromContext(r.Context()))
		writeError(w, r, http.StatusServiceUnavailable, "taxonomy_review_unavailable", "taxonomy review is temporarily unavailable")
	default:
		writeJSON(w, http.StatusOK, map[string]bool{"resolved": true})
	}
}
