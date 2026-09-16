package httpserver

import (
	"github.com/TechiAkki963/SapienWorx/backend/internal/messaging"
	"github.com/jackc/pgx/v5/pgxpool"
)

type messagingRuntime struct {
	service *messaging.Service
	hub     *messaging.Hub
	events  *messaging.Hub
}

func newMessagingRuntime(db DatabaseHealth) *messagingRuntime {
	runtime := &messagingRuntime{
		hub:    messaging.NewHub(512, 8),
		events: messaging.NewHub(1024, 8),
	}
	if pool, ok := db.(*pgxpool.Pool); ok {
		runtime.service = messaging.NewService(pool)
	}
	return runtime
}

func (m *messagingRuntime) Close() {
	if m == nil {
		return
	}
	if m.hub != nil {
		m.hub.Close()
	}
	if m.events != nil {
		m.events.Close()
	}
}
