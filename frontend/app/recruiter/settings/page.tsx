import Link from "next/link";
import { RecruiterShell } from "@/components/recruiter/recruiter-shell";
import { RecruiterProductHeader } from "@/components/recruiter/recruiter-product-header";
import { ThemeModeControl } from "@/components/theme/theme-mode-control";
import { requireRole } from "@/lib/auth-server";
import { recruiterAPI } from "@/lib/recruiter-server";
import type { RecruiterDashboard } from "@/lib/recruiter";

export const dynamic = "force-dynamic";
export default async function RecruiterSettingsPage() {
  await requireRole("recruiter");
  const workspace = await recruiterAPI<RecruiterDashboard>("/api/v1/recruiter/dashboard");
  return <RecruiterShell><div className="grid max-w-4xl gap-5 pb-24"><RecruiterProductHeader title="Settings" eyebrow="Your workspace" description="Review your account, organization and appearance preferences." />
    <section id="security" className="rounded-xl border border-line bg-white p-5"><h2 className="text-lg font-semibold text-navy">Account & organization</h2><dl className="mt-4 grid gap-4 sm:grid-cols-2">{[["Recruiter",workspace.recruiter_name],["Organization",workspace.company_name]].map(([name,value])=><div key={name}><dt className="text-xs text-ink-muted">{name}</dt><dd className="mt-1 break-all text-sm text-ink">{value}</dd></div>)}</dl><Link className="mt-4 inline-flex min-h-11 items-center text-sm font-semibold text-indigo" href="/forgot-password?returnTo=%2Frecruiter%2Fsettings">Reset your password</Link></section>
    <section className="rounded-xl border border-line bg-white p-5"><h2 className="text-lg font-semibold text-navy">Appearance</h2><p className="mb-4 mt-2 text-sm leading-6 text-ink-muted">System follows your device appearance. Light and Dark keep your explicit preference.</p><ThemeModeControl /></section>
  </div></RecruiterShell>;
}
