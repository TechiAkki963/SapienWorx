package httpserver

import (
	"context"
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
		items, err := s.messages.service.Sequences(r.Context(), claims.Subject)
		if err != nil {
			s.writeMessagingError(w, r, err)
			return
		}
		writeJSON(w, http.StatusOK, map[string]any{"items": items})
		return
	}
	var input messaging.SequenceInput
	if !decodeJSON(w, r, &input) {
		return
	}
	item, err := s.messages.service.CreateSequence(r.Context(), claims.Subject, input)
	if err != nil {
		s.writeMessagingError(w, r, err)
		return
	}
	writeJSON(w, http.StatusCreated, item)
}

func (s *Server) recruiterOutreachSequence(w http.ResponseWriter, r *http.Request) {
	claims, _ := ClaimsFromContext(r.Context())
	if s.messages == nil || s.messages.service == nil {
		writeError(w, r, http.StatusServiceUnavailable, "messaging_unavailable", "messaging service is unavailable")
		return
	}
	var input messaging.SequenceInput
	if !decodeJSON(w, r, &input) {
		return
	}
	item, err := s.messages.service.UpdateSequence(r.Context(), claims.Subject, r.PathValue("sequenceID"), input)
	if err != nil {
		s.writeMessagingError(w, r, err)
		return
	}
	writeJSON(w, http.StatusOK, item)
}

func (s *Server) recruiterOutreachSequenceStatus(w http.ResponseWriter, r *http.Request) {
	claims, _ := ClaimsFromContext(r.Context())
	if s.messages == nil || s.messages.service == nil {
		writeError(w, r, http.StatusServiceUnavailable, "messaging_unavailable", "messaging service is unavailable")
		return
	}
	var input struct {
		Status string `json:"status"`
	}
	if !decodeJSON(w, r, &input) {
		return
	}
	if err := s.messages.service.SetSequenceStatus(r.Context(), claims.Subject, r.PathValue("sequenceID"), input.Status); err != nil {
		s.writeMessagingError(w, r, err)
		return
	}
	w.WriteHeader(http.StatusNoContent)
}

func (s *Server) recruiterOutreachCampaigns(w http.ResponseWriter, r *http.Request) {
	claims, _ := ClaimsFromContext(r.Context())
	if s.messages == nil || s.messages.service == nil {
		writeError(w, r, http.StatusServiceUnavailable, "messaging_unavailable", "messaging service is unavailable")
		return
	}
	if r.Method == http.MethodGet {
		items, err := s.messages.service.Campaigns(r.Context(), claims.Subject)
		if err != nil {
			s.writeMessagingError(w, r, err)
			return
		}
		writeJSON(w, http.StatusOK, map[string]any{"items": items})
		return
	}
	var input messaging.CampaignLaunchInput
	if !decodeJSON(w, r, &input) {
		return
	}
	input.LaunchKey = strings.TrimSpace(r.Header.Get("X-Idempotency-Key"))
	result, err := s.messages.service.LaunchCampaign(r.Context(), claims.Subject, input)
	if err != nil {
		s.writeMessagingError(w, r, err)
		return
	}
	skipped := make(map[string]struct{}, len(result.Bulk.SkippedCandidateIDs))
	for _, candidateID := range result.Bulk.SkippedCandidateIDs {
		skipped[candidateID] = struct{}{}
	}
	for _, candidateID := range input.CandidateIDs {
		candidateID = strings.TrimSpace(candidateID)
		if candidateID == "" {
			continue
		}
		if _, wasSkipped := skipped[candidateID]; wasSkipped {
			continue
		}
		s.messages.hub.Broadcast(messaging.InboxChannel(candidateID), messaging.NewInboxEvent("", claims.Subject))
		s.messages.hub.Broadcast(messaging.InboxChannel(candidateID), messaging.NewNotificationsEvent(claims.Subject))
	}
	if result.Bulk.SentCount > 0 {
		s.messages.hub.Broadcast(messaging.InboxChannel(claims.Subject), messaging.NewInboxEvent("", claims.Subject))
	}
	writeJSON(w, http.StatusCreated, result)
}

func (s *Server) recruiterOutreachCampaignStatus(w http.ResponseWriter, r *http.Request) {
	claims, _ := ClaimsFromContext(r.Context())
	if s.messages == nil || s.messages.service == nil {
		writeError(w, r, http.StatusServiceUnavailable, "messaging_unavailable", "messaging service is unavailable")
		return
	}
	var input struct {
		Action string `json:"action"`
	}
	if !decodeJSON(w, r, &input) {
		return
	}
	if err := s.messages.service.SetCampaignStatus(r.Context(), claims.Subject, r.PathValue("campaignID"), input.Action); err != nil {
		s.writeMessagingError(w, r, err)
		return
	}
	w.WriteHeader(http.StatusNoContent)
}

// RunOutreachPass processes scheduled sequence follow-ups. Work is claimed with
// row locking and each step is idempotent, so this can safely run on every API
// replica while PostgreSQL remains the coordination source of truth.
func (s *Server) RunOutreachPass(ctx context.Context) (int, error) {
	if s.messages == nil || s.messages.service == nil || s.messages.hub == nil {
		return 0, nil
	}
	events, err := s.messages.service.ProcessDueOutreach(ctx, 25)
	if err != nil {
		return len(events), err
	}
	for _, event := range events {
		s.messages.hub.Broadcast(event.ThreadID, messaging.NewMessageEvent(event.Message))
		s.messages.hub.Broadcast(messaging.InboxChannel(event.CandidateID), messaging.NewInboxEvent(event.ThreadID, event.Message.SenderID))
		s.messages.hub.Broadcast(messaging.InboxChannel(event.CandidateID), messaging.NewNotificationsEvent(event.Message.SenderID))
		s.messages.hub.Broadcast(messaging.InboxChannel(event.Message.SenderID), messaging.NewInboxEvent(event.ThreadID, event.Message.SenderID))
	}
	return len(events), nil
}
