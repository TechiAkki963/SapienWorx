import { Suspense } from "react";

import { AuthShell } from "@/components/auth/auth-shell";
import { VerifyEmailForm } from "@/components/auth/verify-email-form";

const features = [
  { title: "Verified identity", body: "Email verification helps protect accounts from impersonation and typo-based registrations." },
  { title: "Safer workspace access", body: "Candidate and recruiter workspaces remain unavailable until the registered email is confirmed." },
  { title: "Role-specific safeguards", body: "Recruiters still require company verification and administrator approval after email verification." },
  { title: "Layered account security", body: "Email confirmation works together with mobile verification rather than replacing it." },
];

export default function VerifyEmailPage() {
  return (
    <AuthShell
      eyebrow="Email verification"
      panelLabel="Protected access"
      title="One verified identity. A safer hiring network."
      description="SapienWorx verifies both the registered mobile number and email address before granting account access."
      features={features}
    >
      <Suspense fallback={<p className="text-sm text-ink-muted">Loading email verification…</p>}><VerifyEmailForm /></Suspense>
    </AuthShell>
  );
}
