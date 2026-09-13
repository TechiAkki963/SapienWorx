import { AuthShell } from "@/components/auth/auth-shell";
import { SignupForm } from "@/components/auth/signup-form";

export default function CandidateSignupPage() { return <AuthShell eyebrow="Join SapienWorx" title="Build a profile that feels like you, not a database row." description="Create your candidate account, verify your mobile number and get ready for a more thoughtful job search." tone="mint"><SignupForm /></AuthShell>; }
