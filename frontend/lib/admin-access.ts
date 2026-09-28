import type catalog from "@/lib/admin-permission-catalog.json";

export type AdminRole = keyof typeof catalog;
export type AdminPermission = "overview.read" | "organizations.read" | "organizations.review" | "organizations.documents" | "users.read" | "users.moderate" | "jobs.read" | "jobs.moderate" | "privacy.read" | "privacy.manage" | "audit.read" | "system.read" | "system.configure" | "recruitment.read" | "control_plane.read" | "control_plane.manage" | "content.read" | "content.manage" | "costs.read" | "release.manage";
export type AdminAccess = {
  enabled: boolean;
  assigned?: boolean;
  admin_role?: AdminRole;
  permissions: AdminPermission[];
  mfa_enrolled?: boolean;
  mfa_verified?: boolean;
  mfa_verified_at?: string | null;
  mfa_verified_until?: string | null;
};

// Presentation only. The Go API independently rechecks the role and session.
export function canAdmin(access: AdminAccess, permission: AdminPermission) {
  return !access.enabled || Boolean(access.assigned && access.mfa_verified && access.permissions.includes(permission));
}

export function adminRoleLabel(role?: string) {
  return role ? role.split("_").map((word) => word.charAt(0).toUpperCase() + word.slice(1)).join(" ") : "Master Admin";
}
