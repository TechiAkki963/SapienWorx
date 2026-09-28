import "server-only";
import { cache } from "react";
import { redirect } from "next/navigation";

import { adminAPI, AdminBackendError } from "@/lib/admin-server";
import { requireRole } from "@/lib/auth-server";
import { canAdmin, type AdminAccess, type AdminPermission } from "@/lib/admin-access";

export const getAdminAccess = cache(async (): Promise<AdminAccess> => {
  try {
    const access = await adminAPI<AdminAccess>("/api/v1/admin/access");
    if (typeof access.enabled !== "boolean" || !Array.isArray(access.permissions) || access.permissions.some((item) => typeof item !== "string")) {
      throw new AdminBackendError("Administrator access response could not be verified.", 503);
    }
    return access;
  } catch (error) {
    // Rolling-release compatibility only: an older API has no scoped gate.
    // All other failures fail closed; do not treat a 403/503 as legacy access.
    if (error instanceof AdminBackendError && error.status === 404) return { enabled: false, permissions: [] };
    throw error;
  }
});

export async function requireAdminWorkspace(permission?: AdminPermission) {
  const user = await requireRole("master_admin");
  let access: AdminAccess;
  try {
    access = await getAdminAccess();
  } catch (error) {
    if (error instanceof AdminBackendError && (error.status === 403 || error.status === 503)) redirect("/swx-command-centre/security");
    throw error;
  }
  if (access.enabled && (!access.assigned || !access.mfa_verified)) redirect("/swx-command-centre/security");
  if (permission && !canAdmin(access, permission)) redirect("/swx-command-centre/access");
  return { user, access };
}
