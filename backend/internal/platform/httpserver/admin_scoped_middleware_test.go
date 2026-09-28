package httpserver

import (
	"context"
	"errors"
	"log/slog"
	"net/http"
	"net/http/httptest"
	"testing"
	"time"

	"github.com/TechiAkki963/SapienWorx/backend/internal/admin"
	"github.com/TechiAkki963/SapienWorx/backend/internal/auth"
)

type fakeScopedAdmin struct {
	access admin.ScopedAccess
	err    error
	audits int
}

func (f *fakeScopedAdmin) ScopedAccess(context.Context, string, string) (admin.ScopedAccess, error) {
	return f.access, f.err
}
func (f *fakeScopedAdmin) Audit(context.Context, admin.AuditInput) error { f.audits++; return nil }

func TestScopedAdminGateDeniesUnassignedUnverifiedUnauthorizedAndStaleMutation(t *testing.T) {
	now := time.Now().UTC()
	old := now.Add(-6 * time.Minute)
	cases := []struct {
		name, role, method string
		assigned, verified bool
		at                 *time.Time
		err                error
		want               int
	}{
		{"unassigned", "", "GET", false, false, nil, nil, 403},
		{"password only", "super_admin", "GET", true, false, nil, nil, 403},
		{"support cannot mutate", "support_admin", "POST", true, true, &now, nil, 403},
		{"recent confirmation required", "super_admin", "POST", true, true, &old, nil, 403},
		{"authorized mutation", "super_admin", "POST", true, true, &now, nil, 204},
		{"database outage fails closed", "super_admin", "POST", true, true, &now, errors.New("offline"), 503},
		{"revoked session", "super_admin", "POST", true, true, &now, admin.ErrForbidden, 403},
	}
	for _, c := range cases {
		t.Run(c.name, func(t *testing.T) {
			store := &fakeScopedAdmin{access: admin.ScopedAccess{Assigned: c.assigned, Role: c.role, MFAVerified: c.verified, MFAVerifiedAt: c.at}, err: c.err}
			handler := scopedAdminPermission(store, slog.Default(), admin.UsersModerate)(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) { w.WriteHeader(204) }))
			request := httptest.NewRequest(c.method, "/api/v1/admin/users/test/suspend", nil)
			request = request.WithContext(context.WithValue(request.Context(), claimsKey, auth.Claims{Subject: "admin", Role: auth.RoleMasterAdmin, TokenID: "session"}))
			response := httptest.NewRecorder()
			handler.ServeHTTP(response, request)
			if response.Code != c.want {
				t.Fatalf("got %d, want %d", response.Code, c.want)
			}
		})
	}
}

func TestScopedAdminGateAllowsStatusBeforeEnrollment(t *testing.T) {
	store := &fakeScopedAdmin{}
	handler := scopedAdminPermission(store, slog.Default())(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) { w.WriteHeader(204) }))
	request := httptest.NewRequest("GET", "/api/v1/admin/access", nil)
	request = request.WithContext(context.WithValue(request.Context(), claimsKey, auth.Claims{Subject: "admin", Role: auth.RoleMasterAdmin, TokenID: "session"}))
	response := httptest.NewRecorder()
	handler.ServeHTTP(response, request)
	if response.Code != 204 {
		t.Fatal("enrollment status became inaccessible")
	}
}
