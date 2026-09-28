package httpserver

import (
	"github.com/TechiAkki963/SapienWorx/backend/internal/admin"
	"net/http"
)

func recruitmentFilters(r *http.Request) admin.RecruitmentFilter {
	q := r.URL.Query()
	page, limit := parseAdminPage(r)
	return admin.RecruitmentFilter{Query: q.Get("q"), CompanyID: q.Get("company_id"), Country: q.Get("country"), JobID: q.Get("job_id"), Stage: q.Get("stage"), Status: q.Get("status"), From: q.Get("from"), Before: q.Get("before"), Upcoming: q.Get("upcoming") == "true", Page: page, Limit: limit}
}
func (s *Server) adminApplications(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Cache-Control", "no-store")
	data, err := s.admin.Applications(r.Context(), recruitmentFilters(r))
	if err != nil {
		s.writeAdminError(w, r, err)
		return
	}
	writeJSON(w, 200, data)
}
func (s *Server) adminInterviews(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Cache-Control", "no-store")
	if value := r.URL.Query().Get("upcoming"); value != "" && value != "true" && value != "false" {
		writeError(w, r, 400, "invalid_request", "upcoming must be true or false")
		return
	}
	data, err := s.admin.Interviews(r.Context(), recruitmentFilters(r))
	if err != nil {
		s.writeAdminError(w, r, err)
		return
	}
	writeJSON(w, 200, data)
}
func (s *Server) adminApplicationHistory(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Cache-Control", "no-store")
	page, limit := parseAdminPage(r)
	data, err := s.admin.ApplicationHistory(r.Context(), r.PathValue("applicationID"), page, limit)
	if err != nil {
		s.writeAdminError(w, r, err)
		return
	}
	writeJSON(w, 200, data)
}
