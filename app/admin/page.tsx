import { AdminGuardrailLayer } from "../../components/admin-guardrail-layer";
import { MasterAdminConsole } from "../../components/master-admin";
export default function AdminPage(){return <AdminGuardrailLayer><div className="admin-team-shortcut"><a href="/admin/team">Team &amp; access →</a></div><MasterAdminConsole/></AdminGuardrailLayer>;}
