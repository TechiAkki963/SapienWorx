package httpserver

import (
	"context"
	"log/slog"
	"net"
	"net/http"
	"strings"

	"github.com/TechiAkki963/SapienWorx/backend/internal/admin"
	"github.com/TechiAkki963/SapienWorx/backend/internal/auth"
)

func clientIP(remoteAddr string) string {
	host, _, err := net.SplitHostPort(strings.TrimSpace(remoteAddr))
	if err == nil {
		return host
	}
	return strings.TrimSpace(remoteAddr)
}

func extractAccessToken(r *http.Request, accessCookieName string) string {
	header := strings.TrimSpace(r.Header.Get("Authorization"))
	parts := strings.SplitN(header, " ", 2)
	if len(parts) == 2 && strings.EqualFold(parts[0], "Bearer") {
		if token := strings.TrimSpace(parts[1]); token != "" {
			return token
		}
	}
	if cookie, err := r.Cookie(accessCookieName); err == nil {
		return strings.TrimSpace(cookie.Value)
	}
	return ""
}

func MasterAdminOnly(tokens *auth.TokenManager, accessCookieName string, service *admin.Service, logger *slog.Logger) Middleware {
	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			token := extractAccessToken(r, accessCookieName)
			if token == "" {
				auditAdminDenied(r.Context(), service, logger, r, nil, "missing_token", nil)
				writeError(w, r, http.StatusForbidden, "admin_forbidden", "master admin access denied")
				return
			}

			claims, err := tokens.Parse(token)
			if err != nil {
				auditAdminDenied(r.Context(), service, logger, r, nil, "invalid_token", map[string]any{"token_error": err.Error()})
				writeError(w, r, http.StatusForbidden, "admin_forbidden", "master admin access denied")
				return
			}
			if claims.Role != auth.RoleMasterAdmin {
				auditAdminDenied(r.Context(), service, logger, r, nil, "wrong_role", map[string]any{"attempted_user_id": claims.Subject, "attempted_role": claims.Role})
				writeError(w, r, http.StatusForbidden, "admin_forbidden", "master admin access denied")
				return
			}

			allowed, authErr := service.AuthorizeMasterAdmin(r.Context(), claims.Subject)
			if authErr != nil {
				logger.Error("master admin authorization check failed", "error", authErr, "request_id", RequestIDFromContext(r.Context()))
				auditAdminDenied(r.Context(), service, logger, r, &claims.Subject, "authorization_check_failed", nil)
				writeError(w, r, http.StatusForbidden, "admin_forbidden", "master admin access denied")
				return
			}
			if !allowed {
				auditAdminDenied(r.Context(), service, logger, r, &claims.Subject, "inactive_admin", nil)
				writeError(w, r, http.StatusForbidden, "admin_forbidden", "master admin access denied")
				return
			}

			ctx := context.WithValue(r.Context(), claimsKey, claims)
			next.ServeHTTP(w, r.WithContext(ctx))
		})
	}
}

func auditAdminDenied(ctx context.Context, service *admin.Service, logger *slog.Logger, r *http.Request, adminID *string, reason string, extra map[string]any) {
	metadata := map[string]any{
		"reason": reason,
		"path":   r.URL.Path,
		"method": r.Method,
	}
	for key, value := range extra {
		metadata[key] = value
	}
	if err := service.Audit(ctx, admin.AuditInput{
		AdminID:          adminID,
		ActionType:       "admin.access_denied",
		TargetEntityType: "admin_gateway",
		IPAddress:        clientIP(r.RemoteAddr),
		RequestID:        RequestIDFromContext(ctx),
		Metadata:         metadata,
	}); err != nil {
		logger.Error("failed to persist admin access denial audit", "error", err, "request_id", RequestIDFromContext(ctx))
	}
}
