package httpserver

import (
	"context"
	"log/slog"
	"time"

	"github.com/TechiAkki963/SapienWorx/backend/internal/messaging"
	"github.com/TechiAkki963/SapienWorx/backend/internal/platform/config"
	"github.com/jackc/pgx/v5/pgxpool"
)

type messagingRuntime struct {
	service *messaging.Service
	hub     *messaging.Hub
	cancel  context.CancelFunc
}

func newMessagingRuntime(db DatabaseHealth, cfg config.MessagingConfig, logger *slog.Logger) *messagingRuntime {
	runtime := &messagingRuntime{hub: messaging.NewHub(512, 8)}
	if pool, ok := db.(*pgxpool.Pool); ok {
		runtime.service = messaging.NewServiceWithPolicy(pool, messaging.AntiSpamPolicy{
			RecruiterHourlyLimit: cfg.BulkRecruiterHourlyLimit,
			RecruiterDailyLimit:  cfg.BulkRecruiterDailyLimit,
			CompanyDailyLimit:    cfg.BulkCompanyDailyLimit,
		})
		ctx, cancel := context.WithCancel(context.Background())
		runtime.cancel = cancel
		go runtime.runOutreachWorker(ctx, logger)
	}
	return runtime
}

func (m *messagingRuntime) runOutreachWorker(ctx context.Context, logger *slog.Logger) {
	if m == nil || m.service == nil || m.hub == nil {
		return
	}
	ticker := time.NewTicker(time.Minute)
	defer ticker.Stop()

	for {
		select {
		case <-ctx.Done():
			return
		case <-ticker.C:
			runCtx, cancel := context.WithTimeout(ctx, 25*time.Second)
			events, err := m.service.ProcessDueOutreach(runCtx, 50)
			cancel()
			if err != nil {
				if logger != nil {
					logger.Warn("outreach sequence worker failed", "error", err)
				}
				continue
			}
			for _, event := range events {
				m.hub.Broadcast(event.ThreadID, messaging.NewMessageEvent(event.Message))
				m.hub.Broadcast(messaging.InboxChannel(event.CandidateID), messaging.NewInboxEvent(event.ThreadID, event.RecruiterID))
				m.hub.Broadcast(messaging.InboxChannel(event.CandidateID), messaging.NewNotificationsEvent(event.RecruiterID))
				m.hub.Broadcast(messaging.InboxChannel(event.RecruiterID), messaging.NewInboxEvent(event.ThreadID, event.RecruiterID))
			}
		}
	}
}

func (m *messagingRuntime) Close() {
	if m == nil {
		return
	}
	if m.cancel != nil {
		m.cancel()
	}
	if m.hub != nil {
		m.hub.Close()
	}
}
