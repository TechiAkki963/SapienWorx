package httpserver

import (
	"net/http"
	"strings"

	"github.com/TechiAkki963/SapienWorx/backend/internal/messaging"
)

func (s *Server) recruiterOutreachSequences(w http.ResponseWriter, r *http.Request) {
	claims, _ := ClaimsFromContext(r.Context())
	if s.messages == nil || s.messages.service == nil {
		writeError(w, r, http.StatusServiceUnavailable, "messaging_unavailable", "messaging service is unavailable")
		return
	}
	if r.Method == http.MethodGet {
		items, err := s.messages.service.OutreachSequences(r.Context(), claims.Subject)
		if err != nil {
			s.writeMessagingError(w, r, err)
			return
		}
		writeJSON(w, http.StatusOK, map[string]any{"items": items})
		return
	}
	var input messaging.OutreachSequenceInput
	if !decodeJSON(w, r, &input) {
		return
	}
	item, err := s.messages.service.CreateOutreachSequence(r.Context(), claims.Subject, input)
	if err != nil {
		s.writeMessagingError(w, r, err)
		return
	}
	writeJSON(w, http.StatusCreated, item)
}

func (s *Server) recruiterOutreachCampaigns(w http.ResponseWriter, r *http.Request) {
	claims, _ := ClaimsFromContext(r.Context())
	if s.messages == nil || s.messages.service == nil {
		writeError(w, r, http.StatusServiceUnavailable, "messaging_unavailable", "messaging service is unavailable")
		return
	}
	if r.Method == http.MethodGet {
		items, err := s.messages.service.OutreachCampaigns(r.Context(), claims.Subject)
		if err != nil {
			s.writeMessagingError(w, r, err)
			return
		}
		writeJSON(w, http.StatusOK, map[string]any{"items": items})
		return
	}
	var input messaging.OutreachCampaignInput
	if !decodeJSON(w, r, &input) {
		return
	}
	item, err := s.messages.service.CreateOutreachCampaign(r.Context(), claims.Subject, input)
	if err != nil {
		s.writeMessagingError(w, r, err)
		return
	}
	writeJSON(w, http.StatusCreated, item)
}

func (s *Server) recruiterOutreachCampaignLaunch(w http.ResponseWriter, r *http.Request) {
	claims, _ := ClaimsFromContext(r.Context())
	if s.messages == nil || s.messages.service == nil || s.messages.hub == nil {
		writeError(w, r, http.StatusServiceUnavailable, "messaging_unavailable", "messaging service is unavailable")
		return
	}
	idempotencyKey := strings.TrimSpace(r.Header.Get("X-Idempotency-Key"))
	campaign, delivery, err := s.messages.service.LaunchOutreachCampaign(
		r.Context(),
		claims.Subject,
		r.PathValue("campaignID"),
		idempotencyKey,
	)
	if err != nil {
		s.writeMessagingError(w, r, err)
		return
	}
	for _, item := range delivery.Deliveries {
		s.messages.hub.Broadcast(
			messaging.InboxChannel(item.CandidateID),
			messaging.NewInboxEvent(item.ThreadID, claims.Subject),
		)
		s.messages.hub.Broadcast(
			messaging.InboxChannel(item.CandidateID),
			messaging.NewNotificationsEvent(claims.Subject),
		)
		s.messages.hub.Broadcast(
			messaging.InboxChannel(claims.Subject),
			messaging.NewInboxEvent(item.ThreadID, claims.Subject),
		)
	}
	writeJSON(w, http.StatusOK, map[string]any{
		"campaign": campaign,
		"delivery": delivery,
	})
}
