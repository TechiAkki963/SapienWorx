package httpserver

import (
	"fmt"
	"sync"
	"sync/atomic"
	"testing"
	"time"
)

func TestCandidateActivityGateAllowsOneConcurrentMarkPerUser(t *testing.T) {
	const goroutines = 1000
	gate := newCandidateActivityGate(5 * time.Minute)
	fixed := time.Date(2026, 9, 14, 18, 0, 0, 0, time.UTC)
	gate.now = func() time.Time { return fixed }

	var allowed atomic.Int64
	var wg sync.WaitGroup
	wg.Add(goroutines)
	start := make(chan struct{})

	for i := 0; i < goroutines; i++ {
		go func() {
			defer wg.Done()
			<-start
			if gate.ShouldMark("candidate-1") {
				allowed.Add(1)
			}
		}()
	}

	close(start)
	wg.Wait()

	if got := allowed.Load(); got != 1 {
		t.Fatalf("allowed marks = %d, want 1", got)
	}
}

func TestCandidateActivityGateScalesAcrossDistinctUsers(t *testing.T) {
	const users = 1000
	gate := newCandidateActivityGate(5 * time.Minute)
	fixed := time.Date(2026, 9, 14, 18, 0, 0, 0, time.UTC)
	gate.now = func() time.Time { return fixed }

	var allowed atomic.Int64
	var wg sync.WaitGroup
	wg.Add(users)

	for i := 0; i < users; i++ {
		i := i
		go func() {
			defer wg.Done()
			if gate.ShouldMark(fmt.Sprintf("candidate-%d", i)) {
				allowed.Add(1)
			}
		}()
	}
	wg.Wait()

	if got := allowed.Load(); got != users {
		t.Fatalf("allowed marks = %d, want %d", got, users)
	}

	for i := 0; i < users; i++ {
		if gate.ShouldMark(fmt.Sprintf("candidate-%d", i)) {
			t.Fatalf("candidate-%d should still be inside the activity window", i)
		}
	}
}

func TestCandidateActivityGateReopensAfterInterval(t *testing.T) {
	gate := newCandidateActivityGate(5 * time.Minute)
	now := time.Date(2026, 9, 14, 18, 0, 0, 0, time.UTC)
	gate.now = func() time.Time { return now }

	if !gate.ShouldMark("candidate-1") {
		t.Fatal("first mark should be allowed")
	}
	if gate.ShouldMark("candidate-1") {
		t.Fatal("second mark inside interval should be suppressed")
	}
	now = now.Add(5*time.Minute + time.Second)
	if !gate.ShouldMark("candidate-1") {
		t.Fatal("mark after interval should be allowed")
	}
}
