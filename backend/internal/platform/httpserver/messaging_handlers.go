package httpserver

import (
	"context"
	"encoding/json"
	"errors"
	"net/http"
	"strconv"
	"strings"
	"time"

	"github.com/TechiAkki963/SapienWorx/backend/internal/auth"
	"github.com/TechiAkki963/SapienWorx/backend/internal/messaging"
	"github.com/gorilla/websocket"
)

func senderTypeFromClaims(role auth.Role) (messaging.SenderType, bool) {
	switch role {
	case auth.RoleCandidate:
		return messaging.SenderTypeCandidate, true
	case auth.RoleRecruiter:
		return messaging.SenderTypeRecruiter, true
	default:
		return "", false
	}
}

func (s *Server) recruiterMessageTemplates(w http.ResponseWriter, r *http.Request) {
	claims, _ := ClaimsFromContext(r.Context())
	if s.messages == nil || s.messages.service == nil {
		writeError(w, r, http.StatusServiceUnavailable, "messaging_unavailable", "messaging service is unavailable")
		return
	}
	if r.Method == http.MethodGet {
		items, err := s.messages.service.Templates(r.Context(), claims.Subject)
		if err != nil {
			s.writeMessagingError(w, r, err)
			return
		}
		writeJSON(w, http.StatusOK, map[string]any{"items": items})
		return
	}
	var input messaging.TemplateInput
	if !decodeJSON(w, r, &input) {
		return
	}
	item, err := s.messages.service.CreateTemplate(r.Context(), claims.Subject, input)
	if err != nil {
		s.writeMessagingError(w, r, err)
		return
	}
	writeJSON(w, http.StatusCreated, item)
}

func (s *Server) recruiterMessageTemplate(w http.ResponseWriter, r *http.Request) {
	claims, _ := ClaimsFromContext(r.Context())
	if s.messages == nil || s.messages.service == nil {
		writeError(w, r, http.StatusServiceUnavailable, "messaging_unavailable", "messaging service is unavailable")
		return
	}
	id := r.PathValue("templateID")
	if r.Method == http.MethodDelete {
		if err := s.messages.service.DeleteTemplate(r.Context(), claims.Subject, id); err != nil {
			s.writeMessagingError(w, r, err)
			return
		}
		w.WriteHeader(http.StatusNoContent)
		return
	}
	var input messaging.TemplateInput
	if !decodeJSON(w, r, &input) {
		return
	}
	item, err := s.messages.service.UpdateTemplate(r.Context(), claims.Subject, id, input)
	if err != nil {
		s.writeMessagingError(w, r, err)
		return
	}
	writeJSON(w, http.StatusOK, item)
}

func (s *Server) recruiterInitiateInMail(w http.ResponseWriter, r *http.Request) {
	claims, _ := ClaimsFromContext(r.Context())
	if s.messages == nil || s.messages.service == nil {
		writeError(w, r, http.StatusServiceUnavailable, "messaging_unavailable", "messaging service is unavailable")
		return
	}
	var input messaging.InitiateInput
	if !decodeJSON(w, r, &input) {
		return
	}
	result, err := s.messages.service.Initiate(r.Context(), claims.Subject, input)
	if err != nil {
		s.writeMessagingError(w, r, err)
		return
	}
	s.messages.hub.Broadcast(result.Thread.ID, messaging.NewMessageEvent(result.Message))
	writeJSON(w, http.StatusCreated, result)
}

func (s *Server) messagingThreads(w http.ResponseWriter, r *http.Request) {
	claims, _ := ClaimsFromContext(r.Context())
	sender, ok := senderTypeFromClaims(claims.Role)
	if !ok {
		writeError(w, r, http.StatusForbidden, "forbidden", "messaging is limited to candidates and recruiters")
		return
	}
	if s.messages == nil || s.messages.service == nil {
		writeError(w, r, http.StatusServiceUnavailable, "messaging_unavailable", "messaging service is unavailable")
		return
	}
	items, err := s.messages.service.Threads(r.Context(), claims.Subject, sender)
	if err != nil {
		s.writeMessagingError(w, r, err)
		return
	}
	writeJSON(w, http.StatusOK, map[string]any{"items": items})
}

