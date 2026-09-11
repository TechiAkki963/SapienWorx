import { AdminGuardrailLayer } from "../../components/admin-guardrail-layer";
import { MasterAdminConsole } from "../../components/master-admin";

export default function AdminPage(){
  return <AdminGuardrailLayer><a className="admin-team-shortcut" href="/admin/team">Team &amp; bulk access →</a><MasterAdminConsole/></AdminGuardrailLayer>;
}
