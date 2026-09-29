package httpserver

import "net/http"

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
