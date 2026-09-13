import { AuthShell } from "@/components/auth/auth-shell";
import { LoginForm } from "@/components/auth/login-form";

export default function CandidateLoginPage() { return <AuthShell eyebrow="For candidates" title="Your next opportunity starts with a human signal." description="Access saved jobs, applications and the candidate experience from one secure account." tone="lavender"><LoginForm role="candidate" /></AuthShell>; }
