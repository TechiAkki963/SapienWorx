import { Suspense } from "react";
import { AuthShell } from "@/components/auth/auth-shell";
import { VerifyPhoneForm } from "@/components/auth/verify-phone-form";

export default function VerifyPhonePage() { return <AuthShell eyebrow="One more step" title="Keep the account connected to a real person." description="Mobile verification protects candidate and recruiter accounts before workspace access." tone="mint"><Suspense fallback={<p className="text-sm text-ink-muted">Loading verification…</p>}><VerifyPhoneForm /></Suspense></AuthShell>; }
