package httpserver

import (
	"sync"
	"time"
)

type candidateActivityGate struct {
	mu       sync.Mutex
	interval time.Duration
	now      func() time.Time
	next     map[string]time.Time
	checks   uint64
}

func newCandidateActivityGate(interval time.Duration) *candidateActivityGate {
	return &candidateActivityGate{
		interval: interval,
		now:      time.Now,
		next:     make(map[string]time.Time),
	}
}

func (g *candidateActivityGate) ShouldMark(userID string) bool {
	now := g.now().UTC()
	g.mu.Lock()
	defer g.mu.Unlock()

	g.checks++
	if g.checks%1024 == 0 || len(g.next) > 20000 {
		for id, nextAt := range g.next {
			if !nextAt.After(now) {
				delete(g.next, id)
			}
		}
	}

	if nextAt, ok := g.next[userID]; ok && nextAt.After(now) {
		return false
	}
	g.next[userID] = now.Add(g.interval)
	return true
}
