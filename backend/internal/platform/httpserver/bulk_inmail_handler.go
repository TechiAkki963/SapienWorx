package httpserver

import (
	"net/http"

	"github.com/TechiAkki963/SapienWorx/backend/internal/messaging"
)

func (s *Server) recruiterBulkInMail(w http.ResponseWriter, r *http.Request) {
	claims, _ := ClaimsFromContext(r.Context())
	if s.messages == nil || s.messages.service == nil {
		writeError(w, r, http.StatusServiceUnavailable, "messaging_unavailable", "messaging service is unavailable")
		return
	}
	var input messaging.BulkInitiateInput
	if !decodeJSON(w, r, &input) {
		return
	}
	result, err := s.messages.service.BulkInitiate(r.Context(), claims.Subject, input)
	if err != nil {
		s.writeMessagingError(w, r, err)
		return
	}
	if result.RecipientCount == 0 && result.SkippedCount > 0 {
		writeError(w, r, http.StatusConflict, "no_bulk_inmail_sent", "no messages were sent; all selected candidates were unavailable or within the 14-day cooldown")
		return
	}
	writeJSON(w, http.StatusAccepted, result)
}
