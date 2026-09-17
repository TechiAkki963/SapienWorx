import { Suspense } from "react";

import { AuthShell } from "@/components/auth/auth-shell";
import { VerifyEmailForm } from "@/components/auth/verify-email-form";

const features = [
  { title: "Verified identity", body: "Email verification helps protect accounts from impersonation and typo-based registrations." },
  { title: "Safer workspace access", body: "Candidate and recruiter workspaces remain unavailable until the registered email is confirmed." },
  { title: "Role-specific safeguards", body: "Recruiters still require company verification and administrator approval after email verification." },
  { title: "Email OTP only", body: "SapienWorx currently verifies accounts by email OTP. SMS OTP is not enabled." },
];

export default function VerifyEmailPage() {
  return (
    <AuthShell
      eyebrow="Email verification"
      panelLabel="Protected access"
      title="One verified identity. A safer hiring network."
      description="Confirm the email address registered with your SapienWorx account. We do not require SMS OTP in the current product phase."
      features={features}
    >
      <Suspense fallback={<p className="text-sm text-ink-muted">Loading email verification…</p>}><VerifyEmailForm /></Suspense>
    </AuthShell>
  );
}
