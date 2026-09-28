import { AdminShell } from "@/components/admin/admin-shell";
import { requireAdminWorkspace } from "@/lib/admin-access-server";

export default async function CommandCentreWorkspaceLayout({ children }: { children: React.ReactNode }) {
  const { user, access } = await requireAdminWorkspace();
  return <AdminShell user={user} access={access}>{children}</AdminShell>;
}
