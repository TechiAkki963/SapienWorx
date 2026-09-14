import { AdminShell } from "@/components/admin/admin-shell";
import { requireRole } from "@/lib/auth-server";

export default async function CommandCentreWorkspaceLayout({ children }: { children: React.ReactNode }) {
  const user = await requireRole("master_admin");
  return <AdminShell user={user}>{children}</AdminShell>;
}
