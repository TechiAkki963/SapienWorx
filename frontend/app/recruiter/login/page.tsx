import { AuthShell } from "@/components/auth/auth-shell";
import { LoginForm } from "@/components/auth/login-form";

export default function RecruiterLoginPage() { return <AuthShell eyebrow="For recruiters" title="A focused workspace for people who hire people." description="Securely enter the recruiter workspace using your verified company account." tone="peach"><LoginForm role="recruiter" /></AuthShell>; }
