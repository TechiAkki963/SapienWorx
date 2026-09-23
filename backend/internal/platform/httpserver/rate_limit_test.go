package httpserver

import (
	"net/http"
	"net/http/httptest"
	"sync"
	"sync/atomic"
	"testing"
	"time"
)

func TestIPRateLimiterBlocksAfterLimit(t *testing.T) {
	limiter := NewIPRateLimiter(2, time.Minute)
	fixed := time.Date(2026, 9, 14, 8, 0, 0, 0, time.UTC)
	limiter.now = func() time.Time { return fixed }

	handler := limiter.Middleware("otp")(http.HandlerFunc(func(w http.ResponseWriter, _ *http.Request) {
		w.WriteHeader(http.StatusNoContent)
	}))

	for i := 0; i < 3; i++ {
		req := httptest.NewRequest(http.MethodPost, "/otp", nil)
		req.RemoteAddr = "203.0.113.10:54000"
		res := httptest.NewRecorder()
		handler.ServeHTTP(res, req)
		if i < 2 && res.Code != http.StatusNoContent {
			t.Fatalf("attempt %d status = %d, want %d", i+1, res.Code, http.StatusNoContent)
		}
		if i == 2 {
			if res.Code != http.StatusTooManyRequests {
				t.Fatalf("attempt 3 status = %d, want %d", res.Code, http.StatusTooManyRequests)
			}
			if res.Header().Get("Retry-After") == "" {
				t.Fatal("Retry-After header is missing")
			}
		}
	}
}

func TestIPRateLimiterResetsWindow(t *testing.T) {
	limiter := NewIPRateLimiter(1, time.Minute)
	now := time.Date(2026, 9, 14, 8, 0, 0, 0, time.UTC)
	limiter.now = func() time.Time { return now }

	if allowed, _ := limiter.Allow("login:203.0.113.10"); !allowed {
		t.Fatal("first request should be allowed")
	}
	if allowed, _ := limiter.Allow("login:203.0.113.10"); allowed {
		t.Fatal("second request in the same window should be blocked")
	}
	now = now.Add(time.Minute + time.Second)
	if allowed, _ := limiter.Allow("login:203.0.113.10"); !allowed {
		t.Fatal("request after window reset should be allowed")
	}
}

func TestIPRateLimiterConcurrentContention(t *testing.T) {
	const (
		goroutines = 1000
		limit      = 250
	)

	limiter := NewIPRateLimiter(limit, time.Minute)
	fixed := time.Date(2026, 9, 14, 8, 0, 0, 0, time.UTC)
	limiter.now = func() time.Time { return fixed }

	var allowed atomic.Int64
	var blocked atomic.Int64
	var wg sync.WaitGroup
	wg.Add(goroutines)

	start := make(chan struct{})
	for i := 0; i < goroutines; i++ {
		go func() {
			defer wg.Done()
			<-start
			ok, _ := limiter.Allow("otp:203.0.113.10")
			if ok {
				allowed.Add(1)
				return
			}
			blocked.Add(1)
		}()
	}

	close(start)
	wg.Wait()

	if got := allowed.Load(); got != limit {
		t.Fatalf("allowed = %d, want %d", got, limit)
	}
	if got := blocked.Load(); got != goroutines-limit {
		t.Fatalf("blocked = %d, want %d", got, goroutines-limit)
	}
}

func TestRequestPeerIPDoesNotTrustForwardedHeader(t *testing.T) {
	req := httptest.NewRequest(http.MethodPost, "/login", nil)
	req.RemoteAddr = "198.51.100.20:44321"
	req.Header.Set("X-Forwarded-For", "203.0.113.99")
	if got := requestPeerIP(req); got != "198.51.100.20" {
		t.Fatalf("requestPeerIP() = %q, want socket peer", got)
	}
}

func TestCandidateApplicationGuardLimitsPerAccount(t *testing.T) {
	guard := CandidateApplicationGuard(100, 2, time.Minute)
	var served int
	handler := guard(http.HandlerFunc(func(w http.ResponseWriter, _ *http.Request) {
		served++
		w.WriteHeader(http.StatusCreated)
	}))
	tokens := testTokens(t)
	authenticate := Authenticate(tokens, "sw_access")
	candidateOnly := RequireRoles("candidate")
	protected := Chain(handler, authenticate, candidateOnly)
	for index := 0; index < 3; index++ {
		token, err := tokens.Issue("candidate-one", "candidate", "session")
		if err != nil {
			t.Fatal(err)
		}
		req := httptest.NewRequest(http.MethodPost, "/api/v1/candidate/applications", nil)
		req.RemoteAddr = "198.51.100.20:1234"
		req.Header.Set("Authorization", "Bearer "+token)
		res := httptest.NewRecorder()
		protected.ServeHTTP(res, req)
		want := http.StatusCreated
		if index == 2 {
			want = http.StatusTooManyRequests
			if res.Header().Get("Retry-After") == "" {
				t.Fatal("missing Retry-After")
			}
		}
		if res.Code != want {
			t.Fatalf("request %d status = %d, want %d", index, res.Code, want)
		}
	}
	if served != 2 {
		t.Fatalf("downstream calls = %d, want 2", served)
	}
}

func TestCandidateOnlyRejectsRecruiterBeforeApplicationGuard(t *testing.T) {
	tokens := testTokens(t)
	token, err := tokens.Issue("recruiter-one", "recruiter", "session")
	if err != nil {
		t.Fatal(err)
	}
	protected := Chain(CandidateApplicationGuard(20, 10, time.Minute)(http.HandlerFunc(func(w http.ResponseWriter, _ *http.Request) {
		w.WriteHeader(http.StatusCreated)
	})), Authenticate(tokens, "sw_access"), RequireRoles("candidate"))
	req := httptest.NewRequest(http.MethodPost, "/api/v1/candidate/applications", nil)
	req.Header.Set("Authorization", "Bearer "+token)
	res := httptest.NewRecorder()
	protected.ServeHTTP(res, req)
	if res.Code != http.StatusForbidden {
		t.Fatalf("recruiter status = %d, want 403", res.Code)
	}
}