func (s *Server) messagingMessages(w http.ResponseWriter, r *http.Request) {
	claims, _ := ClaimsFromContext(r.Context())
	sender, ok := senderTypeFromClaims(claims.Role)
	if !ok {
		writeError(w, r, http.StatusForbidden, "forbidden", "messaging is limited to candidates and recruiters")
		return
	}
	if s.messages == nil || s.messages.service == nil {
		writeError(w, r, http.StatusServiceUnavailable, "messaging_unavailable", "messaging service is unavailable")
		return
	}
	threadID := r.PathValue("threadID")
	if r.Method == http.MethodGet {
		limit, _ := strconv.Atoi(r.URL.Query().Get("limit"))
		items, err := s.messages.service.Messages(r.Context(), threadID, claims.Subject, limit)
		if err != nil {
			s.writeMessagingError(w, r, err)
			return
		}
		writeJSON(w, http.StatusOK, map[string]any{"items": items})
		return
	}
	var input struct {
		Content string `json:"content"`
	}
	if !decodeJSON(w, r, &input) {
		return
	}
	message, err := s.messages.service.SendMessage(r.Context(), threadID, claims.Subject, sender, input.Content)
	if err != nil {
		s.writeMessagingError(w, r, err)
		return
	}
	s.messages.hub.Broadcast(threadID, messaging.NewMessageEvent(message))
	writeJSON(w, http.StatusCreated, message)
}

func (s *Server) messagingRead(w http.ResponseWriter, r *http.Request) {
	claims, _ := ClaimsFromContext(r.Context())
	if s.messages == nil || s.messages.service == nil {
		writeError(w, r, http.StatusServiceUnavailable, "messaging_unavailable", "messaging service is unavailable")
		return
	}
	if err := s.messages.service.MarkThreadRead(r.Context(), r.PathValue("threadID"), claims.Subject); err != nil {
		s.writeMessagingError(w, r, err)
		return
	}
	w.WriteHeader(http.StatusNoContent)
}

