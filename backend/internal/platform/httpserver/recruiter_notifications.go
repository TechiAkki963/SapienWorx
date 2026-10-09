package httpserver

import (
	"net/http"
	"strconv"
)

func (s *Server) recruiterNotifications(w http.ResponseWriter, r *http.Request) {
	id, ok := recruiterID(r)
	if !ok {
		return
	}
	w.Header().Set("Cache-Control", "no-store")
	page, limit := 1, 25
	var err error
	if raw := r.URL.Query().Get("page"); raw != "" {
		page, err = strconv.Atoi(raw)
		if err != nil {
			writeJSON(w, 400, map[string]any{"error": map[string]string{"message": "Invalid page."}})
			return
		}
	}
	if raw := r.URL.Query().Get("limit"); raw != "" {
		limit, err = strconv.Atoi(raw)
		if err != nil {
			writeJSON(w, 400, map[string]any{"error": map[string]string{"message": "Invalid limit."}})
			return
		}
	}
	result, err := s.recruiter.Notifications(r.Context(), id, r.URL.Query().Get("category"), r.URL.Query().Get("unread") == "1", page, limit)
	if err != nil {
		s.writeRecruiterError(w, r, err)
		return
	}
	writeJSON(w, 200, result)
}
func (s *Server) recruiterNotificationChange(w http.ResponseWriter, r *http.Request) {
	id, ok := recruiterID(r)
	if !ok {
		return
	}
	var in struct {
		Action string `json:"action"`
	}
	if !decodeJSON(w, r, &in) {
		return
	}
	if err := s.recruiter.NotificationState(r.Context(), id, r.PathValue("notificationID"), in.Action); err != nil {
		s.writeRecruiterError(w, r, err)
		return
	}
	w.WriteHeader(204)
}
func (s *Server) recruiterNotificationOpen(w http.ResponseWriter, r *http.Request) {
	id, ok := recruiterID(r)
	if !ok {
		return
	}
	href, err := s.recruiter.OpenNotification(r.Context(), id, r.PathValue("notificationID"))
	if err != nil {
		s.writeRecruiterError(w, r, err)
		return
	}
	writeJSON(w, 200, map[string]string{"href": href})
}
func (s *Server) recruiterNotificationPreferences(w http.ResponseWriter, r *http.Request) {
	id, ok := recruiterID(r)
	if !ok {
		return
	}
	w.Header().Set("Cache-Control", "no-store")
	var muted *[]string
	if r.Method == http.MethodPut {
		var in struct {
			Muted []string `json:"muted_categories"`
		}
		if !decodeJSON(w, r, &in) {
			return
		}
		if in.Muted == nil {
			in.Muted = []string{}
		}
		muted = &in.Muted
	}
	items, err := s.recruiter.NotificationPreferences(r.Context(), id, muted)
	if err != nil {
		s.writeRecruiterError(w, r, err)
		return
	}
	writeJSON(w, 200, map[string]any{"muted_categories": items})
}
