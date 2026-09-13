import { AuthShell } from "@/components/auth/auth-shell";
import { SignupForm } from "@/components/auth/signup-form";

export default function RecruiterSignupPage() { return <AuthShell eyebrow="Recruiter registration" title="Bring your team into a cleaner hiring workflow." description="Use an official company email and verify your mobile. Recruiter access is activated only after SapienWorx admin review." tone="peach"><SignupForm recruiter /></AuthShell>; }
