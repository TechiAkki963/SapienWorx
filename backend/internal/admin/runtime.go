package admin

import (
	"context"
	"runtime"
	"time"
)

type RuntimeTelemetryAggregate struct {
	Category       string  `json:"category"`
	Events         int64   `json:"events"`
	Failures       int64   `json:"failures"`
	AverageLatency float64 `json:"average_latency_ms"`
	MaxBacklog     int64   `json:"max_backlog"`
}

type RuntimeSnapshot struct {
	ComputedAt          time.Time                   `json:"computed_at"`
	DatabaseStatus      string                      `json:"database_status"`
	DatabaseTotalConns  int32                       `json:"database_total_connections"`
	DatabaseIdleConns   int32                       `json:"database_idle_connections"`
	DatabaseActiveConns int32                       `json:"database_active_connections"`
	DatabaseMaxConns    int32                       `json:"database_max_connections"`
	DatabaseWaitCount   int64                       `json:"database_wait_count"`
	GoRoutines          int                         `json:"go_routines"`
	HeapAllocBytes      uint64                      `json:"heap_alloc_bytes"`
	HeapInUseBytes      uint64                      `json:"heap_in_use_bytes"`
	GCCycles            uint32                      `json:"gc_cycles"`
	TelemetryWindow     string                      `json:"telemetry_window"`
	Telemetry           []RuntimeTelemetryAggregate `json:"telemetry"`
}

func (s *Service) RuntimeSnapshot(ctx context.Context) (RuntimeSnapshot, error) {
	ctx, cancel := context.WithTimeout(ctx, 4*time.Second)
	defer cancel()

	status := "healthy"
	if err := s.db.Ping(ctx); err != nil {
		status = "degraded"
	}

	stats := s.db.Stat()
	var memory runtime.MemStats
	runtime.ReadMemStats(&memory)

	result := RuntimeSnapshot{
		ComputedAt:          s.now().UTC(),
		DatabaseStatus:      status,
		DatabaseTotalConns:  stats.TotalConns(),
		DatabaseIdleConns:   stats.IdleConns(),
		DatabaseActiveConns: stats.AcquiredConns(),
		DatabaseMaxConns:    stats.MaxConns(),
		DatabaseWaitCount:   stats.EmptyAcquireCount(),
		GoRoutines:          runtime.NumGoroutine(),
		HeapAllocBytes:      memory.HeapAlloc,
		HeapInUseBytes:      memory.HeapInuse,
		GCCycles:            memory.NumGC,
		TelemetryWindow:     "15m",
		Telemetry:           make([]RuntimeTelemetryAggregate, 0),
	}

	rows, err := s.db.Query(ctx, `SELECT category,
		count(*),
		count(*) FILTER (WHERE status IN ('failed','degraded','backlogged','retrying')),
		COALESCE(avg(latency_ms) FILTER (WHERE latency_ms IS NOT NULL),0)::float8,
		COALESCE(max(backlog_count),0)
		FROM admin_telemetry_events
		WHERE occurred_at >= now() - interval '15 minutes'
		GROUP BY category
		ORDER BY category`)
	if err != nil {
		return RuntimeSnapshot{}, err
	}
	defer rows.Close()
	for rows.Next() {
		var item RuntimeTelemetryAggregate
		if err := rows.Scan(&item.Category, &item.Events, &item.Failures, &item.AverageLatency, &item.MaxBacklog); err != nil {
			return RuntimeSnapshot{}, err
		}
		result.Telemetry = append(result.Telemetry, item)
	}
	if err := rows.Err(); err != nil {
		return RuntimeSnapshot{}, err
	}
	return result, nil
}
