package httpserver

import (
	"github.com/TechiAkki963/SapienWorx/backend/internal/messaging"
	"net/http"
	"strconv"
)

func (s *Server) candidateNotificationInbox(w http.ResponseWriter, r *http.Request) {
	id, ok := candidateID(r)
	if !ok {
		writeError(w, r, 401, "unauthorized", "authentication required")
		return
	}
	page, _ := strconv.Atoi(r.URL.Query().Get("page"))
	limit, _ := strconv.Atoi(r.URL.Query().Get("limit"))
	result, err := s.candidate.NotificationInbox(r.Context(), id, page, limit)
	if err != nil {
		s.writeCandidateError(w, r, err)
		return
	}
	w.Header().Set("Cache-Control", "private, no-store")
	writeJSON(w, 200, result)
}

func (s *Server) candidateNotificationReadAll(w http.ResponseWriter, r *http.Request) {
	id, ok := candidateID(r)
	if !ok {
		writeError(w, r, 401, "unauthorized", "authentication required")
		return
	}
	count, err := s.candidate.MarkAllNotificationsRead(r.Context(), id)
	if err != nil {
		s.writeCandidateError(w, r, err)
		return
	}
	if s.messages != nil && s.messages.hub != nil {
		s.messages.hub.Broadcast(messaging.InboxChannel(id), messaging.NewNotificationsEvent(id))
	}
	// Refresh rather than assuming no notification arrived during the update.
	inbox, err := s.candidate.NotificationInbox(r.Context(), id, 1, 1)
	if err != nil {
		s.writeCandidateError(w, r, err)
		return
	}
	writeJSON(w, 200, map[string]any{"unread_count": inbox.UnreadCount, "marked_read": count})
}