func (s *Server) messagingSocket(w http.ResponseWriter, r *http.Request) {
	claims, _ := ClaimsFromContext(r.Context())
	sender, ok := senderTypeFromClaims(claims.Role)
	if !ok {
		writeError(w, r, http.StatusForbidden, "forbidden", "messaging is limited to candidates and recruiters")
		return
	}
	if s.messages == nil || s.messages.service == nil || s.messages.hub == nil {
		writeError(w, r, http.StatusServiceUnavailable, "messaging_unavailable", "messaging service is unavailable")
		return
	}
	threadID := r.PathValue("threadID")
	if _, err := s.messages.service.Messages(r.Context(), threadID, claims.Subject, 1); err != nil {
		s.writeMessagingError(w, r, err)
		return
	}

	upgrader := websocket.Upgrader{ReadBufferSize: 1024, WriteBufferSize: 1024, CheckOrigin: func(_ *http.Request) bool { return true }}
	conn, err := upgrader.Upgrade(w, r, nil)
	if err != nil {
		return
	}
	client := &messaging.Client{Conn: conn, UserID: claims.Subject, Send: make(chan messaging.WebSocketEvent, 16)}
	if !s.messages.hub.Register(threadID, client) {
		_ = conn.WriteControl(websocket.CloseMessage, websocket.FormatCloseMessage(websocket.CloseTryAgainLater, "messaging capacity reached"), time.Now().Add(time.Second))
		_ = conn.Close()
		return
	}
	defer conn.Close()
	defer s.messages.hub.Unregister(threadID, client)

	conn.SetReadLimit(8 << 10)
	_ = conn.SetReadDeadline(time.Now().Add(60 * time.Second))
	conn.SetPongHandler(func(string) error { return conn.SetReadDeadline(time.Now().Add(60 * time.Second)) })

	go func() {
		ticker := time.NewTicker(25 * time.Second)
		defer ticker.Stop()
		for {
			select {
			case event, ok := <-client.Send:
				_ = conn.SetWriteDeadline(time.Now().Add(10 * time.Second))
				if !ok {
					return
				}
				if err := conn.WriteJSON(event); err != nil {
					return
				}
			case <-ticker.C:
				_ = conn.SetWriteDeadline(time.Now().Add(10 * time.Second))
				if err := conn.WriteMessage(websocket.PingMessage, nil); err != nil {
					return
				}
			}
		}
	}()

	for {
		// Content is accepted temporarily so the existing Step 4 client remains
		// usable until Step 2 moves it fully to the Payload envelope.
		var inbound struct {
			messaging.WebSocketEvent
			Content string `json:"content,omitempty"`
		}
		if err := conn.ReadJSON(&inbound); err != nil {
			return
		}
		if inbound.ThreadID != "" && inbound.ThreadID != threadID {
			_ = conn.WriteControl(websocket.CloseMessage, websocket.FormatCloseMessage(websocket.ClosePolicyViolation, "thread mismatch"), time.Now().Add(time.Second))
			return
		}

		switch messaging.EventType(strings.ToLower(strings.TrimSpace(string(inbound.Type)))) {
		case messaging.EventTypeMessage:
			var payload messaging.MessageInputPayload
			if len(inbound.Payload) > 0 {
				if err := json.Unmarshal(inbound.Payload, &payload); err != nil {
					_ = conn.WriteControl(websocket.CloseMessage, websocket.FormatCloseMessage(websocket.CloseUnsupportedData, "invalid message payload"), time.Now().Add(time.Second))
					return
				}
			} else {
				payload.Content = inbound.Content
			}
			message, err := s.messages.service.SendMessage(r.Context(), threadID, claims.Subject, sender, payload.Content)
			if err != nil {
				_ = conn.WriteControl(websocket.CloseMessage, websocket.FormatCloseMessage(websocket.ClosePolicyViolation, "message rejected"), time.Now().Add(time.Second))
				return
			}
			s.messages.hub.Broadcast(threadID, messaging.NewMessageEvent(message))

		case messaging.EventTypeTyping:
			var payload messaging.TypingPayload
			if len(inbound.Payload) == 0 || json.Unmarshal(inbound.Payload, &payload) != nil {
				_ = conn.WriteControl(websocket.CloseMessage, websocket.FormatCloseMessage(websocket.CloseUnsupportedData, "invalid typing payload"), time.Now().Add(time.Second))
				return
			}
			// Typing is deliberately transient: no service method and no database I/O.
			s.messages.hub.BroadcastExceptUser(threadID, claims.Subject, messaging.NewTypingEvent(threadID, claims.Subject, payload.IsTyping))

		case messaging.EventTypeRead:
			var payload messaging.ReadPayload
			if len(inbound.Payload) > 0 && json.Unmarshal(inbound.Payload, &payload) != nil {
				_ = conn.WriteControl(websocket.CloseMessage, websocket.FormatCloseMessage(websocket.CloseUnsupportedData, "invalid read payload"), time.Now().Add(time.Second))
				return
			}

			if len(payload.MessageIDs) == 0 {
				// Compatibility bridge for the Step 4 whole-thread read event. Step 2
				// will switch the client to explicit viewport message IDs.
				go func() {
					ctx, cancel := context.WithTimeout(context.Background(), 3*time.Second)
					defer cancel()
					if err := s.messages.service.MarkThreadRead(ctx, threadID, claims.Subject); err != nil {
						s.logger.Warn("legacy websocket read update failed", "error", err, "thread_id", threadID)
					}
				}()
				continue
			}

			if len(payload.MessageIDs) > messaging.MaxReadReceiptBatch {
				_ = conn.WriteControl(websocket.CloseMessage, websocket.FormatCloseMessage(websocket.ClosePolicyViolation, "read receipt batch too large"), time.Now().Add(time.Second))
				return
			}
			messageIDs := append([]string(nil), payload.MessageIDs...)
			go func() {
				ctx, cancel := context.WithTimeout(context.Background(), 3*time.Second)
				defer cancel()
				results, err := s.messages.service.MarkMessagesRead(ctx, threadID, claims.Subject, messageIDs)
				if err != nil {
					s.logger.Warn("websocket read receipt update failed", "error", err, "thread_id", threadID)
					return
				}
				for _, result := range results {
					s.messages.hub.BroadcastToUser(threadID, result.SenderID, messaging.NewReadEvent(threadID, claims.Subject, result.MessageIDs))
				}
			}()

		default:
			_ = conn.WriteControl(websocket.CloseMessage, websocket.FormatCloseMessage(websocket.CloseUnsupportedData, "unsupported event"), time.Now().Add(time.Second))
			return
		}
	}
}

func (s *Server) writeMessagingError(w http.ResponseWriter, r *http.Request, err error) {
	switch {
	case errors.Is(err, messaging.ErrInvalidInput):
		writeError(w, r, http.StatusBadRequest, "invalid_request", "messaging input is invalid")
	case errors.Is(err, messaging.ErrForbidden):
		writeError(w, r, http.StatusForbidden, "forbidden", "you do not have access to this messaging resource")
	case errors.Is(err, messaging.ErrNotFound):
		writeError(w, r, http.StatusNotFound, "not_found", "messaging resource was not found")
	case errors.Is(err, messaging.ErrThreadClosed):
		writeError(w, r, http.StatusConflict, "thread_closed", "this conversation is closed")
	default:
		s.logger.Error("messaging request failed", "error", err, "request_id", RequestIDFromContext(r.Context()))
		writeError(w, r, http.StatusInternalServerError, "internal_error", "messaging request failed")
	}
}
