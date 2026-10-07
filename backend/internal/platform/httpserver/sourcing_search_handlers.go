package httpserver

import (
	"github.com/TechiAkki963/SapienWorx/backend/internal/recruiter"
	"net/http"
)

func (s *Server) recruiterSavedSearches(w http.ResponseWriter, r *http.Request) {
	id, ok := recruiterID(r)
	if !ok {
		return
	}
	if r.Method == http.MethodGet {
		items, err := s.recruiter.SavedSearches(r.Context(), id)
		if err != nil {
			s.writeRecruiterError(w, r, err)
			return
		}
		writeJSON(w, http.StatusOK, map[string]any{"items": items})
		return
	}
	var input struct {
		Name    string         `json:"name"`
		Filters map[string]any `json:"filters"`
	}
	if !decodeJSON(w, r, &input) {
		return
	}
	item, err := s.recruiter.SaveSearch(r.Context(), id, input.Name, input.Filters)
	if err != nil {
		s.writeRecruiterError(w, r, err)
		return
	}
	writeJSON(w, http.StatusCreated, item)
}

func (s *Server) recruiterRecentSearches(w http.ResponseWriter, r *http.Request) {
	id, ok := recruiterID(r)
	if !ok {
		return
	}
	items, err := s.recruiter.RecentSearches(r.Context(), id)
	if err != nil {
		s.writeRecruiterError(w, r, err)
		return
	}
	writeJSON(w, http.StatusOK, map[string]any{"items": items})
}

func (s *Server) recruiterSavedSearchAlert(w http.ResponseWriter, r *http.Request) {
	id, ok := recruiterID(r)
	if !ok {
		return
	}
	w.Header().Set("Cache-Control", "no-store")
	if r.Method == http.MethodGet {
		item, err := s.recruiter.SavedSearchByID(r.Context(), id, r.PathValue("searchID"))
		if err != nil {
			s.writeRecruiterError(w, r, err)
			return
		}
		writeJSON(w, http.StatusOK, item)
		return
	}
	if r.Method == http.MethodDelete {
		if err := s.recruiter.DeleteSavedSearch(r.Context(), id, r.PathValue("searchID")); err != nil {
			s.writeRecruiterError(w, r, err)
			return
		}
		w.WriteHeader(http.StatusNoContent)
		return
	}
	var input recruiter.SavedSearchUpdate
	if !decodeJSON(w, r, &input) {
		return
	}
	item, err := s.recruiter.UpdateSavedSearch(r.Context(), id, r.PathValue("searchID"), input)
	if err != nil {
		s.writeRecruiterError(w, r, err)
		return
	}
	writeJSON(w, http.StatusOK, item)
}

func (s *Server) recruiterSavedSearchMatches(w http.ResponseWriter, r *http.Request) {
	id, ok := recruiterID(r)
	if !ok {
		return
	}
	w.Header().Set("Cache-Control", "no-store")
	counts, err := s.recruiter.SavedSearchMatchCounts(r.Context(), id, r.PathValue("searchID"))
	if err != nil {
		s.writeRecruiterError(w, r, err)
		return
	}
	writeJSON(w, http.StatusOK, counts)
}
