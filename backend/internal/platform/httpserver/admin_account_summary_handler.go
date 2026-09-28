package httpserver

import "net/http"

func (s *Server) adminAccountSummary(w http.ResponseWriter, r *http.Request) {
	result, err := s.admin.AccountSummary(r.Context(), r.PathValue("userID"))
	if err != nil {
		s.writeAdminError(w, r, err)
		return
	}
	w.Header().Set("Cache-Control", "no-store")
	writeJSON(w, http.StatusOK, result)
}
