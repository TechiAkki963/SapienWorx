package httpserver

import (
	"context"
	"net/http"
	"net/http/httptest"
	"testing"
	"time"

	"github.com/TechiAkki963/SapienWorx/backend/internal/auth"
)

func TestAuthenticateAcceptsAccessCookie(t *testing.T) {
	tokens, err := auth.NewTokenManager("01234567890123456789012345678901", "issuer", "audience", 15*time.Minute, 30*time.Second)
	if err != nil {
		t.Fatal(err)
	}
	token, err := tokens.Issue("user-1", auth.RoleCandidate, "session-1")
	if err != nil {
		t.Fatal(err)
	}
	handler := Authenticate(tokens, "sw_access")(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		claims, ok := ClaimsFromContext(r.Context())
		if !ok || claims.Subject != "user-1" {
			t.Fatal("claims missing")
		}
		w.WriteHeader(http.StatusNoContent)
	}))
	req := httptest.NewRequest(http.MethodGet, "/", nil)
	req.AddCookie(&http.Cookie{Name: "sw_access", Value: token})
	res := httptest.NewRecorder()
	handler.ServeHTTP(res, req)
	if res.Code != http.StatusNoContent {
		t.Fatalf("status = %d", res.Code)
	}
}

func TestRequireRolesRejectsCandidateFromRecruiterRoute(t *testing.T) {
	handler := RequireRoles(auth.RoleRecruiter)(http.HandlerFunc(func(w http.ResponseWriter, _ *http.Request) {
		w.WriteHeader(http.StatusNoContent)
	}))
	claims := auth.Claims{Subject: "candidate-1", Role: auth.RoleCandidate}
	req := httptest.NewRequest(http.MethodGet, "/recruiter", nil)
	req = req.WithContext(context.WithValue(req.Context(), claimsKey, claims))
	res := httptest.NewRecorder()

	handler.ServeHTTP(res, req)
	if res.Code != http.StatusForbidden {
		t.Fatalf("status = %d, want %d", res.Code, http.StatusForbidden)
	}
}

func TestRequireRolesAcceptsRecruiterForRecruiterRoute(t *testing.T) {
	handler := RequireRoles(auth.RoleRecruiter)(http.HandlerFunc(func(w http.ResponseWriter, _ *http.Request) {
		w.WriteHeader(http.StatusNoContent)
	}))
	claims := auth.Claims{Subject: "recruiter-1", Role: auth.RoleRecruiter}
	req := httptest.NewRequest(http.MethodGet, "/recruiter", nil)
	req = req.WithContext(context.WithValue(req.Context(), claimsKey, claims))
	res := httptest.NewRecorder()

	handler.ServeHTTP(res, req)
	if res.Code != http.StatusNoContent {
		t.Fatalf("status = %d, want %d", res.Code, http.StatusNoContent)
	}
}

func TestRequireRolesRejectsMissingClaims(t *testing.T) {
	handler := RequireRoles(auth.RoleCandidate)(http.HandlerFunc(func(w http.ResponseWriter, _ *http.Request) {
		w.WriteHeader(http.StatusNoContent)
	}))
	req := httptest.NewRequest(http.MethodGet, "/candidate", nil)
	res := httptest.NewRecorder()

	handler.ServeHTTP(res, req)
	if res.Code != http.StatusUnauthorized {
		t.Fatalf("status = %d, want %d", res.Code, http.StatusUnauthorized)
	}
}

func TestOriginAllowedRequiresExplicitTrustedOrigin(t *testing.T) {
	allowed := []string{"https://sapienworx.com", "http://localhost:3000"}

	for _, test := range []struct {
		name   string
		origin string
		want   bool
	}{
		{name: "production origin", origin: "https://sapienworx.com", want: true},
		{name: "local development origin", origin: "http://localhost:3000", want: true},
		{name: "missing origin", origin: "", want: false},
		{name: "untrusted origin", origin: "https://evil.example", want: false},
	} {
		t.Run(test.name, func(t *testing.T) {
			if got := originAllowed(test.origin, allowed); got != test.want {
				t.Fatalf("originAllowed(%q) = %v, want %v", test.origin, got, test.want)
			}
		})
	}
}

func TestTrustedProxyRemoteAddr(t *testing.T) {
	handler := TrustedProxyRemoteAddr([]string{"10.0.0.0/8"})(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if got := requestPeerIP(r); got != "203.0.113.25" {
			t.Fatalf("requestPeerIP = %q, want 203.0.113.25", got)
		}
		w.WriteHeader(http.StatusNoContent)
	}))
	req := httptest.NewRequest(http.MethodGet, "/", nil)
	req.RemoteAddr = "10.1.2.3:4321"
	req.Header.Set("X-Real-IP", "203.0.113.25")
	res := httptest.NewRecorder()
	handler.ServeHTTP(res, req)
	if res.Code != http.StatusNoContent {
		t.Fatalf("status = %d, want %d", res.Code, http.StatusNoContent)
	}
}

func TestTrustedProxyRemoteAddrRejectsSpoofFromUntrustedPeer(t *testing.T) {
	handler := TrustedProxyRemoteAddr([]string{"10.0.0.0/8"})(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if got := requestPeerIP(r); got != "198.51.100.9" {
			t.Fatalf("requestPeerIP = %q, want original peer", got)
		}
		w.WriteHeader(http.StatusNoContent)
	}))
	req := httptest.NewRequest(http.MethodGet, "/", nil)
	req.RemoteAddr = "198.51.100.9:4321"
	req.Header.Set("X-Real-IP", "203.0.113.25")
	res := httptest.NewRecorder()
	handler.ServeHTTP(res, req)
	if res.Code != http.StatusNoContent {
		t.Fatalf("status = %d, want %d", res.Code, http.StatusNoContent)
	}
}
