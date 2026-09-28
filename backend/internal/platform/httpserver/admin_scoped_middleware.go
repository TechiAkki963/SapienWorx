package httpserver

import (
	"context"
	"errors"
	"log/slog"
	"net/http"
	"time"

	"github.com/TechiAkki963/SapienWorx/backend/internal/admin"
	"github.com/TechiAkki963/SapienWorx/backend/internal/auth"
)

type adminScopedStore interface {
	ScopedAccess(context.Context, string, string) (admin.ScopedAccess, error)
	Audit(context.Context, admin.AuditInput) error
}
type adminScopeKey struct{}

func scopedAdminPermission(store adminScopedStore, logger *slog.Logger, permissions ...admin.Permission) Middleware {
	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			claims, ok := ClaimsFromContext(r.Context())
			if !ok || claims.Role != auth.RoleMasterAdmin || store == nil {
				writeError(w, r, http.StatusForbidden, "admin_forbidden", "administrator access denied")
				return
			}
			access, err := store.ScopedAccess(r.Context(), claims.Subject, claims.TokenID)
			if err != nil {
				if errors.Is(err, admin.ErrForbidden) {
					writeError(w, r, http.StatusForbidden, "admin_session_unavailable", "administrator session is unavailable")
				} else {
					logger.Error("admin scope lookup unavailable", "request_id", RequestIDFromContext(r.Context()))
					writeError(w, r, http.StatusServiceUnavailable, "admin_access_unavailable", "administrator access could not be verified")
				}
				return
			}
			deny := func(code, message string) {
				if auditErr := store.Audit(r.Context(), admin.AuditInput{AdminID: &claims.Subject, ActionType: "admin.access_denied", TargetEntityType: "admin_gateway", IPAddress: clientIP(r.RemoteAddr), RequestID: RequestIDFromContext(r.Context()), Metadata: map[string]any{"reason": code, "path": r.URL.Path, "method": r.Method}}); auditErr != nil {
					logger.Error("admin denial audit unavailable", "request_id", RequestIDFromContext(r.Context()))
				}
				writeError(w, r, http.StatusForbidden, code, message)
			}
			if len(permissions) > 0 {
				if !access.Assigned {
					deny("admin_role_unassigned", "an approved administrative role is required")
					return
				}
				if !access.MFAVerified {
					deny("admin_mfa_required", "confirm your authenticator to continue")
					return
				}
				allowed := false
				for _, permission := range permissions {
					if access.Allows(permission) {
						allowed = true
						break
					}
				}
				if !allowed {
					deny("admin_permission_denied", "your administrative role cannot access this operation")
					return
				}
				if r.Method != "GET" && r.Method != "HEAD" && !access.RecentlyVerified(time.Now().UTC()) {
					deny("admin_reauthentication_required", "confirm your password and authenticator before this action")
					return
				}
			}
			next.ServeHTTP(w, r.WithContext(context.WithValue(r.Context(), adminScopeKey{}, access)))
		})
	}
}
