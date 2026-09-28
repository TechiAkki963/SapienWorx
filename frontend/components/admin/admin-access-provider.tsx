"use client";

import { createContext, useContext } from "react";
import { canAdmin, type AdminAccess, type AdminPermission } from "@/lib/admin-access";

const AccessContext = createContext<AdminAccess | null>(null);
export function AdminAccessProvider({ access, children }: { access: AdminAccess; children: React.ReactNode }) {
  return <AccessContext.Provider value={access}>{children}</AccessContext.Provider>;
}
export function useAdminPermission(permission: AdminPermission) {
  const access = useContext(AccessContext);
  return access !== null && canAdmin(access, permission);
}
