import { AuthShell } from "@/components/auth/auth-shell";
import { LoginForm } from "@/components/auth/login-form";

export default function AdminLoginPage() { return <AuthShell eyebrow="Restricted access" title="SapienWorx administration." description="This non-advertised entry is reserved for provisioned Master Admin accounts. There is no public administrator signup." tone="lavender"><LoginForm role="master_admin" /></AuthShell>; }
