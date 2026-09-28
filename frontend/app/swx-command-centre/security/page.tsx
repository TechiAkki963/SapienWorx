import Link from "next/link";

import { AdminSecurityForm } from "@/components/admin/admin-security-form";
import { LogoutButton } from "@/components/auth/logout-button";
import { Wordmark } from "@/components/brand/wordmark";
import { getAdminAccess } from "@/lib/admin-access-server";
import { requireRole } from "@/lib/auth-server";

export default async function AdminSecurityPage() {
  await requireRole("master_admin");
  let access;
  try { access = await getAdminAccess(); } catch { access = null; }
  return <main id="main-content" className="min-h-screen bg-gradient-to-br from-[#f6f7fb] via-white to-[#f1edff] px-4 py-6 sm:px-6">
    <header className="mx-auto flex max-w-5xl items-center justify-between gap-4"><Link href="/swx-command-centre" aria-label="SapienWorx command centre"><Wordmark /></Link><LogoutButton /></header>
    <div className="mx-auto mt-8 grid max-w-5xl items-start gap-6 lg:mt-16 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.15fr)]">
      <section className="order-2 min-w-0 p-2 sm:p-5 lg:order-1"><p className="text-xs font-bold uppercase tracking-wider text-indigo">Restricted command centre</p><h1 className="mt-4 text-3xl font-bold tracking-tight text-ink sm:text-4xl">One more check.<br />Your platform, protected.</h1><p className="mt-4 text-sm leading-7 text-ink-muted">Confirm your password and an authenticator code before opening administrative workspaces. This is separate from candidate email verification.</p><ol className="mt-6 space-y-4 text-sm text-ink-muted"><li><span className="font-bold text-ink">01 · Approved role.</span> Access is assigned by an authorized operator, never through signup.</li><li><span className="font-bold text-ink">02 · Authenticator.</span> Use a time-based, six-digit code. No SMS or email is sent.</li><li><span className="font-bold text-ink">03 · Bounded session.</span> Read access lasts up to 30 minutes; changes require confirmation within five minutes.</li></ol><div className="mt-8 rounded-2xl border border-line bg-white/80 p-4 text-xs leading-6 text-ink-muted"><strong className="text-ink">Lost your authenticator?</strong> Contact your authorized security operator for identity-checked recovery. There is no self-service MFA bypass or automatic role upgrade.</div></section>
      {access ? <AdminSecurityForm access={access} /> : <section role="alert" aria-label="Administrator session unavailable" className="order-1 rounded-3xl border border-amber-200 bg-white p-6 shadow-sm lg:order-2"><h2 className="text-xl font-bold text-ink">Session could not be verified</h2><p className="mt-3 text-sm leading-6 text-ink-muted">Access remains closed. If your session was revoked, sign out and sign in again. If the service is unavailable, try again later.</p></section>}
    </div>
  </main>;
}
