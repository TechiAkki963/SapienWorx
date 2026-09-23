package httpserver

import (
	"net"
	"net/http"
	"strings"
	"sync"
	"time"
)

type rateWindow struct {
	count int
	reset time.Time
}

type IPRateLimiter struct {
	mu       sync.Mutex
	limit    int
	window   time.Duration
	now      func() time.Time
	items    map[string]rateWindow
	requests uint64
}

func NewIPRateLimiter(limit int, window time.Duration) *IPRateLimiter {
	return &IPRateLimiter{limit: limit, window: window, now: time.Now, items: make(map[string]rateWindow)}
}

func (l *IPRateLimiter) Allow(key string) (bool, time.Duration) {
	now := l.now().UTC()
	l.mu.Lock()
	defer l.mu.Unlock()

	l.requests++
	if l.requests%256 == 0 || len(l.items) > 4096 {
		for itemKey, item := range l.items {
			if !item.reset.After(now) {
				delete(l.items, itemKey)
			}
		}
	}

	entry, ok := l.items[key]
	if !ok || !entry.reset.After(now) {
		l.items[key] = rateWindow{count: 1, reset: now.Add(l.window)}
		return true, 0
	}
	if entry.count >= l.limit {
		return false, entry.reset.Sub(now)
	}
	entry.count++
	l.items[key] = entry
	return true, 0
}

func (l *IPRateLimiter) Middleware(scope string) Middleware {
	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			ip := requestPeerIP(r)
			allowed, retry := l.Allow(scope + ":" + ip)
			if !allowed {
				seconds := int(retry.Seconds())
				if seconds < 1 {
					seconds = 1
				}
				w.Header().Set("Retry-After", strconvItoa(seconds))
				writeError(w, r, http.StatusTooManyRequests, "rate_limited", "too many requests; try again later")
				return
			}
			next.ServeHTTP(w, r)
		})
	}
}

// CandidateApplicationGuard combines a coarse per-IP throttle with a
// per-account limit after authentication. The latter avoids punishing all
// legitimate candidates behind one shared office/mobile network.
func CandidateApplicationGuard(ipLimit, userLimit int, window time.Duration) Middleware {
	ipLimiter := NewIPRateLimiter(ipLimit, window)
	userLimiter := NewIPRateLimiter(userLimit, window)
	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			claims, ok := ClaimsFromContext(r.Context())
			if !ok {
				writeError(w, r, http.StatusUnauthorized, "unauthorized", "authentication required")
				return
			}
			ipAllowed, ipRetry := ipLimiter.Allow("application:ip:" + requestPeerIP(r))
			userAllowed, userRetry := userLimiter.Allow("application:user:" + claims.Subject)
			if !ipAllowed || !userAllowed {
				retry := ipRetry
				if userRetry > retry {
					retry = userRetry
				}
				seconds := int(retry.Seconds())
				if seconds < 1 {
					seconds = 1
				}
				w.Header().Set("Retry-After", strconvItoa(seconds))
				writeError(w, r, http.StatusTooManyRequests, "rate_limited", "too many applications; try again later")
				return
			}
			next.ServeHTTP(w, r)
		})
	}
}

func requestPeerIP(r *http.Request) string {
	// Trust only the socket peer here. A deployment proxy may normalize RemoteAddr;
	// untrusted X-Forwarded-For values must not bypass abuse controls.
	host, _, err := net.SplitHostPort(strings.TrimSpace(r.RemoteAddr))
	if err == nil && host != "" {
		return host
	}
	return strings.TrimSpace(r.RemoteAddr)
}

func strconvItoa(v int) string {
	if v == 0 {
		return "0"
	}
	buf := [20]byte{}
	i := len(buf)
	for v > 0 {
		i--
		buf[i] = byte('0' + v%10)
		v /= 10
	}
	return string(buf[i:])
}
