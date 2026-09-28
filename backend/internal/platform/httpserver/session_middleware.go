package httpserver

import (
	"context"
	"net/http"

	"github.com/TechiAkki963/SapienWorx/backend/internal/auth"
)

type SessionAuthorizer interface {
	SessionAllowed(context.Context, auth.Claims) (bool, error)
}

func RequireCurrentSession(service SessionAuthorizer) Middleware {
	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			claims, ok := ClaimsFromContext(r.Context())
			if !ok {
				writeError(w, r, 401, "unauthorized", "authentication required")
				return
			}
			if service == nil {
				writeError(w, r, 503, "session_unavailable", "session verification is unavailable")
				return
			}
			allowed, err := service.SessionAllowed(r.Context(), claims)
			if err != nil {
				writeError(w, r, 503, "session_unavailable", "session verification is unavailable")
				return
			}
			if !allowed {
				writeError(w, r, 401, "session_revoked", "Your session is no longer active. Sign in again or complete your required password reset.")
				return
			}
			next.ServeHTTP(w, r)
		})
	}
}
