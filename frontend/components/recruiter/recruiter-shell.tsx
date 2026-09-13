import Link from "next/link";

import { LogoutButton } from "@/components/auth/logout-button";
import { Wordmark } from "@/components/brand/wordmark";
import { RecruiterNav } from "@/components/recruiter/recruiter-nav";
import { RecruiterDashboard } from "@/lib/recruiter";
import { recruiterAPI } from "@/lib/recruiter-server";

function initials(name: string) {
  return name.split(/\s+/).filter(Boolean).map((part) => part[0]).slice(0, 2).join("").toUpperCase() || "R";
}

export async function RecruiterShell({ children }: { children: React.ReactNode }) {
  const workspace = await recruiterAPI<RecruiterDashboard>("/api/v1/recruiter/dashboard").catch(() => null);
  const recruiterName = workspace?.recruiter_name ?? "Recruiter";
  const companyName = workspace?.company_name ?? "SapienWorx workspace";

  return (
    <div className="min-h-screen bg-[#f5f7fb] text-ink">
      <header className="sticky top-0 z-40 border-b border-line/70 bg-white/95 backdrop-blur">
        <div className="mx-auto flex min-h-[4.25rem] max-w-[108rem] items-center gap-4 px-4 sm:px-6 lg:px-8">
          <Link href="/recruiter" aria-label="Recruiter dashboard" className="shrink-0"><Wordmark /></Link>

          <form action="/recruiter/pipeline" className="hidden min-w-0 max-w-xl flex-1 md:block">
            <label className="relative block">
              <span className="sr-only">Search candidates</span>
              <svg aria-hidden="true" viewBox="0 0 24 24" className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 fill-none stroke-ink-muted stroke-[1.8]"><circle cx="11" cy="11" r="6" /><path d="m16 16 4 4" /></svg>
              <input name="q" placeholder="Search candidates by name or headline" className="h-10 w-full rounded-xl border border-line bg-slate-50/80 pl-10 pr-4 text-sm outline-none transition placeholder:text-ink-muted/70 focus:border-indigo/35 focus:bg-white focus:ring-3 focus:ring-indigo-soft" />
            </label>
          </form>

          <div className="ml-auto flex items-center gap-2">
            <Link href="/recruiter/interviews" aria-label="Interview reminders" className="relative flex h-10 w-10 items-center justify-center rounded-xl border border-line bg-white text-ink-muted transition hover:bg-slate-50 hover:text-ink">
              <svg aria-hidden="true" viewBox="0 0 24 24" className="h-[18px] w-[18px] fill-none stroke-current stroke-[1.8]"><path d="M18 8a6 6 0 0 0-12 0c0 7-3 7-3 8h18c0-1-3-1-3-8M10 20h4" /></svg>
              {!!workspace?.upcoming_interviews && <span className="absolute -right-1 -top-1 min-w-5 rounded-full bg-indigo px-1.5 py-0.5 text-center text-[9px] font-extrabold text-white">{Math.min(workspace.upcoming_interviews, 99)}</span>}
            </Link>

            <details className="relative">
              <summary className="flex cursor-pointer list-none items-center gap-2 rounded-xl border border-line bg-white py-1.5 pl-1.5 pr-2.5 transition hover:bg-slate-50">
                <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-navy text-[10px] font-extrabold text-white">{initials(recruiterName)}</span>
                <span className="hidden max-w-36 text-left lg:block">
                  <span className="block truncate text-xs font-bold text-ink">{recruiterName}</span>
                  <span className="block truncate text-[10px] text-ink-muted">{companyName}</span>
                </span>
                <svg aria-hidden="true" viewBox="0 0 16 16" className="h-3 w-3 fill-none stroke-current stroke-[1.7] text-ink-muted"><path d="m4 6 4 4 4-4" /></svg>
              </summary>
              <div className="absolute right-0 mt-2 w-60 rounded-xl border border-line bg-white p-2 shadow-[0_16px_44px_rgba(16,33,63,0.14)]">
                <div className="border-b border-line/70 px-2.5 py-2">
                  <p className="truncate text-sm font-bold text-ink">{recruiterName}</p>
                  <p className="mt-0.5 truncate text-xs text-ink-muted">{companyName}</p>
                </div>
                <Link href="/" className="mt-1 flex rounded-lg px-2.5 py-2 text-sm font-semibold text-ink-muted hover:bg-slate-50 hover:text-ink">View public site</Link>
                <div className="mt-1 border-t border-line/70 pt-1"><LogoutButton /></div>
              </div>
            </details>
          </div>
        </div>
      </header>

      <div className="mx-auto grid max-w-[108rem] gap-5 px-4 py-4 sm:px-6 lg:grid-cols-[13rem_minmax(0,1fr)] lg:px-8 lg:py-6">
        <aside className="lg:sticky lg:top-[5.75rem] lg:self-start">
          <div className="rounded-2xl border border-line/70 bg-white p-2.5 shadow-[0_1px_3px_rgba(16,33,63,0.04)]"><RecruiterNav /></div>
        </aside>
        <main id="main-content" className="min-w-0">{children}</main>
      </div>
    </div>
  );
}
