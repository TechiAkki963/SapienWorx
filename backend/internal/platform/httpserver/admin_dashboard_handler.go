package httpserver

import "net/http"

func (s *Server) adminDashboard(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Cache-Control", "no-store")
	q := r.URL.Query()
	result, err := s.admin.DashboardForOrganization(r.Context(), q.Get("period"), q.Get("from"), q.Get("to"), q.Get("company_id"), q.Get("country"))
	if err != nil {
		s.writeAdminError(w, r, err)
		return
	}
	writeJSON(w, http.StatusOK, result)
}
