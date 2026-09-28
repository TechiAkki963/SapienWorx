package httpserver

import (
	"context"
	"errors"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/TechiAkki963/SapienWorx/backend/internal/auth"
)

type sessionStub struct {
	allowed bool
	err     error
}

func (s sessionStub) SessionAllowed(context.Context, auth.Claims) (bool, error) {
	return s.allowed, s.err
}
func TestCurrentSessionFailsClosed(t *testing.T) {
	for _, item := range []struct {
		name    string
		service SessionAuthorizer
		claims  bool
		want    int
	}{{"valid", sessionStub{allowed: true}, true, 204}, {"revoked", sessionStub{}, true, 401}, {"database unavailable", sessionStub{err: errors.New("isolated database failure")}, true, 503}, {"service unavailable", nil, true, 503}, {"no claims", sessionStub{allowed: true}, false, 401}} {
		t.Run(item.name, func(t *testing.T) {
			r := httptest.NewRequest("GET", "/api/v1/auth/me", nil)
			if item.claims {
				r = r.WithContext(context.WithValue(r.Context(), claimsKey, auth.Claims{Subject: "synthetic"}))
			}
			w := httptest.NewRecorder()
			RequireCurrentSession(item.service)(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) { w.WriteHeader(204) })).ServeHTTP(w, r)
			if w.Code != item.want {
				t.Fatalf("status %d want %d", w.Code, item.want)
			}
		})
	}
}
