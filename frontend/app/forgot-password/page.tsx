import { AuthShell } from "@/components/auth/auth-shell";
import { PasswordRecoveryForm } from "@/components/auth/password-recovery-form";

export default function ForgotPasswordPage() { return <AuthShell eyebrow="Recovery" title="Return to your account securely." description="Password recovery uses the verified mobile number already attached to your SapienWorx account." tone="lavender"><PasswordRecoveryForm /></AuthShell>; }
