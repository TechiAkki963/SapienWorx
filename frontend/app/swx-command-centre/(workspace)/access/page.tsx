import { AdminAccessPreview } from "@/components/admin/admin-access-preview";
import { requireAdminWorkspace } from "@/lib/admin-access-server";

export default async function AdminAccessPage() {
  const { access } = await requireAdminWorkspace();
  return <AdminAccessPreview access={access} />;
}
