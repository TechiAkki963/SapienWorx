package httpserver

import "net/http"

func (s *Server) adminOrganizations(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Cache-Control", "no-store")
	page, limit := parseAdminPage(r)
	data, err := s.admin.Organizations(r.Context(), r.URL.Query().Get("q"), r.URL.Query().Get("verification"), r.URL.Query().Get("country"), page, limit)
	if err != nil {
		s.writeAdminError(w, r, err)
		return
	}
	writeJSON(w, http.StatusOK, data)
}

func (s *Server) adminReactivateUser(w http.ResponseWriter, r *http.Request) {
	s.adminAccountAction(w, r, "reactivate")
}
func (s *Server) adminRevokeUserSessions(w http.ResponseWriter, r *http.Request) {
	s.adminAccountAction(w, r, "revoke_sessions")
}
func (s *Server) adminAccountAction(w http.ResponseWriter, r *http.Request, action string) {
	w.Header().Set("Cache-Control", "no-store")
	actor, ok := adminClaimsID(r)
	if !ok {
		writeError(w, r, http.StatusForbidden, "admin_forbidden", "master admin access denied")
		return
	}
	reason, ok := decodeAdminReason(w, r)
	if !ok {
		return
	}
	var err error
	if action == "reactivate" {
		err = s.admin.ReactivateUser(r.Context(), r.PathValue("userID"), actor, reason, clientIP(r.RemoteAddr), RequestIDFromContext(r.Context()))
	} else {
		err = s.admin.RevokeUserSessions(r.Context(), r.PathValue("userID"), actor, reason, clientIP(r.RemoteAddr), RequestIDFromContext(r.Context()))
	}
	if err != nil {
		s.writeAdminError(w, r, err)
		return
	}
	writeJSON(w, http.StatusOK, map[string]bool{"updated": true})
}
