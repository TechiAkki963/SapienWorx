package httpserver

import (
	"github.com/TechiAkki963/SapienWorx/backend/internal/messaging"
	"github.com/jackc/pgx/v5/pgxpool"
)

var (
	messagingService *messaging.Service
	messageHub       = messaging.NewHub(512, 8)
)

func bootstrapMessaging(db DatabaseHealth) {
	messageHub = messaging.NewHub(512, 8)
	pool, ok := db.(*pgxpool.Pool)
	if !ok {
		messagingService = nil
		return
	}
	messagingService = messaging.NewService(pool)
}
