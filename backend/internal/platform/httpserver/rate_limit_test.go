package httpserver

import (
	"net/http"
	"net/http/httptest"
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

func TestRequestPeerIPDoesNotTrustForwardedHeader(t *testing.T) {
	req := httptest.NewRequest(http.MethodPost, "/login", nil)
	req.RemoteAddr = "198.51.100.20:44321"
	req.Header.Set("X-Forwarded-For", "203.0.113.99")
	if got := requestPeerIP(req); got != "198.51.100.20" {
		t.Fatalf("requestPeerIP() = %q, want socket peer", got)
	}
}
