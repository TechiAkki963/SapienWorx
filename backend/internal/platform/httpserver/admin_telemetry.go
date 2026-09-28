package httpserver

import (
	"context"
	"time"
)

func (s *Server) recordAdminTelemetry(category, source, operation, status string, duration time.Duration, referenceID string, metadata map[string]any) {
	if s.admin == nil {
		return
	}
	latency := int(duration.Milliseconds())
	if latency < 0 {
		latency = 0
	}
	ctx, cancel := context.WithTimeout(context.Background(), 2*time.Second)
	defer cancel()
	if err := s.admin.RecordTelemetry(ctx, category, source, operation, status, &latency, 0, nil, referenceID, metadata); err != nil && s.logger != nil {
		s.logger.Warn("admin telemetry record failed", "category", category, "operation", operation, "error", err)
	}
}
