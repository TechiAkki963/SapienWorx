package httpserver

import (
	"github.com/TechiAkki963/SapienWorx/backend/internal/messaging"
	"github.com/TechiAkki963/SapienWorx/backend/internal/platform/config"
	"github.com/jackc/pgx/v5/pgxpool"
)

type messagingRuntime struct {
	service *messaging.Service
	hub     *messaging.Hub
}

func newMessagingRuntime(db DatabaseHealth, cfg config.MessagingConfig) *messagingRuntime {
	runtime := &messagingRuntime{hub: messaging.NewHub(512, 8)}
	if pool, ok := db.(*pgxpool.Pool); ok {
		runtime.service = messaging.NewServiceWithPolicy(pool, messaging.AntiSpamPolicy{
			RecruiterHourlyLimit: cfg.BulkRecruiterHourlyLimit,
			RecruiterDailyLimit:  cfg.BulkRecruiterDailyLimit,
			CompanyDailyLimit:    cfg.BulkCompanyDailyLimit,
		})
	}
	return runtime
}

func (m *messagingRuntime) Close() {
	if m != nil && m.hub != nil {
		m.hub.Close()
	}
}
