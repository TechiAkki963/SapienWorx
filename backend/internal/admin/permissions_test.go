package admin

import (
	"encoding/json"
	"os"
	"reflect"
	"testing"
)

func TestProposedPermissionsDenyUnknownRolesAndPermissions(t *testing.T) {
	for _, role := range []string{"", "master_admin", "candidate", "recruiter", "SUPER_ADMIN", "unknown"} {
		if RoleAllows(role, UsersRead) || len(PermissionsForRole(role)) != 0 {
			t.Fatalf("unapproved role %q received permissions", role)
		}
	}
	if RoleAllows("super_admin", Permission("users.delete")) {
		t.Fatal("undefined destructive capability was granted")
	}
}

func TestProposedRoleSeparation(t *testing.T) {
	cases := []struct {
		role       string
		permission Permission
		allowed    bool
	}{
		{"super_admin", SystemConfigure, true},
		{"platform_admin", OrganizationsReview, true},
		{"platform_admin", PrivacyManage, false},
		{"security_admin", UsersModerate, true},
		{"security_admin", OrganizationsReview, false},
		{"privacy_admin", PrivacyManage, true},
		{"privacy_admin", UsersModerate, false},
		{"support_admin", UsersRead, true},
		{"support_admin", OrganizationsDocuments, false},
		{"support_admin", UsersModerate, false},
		{"finance_admin", SystemRead, true},
		{"finance_admin", UsersRead, false},
		{"finance_admin", SystemConfigure, false},
		{"auditor", AuditRead, true},
		{"auditor", UsersModerate, false},
		{"content_admin", JobsRead, false},
		{"super_admin", RecruitmentRead, true},
		{"platform_admin", RecruitmentRead, true},
		{"support_admin", RecruitmentRead, false},
		{"auditor", RecruitmentRead, false},
		{"security_admin", RecruitmentRead, false},
		{"finance_admin", RecruitmentRead, false},
	}
	for _, c := range cases {
		if got := RoleAllows(c.role, c.permission); got != c.allowed {
			t.Errorf("%s: %s=%v, want %v", c.role, c.permission, got, c.allowed)
		}
	}
}

func TestCatalogReturnsDefensiveCopies(t *testing.T) {
	result := PermissionsForRole("super_admin")
	result[0] = Permission("users.delete")
	if RoleAllows("super_admin", Permission("users.delete")) {
		t.Fatal("caller mutated policy")
	}
}

func TestPreviewMatchesBackendCatalog(t *testing.T) {
	raw, err := os.ReadFile("../../../frontend/lib/admin-permission-catalog.json")
	if err != nil {
		t.Fatal(err)
	}
	var preview map[string][]Permission
	if err = json.Unmarshal(raw, &preview); err != nil {
		t.Fatal(err)
	}
	if len(preview) != len(rolePermissions) {
		t.Fatal("role catalogs differ")
	}
	for role, permissions := range preview {
		actual, exists := rolePermissions[role]
		if !exists || !reflect.DeepEqual(actual, permissions) {
			t.Errorf("preview diverged for %s", role)
		}
	}
}
