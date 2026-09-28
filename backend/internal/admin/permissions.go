package admin

// Scoped policy catalog, enforced only when ADMIN_ACCESS_ENABLED is enabled.

type Permission string

const (
	OverviewRead           Permission = "overview.read"
	OrganizationsRead      Permission = "organizations.read"
	OrganizationsReview    Permission = "organizations.review"
	OrganizationsDocuments Permission = "organizations.documents"
	UsersRead              Permission = "users.read"
	UsersModerate          Permission = "users.moderate"
	JobsRead               Permission = "jobs.read"
	RecruitmentRead        Permission = "recruitment.read"
	JobsModerate           Permission = "jobs.moderate"
	PrivacyRead            Permission = "privacy.read"
	PrivacyManage          Permission = "privacy.manage"
	AuditRead              Permission = "audit.read"
	SystemRead             Permission = "system.read"
	SystemConfigure        Permission = "system.configure"
	ControlPlaneRead       Permission = "control_plane.read"
	ControlPlaneManage     Permission = "control_plane.manage"
	ContentRead            Permission = "content.read"
	ContentManage          Permission = "content.manage"
	CostsRead              Permission = "costs.read"
	ReleaseManage          Permission = "release.manage"
	IntelligenceRead       Permission = "intelligence.read"
	IntelligenceManage     Permission = "intelligence.manage"
)

var rolePermissions = map[string][]Permission{
	"super_admin":    {OverviewRead, OrganizationsRead, OrganizationsReview, OrganizationsDocuments, UsersRead, UsersModerate, JobsRead, JobsModerate, PrivacyRead, PrivacyManage, AuditRead, SystemRead, SystemConfigure, RecruitmentRead, ControlPlaneRead, ControlPlaneManage, ContentRead, ContentManage, CostsRead, ReleaseManage, IntelligenceRead, IntelligenceManage},
	"platform_admin": {OverviewRead, OrganizationsRead, OrganizationsReview, OrganizationsDocuments, UsersRead, UsersModerate, JobsRead, JobsModerate, RecruitmentRead, ControlPlaneRead, ControlPlaneManage, ReleaseManage, IntelligenceRead, IntelligenceManage},
	"security_admin": {UsersRead, UsersModerate, AuditRead, ControlPlaneRead, ControlPlaneManage},
	"privacy_admin":  {PrivacyRead, PrivacyManage, AuditRead, ControlPlaneRead, ControlPlaneManage},
	"support_admin":  {UsersRead, OrganizationsRead, JobsRead},
	"finance_admin":  {SystemRead, CostsRead, ControlPlaneRead},
	"content_admin":  {ContentRead, ContentManage, ControlPlaneRead},
	"auditor":        {OverviewRead, AuditRead, ControlPlaneRead, CostsRead, ContentRead, IntelligenceRead},
}

func PermissionsForRole(role string) []Permission {
	result := append([]Permission{}, rolePermissions[role]...)
	return result
}

func RoleAllows(role string, permission Permission) bool {
	for _, value := range rolePermissions[role] {
		if value == permission {
			return true
		}
	}
	return false
}
