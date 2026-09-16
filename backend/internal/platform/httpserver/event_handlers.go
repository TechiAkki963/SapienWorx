package httpserver

import (
	"net/http"
	"time"

	"github.com/TechiAkki963/SapienWorx/backend/internal/messaging"
	"github.com/gorilla/websocket"
)

func (s *Server) eventSocket(w http.ResponseWriter, r *http.Request) {
	claims, ok := ClaimsFromContext(r.Context())
	if !ok {
		writeError(w, r, http.StatusUnauthorized, "unauthorized", "authentication required")
		return
	}
	if s.messages == nil || s.messages.events == nil {
		writeError(w, r, http.StatusServiceUnavailable, "events_unavailable", "realtime events are unavailable")
		return
	}

	upgrader := websocket.Upgrader{
		ReadBufferSize:  1024,
		WriteBufferSize: 1024,
		CheckOrigin:      func(_ *http.Request) bool { return true },
	}
	conn, err := upgrader.Upgrade(w, r, nil)
	if err != nil {
		return
	}
	channel := "user:" + claims.Subject
	client := &messaging.Client{Conn: conn, UserID: claims.Subject, Send: make(chan messaging.WebSocketEvent, 16)}
	if !s.messages.events.Register(channel, client) {
		_ = conn.WriteControl(websocket.CloseMessage, websocket.FormatCloseMessage(websocket.CloseTryAgainLater, "event capacity reached"), time.Now().Add(time.Second))
		_ = conn.Close()
		return
	}
	defer conn.Close()
	defer s.messages.events.Unregister(channel, client)

	conn.SetReadLimit(1024)
	_ = conn.SetReadDeadline(time.Now().Add(60 * time.Second))
	conn.SetPongHandler(func(string) error { return conn.SetReadDeadline(time.Now().Add(60 * time.Second)) })

	done := make(chan struct{})
	go func() {
		defer close(done)
		ticker := time.NewTicker(25 * time.Second)
		defer ticker.Stop()
		for {
			select {
			case event, open := <-client.Send:
				if !open {
					return
				}
				_ = conn.SetWriteDeadline(time.Now().Add(10 * time.Second))
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
		select {
		case <-done:
			return
		default:
			if _, _, err := conn.ReadMessage(); err != nil {
				return
			}
		}
	}
}
