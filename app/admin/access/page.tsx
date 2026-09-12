import { AdminGuardrailLayer } from "../../../components/admin-guardrail-layer";
import { MasterAdminAccessV2 } from "../../../components/master-admin-access-v2";

export default function AdminAccessPage() {
  return <AdminGuardrailLayer><MasterAdminAccessV2 /></AdminGuardrailLayer>;
}
