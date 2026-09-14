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
	pool, ok := db.(*pgxpool.Pool)
	if !ok {
		return
	}
	messagingService = messaging.NewService(pool)
}
