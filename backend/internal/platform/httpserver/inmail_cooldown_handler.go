package httpserver

import (
	"errors"
	"net/http"

	"github.com/TechiAkki963/SapienWorx/backend/internal/messaging"
)

func (s *Server) recruiterInitiateInMailWithCooldown(w http.ResponseWriter, r *http.Request) {
	claims, _ := ClaimsFromContext(r.Context())
	if s.messages == nil || s.messages.service == nil {
		writeError(w, r, http.StatusServiceUnavailable, "messaging_unavailable", "messaging service is unavailable")
		return
	}
	var input messaging.InitiateInput
	if !decodeJSON(w, r, &input) {
		return
	}
	result, err := s.messages.service.InitiateWithCooldown(r.Context(), claims.Subject, input)
	if err != nil {
		if errors.Is(err, messaging.ErrCooldown) {
			writeError(w, r, http.StatusTooManyRequests, "inmail_cooldown", "this candidate has already received recruiter outreach within the 14-day cooldown")
			return
		}
		s.writeMessagingError(w, r, err)
		return
	}
	s.messages.hub.Broadcast(result.Thread.ID, messaging.NewMessageEvent(result.Message))
	writeJSON(w, http.StatusCreated, result)
}
