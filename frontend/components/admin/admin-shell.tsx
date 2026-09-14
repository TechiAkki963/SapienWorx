import Link from "next/link";

import { AdminNav } from "@/components/admin/admin-nav";
import { LogoutButton } from "@/components/auth/logout-button";
import { Wordmark } from "@/components/brand/wordmark";
import type { SessionUser } from "@/lib/auth-server";

function shortID(value: string) {
  return value.length > 10 ? `${value.slice(0, 8)}…` : value;
}

export function AdminShell({ user, children }: { user: SessionUser; children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-[#f6f7fb] text-ink">
      <header className="sticky top-0 z-50 border-b border-[#dfe4f0] bg-white/96 backdrop-blur-xl">
        <div className="mx-auto flex min-h-[4.25rem] max-w-[118rem] items-center gap-4 px-4 sm:px-6 lg:px-8">
          <Link href="/swx-command-centre/overview" aria-label="SapienWorx command centre" className="shrink-0">
            <Wordmark />
          </Link>
          <div className="hidden h-6 w-px bg-[#dfe4f0] sm:block" aria-hidden="true" />
          <div className="hidden sm:block">
            <p className="text-[10px] font-extrabold uppercase tracking-[0.18em] text-[#5262c9]">Command Centre</p>
            <p className="mt-0.5 text-xs text-slate-500">Platform governance & security</p>
          </div>

          <div className="ml-auto flex items-center gap-2">
            <div className="hidden rounded-xl border border-[#dfe4f0] bg-[#fafbff] px-3 py-2 text-right md:block">
              <p className="text-[10px] font-extrabold uppercase tracking-[0.12em] text-slate-400">Master Admin</p>
              <p className="mt-0.5 text-xs font-semibold text-slate-700">Session {shortID(user.id)}</p>
            </div>
            <details className="relative">
              <summary className="flex h-10 w-10 cursor-pointer list-none items-center justify-center rounded-xl bg-[#172554] text-xs font-extrabold text-white shadow-[0_6px_20px_rgba(23,37,84,0.16)] transition hover:-translate-y-0.5 hover:shadow-[0_10px_24px_rgba(23,37,84,0.2)]">MA</summary>
              <div className="absolute right-0 mt-2 w-64 rounded-2xl border border-[#dfe4f0] bg-white p-2 shadow-[0_20px_55px_rgba(23,37,84,0.16)]">
                <div className="rounded-xl bg-[#f7f8fd] px-3 py-3">
                  <p className="text-xs font-extrabold uppercase tracking-[0.12em] text-[#5262c9]">Restricted session</p>
                  <p className="mt-1 text-sm font-semibold text-slate-900">Master Admin</p>
                  <p className="mt-0.5 truncate text-xs text-slate-500">{user.id}</p>
                </div>
                <div className="mt-2 border-t border-[#eef0f5] pt-2"><LogoutButton /></div>
              </div>
            </details>
          </div>
        </div>
      </header>

      <div className="mx-auto grid max-w-[118rem] gap-5 px-4 py-4 sm:px-6 lg:grid-cols-[15rem_minmax(0,1fr)] lg:px-8 lg:py-6">
        <aside className="lg:sticky lg:top-[5.75rem] lg:self-start">
          <div className="rounded-[1.25rem] border border-[#dfe4f0] bg-white p-2.5 shadow-[0_10px_35px_rgba(23,37,84,0.05)]">
            <div className="mb-2 rounded-xl bg-gradient-to-br from-[#eef1ff] to-[#f8f7ff] px-3 py-3">
              <p className="text-[10px] font-extrabold uppercase tracking-[0.14em] text-[#5262c9]">SapienWorx Control Plane</p>
              <p className="mt-1 text-xs leading-5 text-slate-500">High-privilege operations are audited.</p>
            </div>
            <AdminNav />
          </div>
          <div className="mt-3 rounded-2xl border border-[#e3e6ef] bg-[#fbfbfd] px-3 py-3 text-[11px] leading-5 text-slate-500">
            <span className="font-bold text-slate-700">Security note:</span> every governance action is written to the append-only audit log.
          </div>
        </aside>
        <main id="main-content" className="min-w-0">{children}</main>
      </div>
    </div>
  );
}
