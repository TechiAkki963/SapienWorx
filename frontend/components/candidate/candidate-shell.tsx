import Link from "next/link";

import { LogoutButton } from "@/components/auth/logout-button";
import { Wordmark } from "@/components/brand/wordmark";
import { CandidateNav } from "@/components/candidate/candidate-nav";

export function CandidateShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-[#f6f8fc] text-ink">
      <header className="sticky top-0 z-40 border-b border-line/70 bg-white/95">
        <div className="mx-auto flex min-h-[4.25rem] max-w-[96rem] items-center justify-between gap-4 px-4 sm:px-6 lg:px-8">
          <Link href="/candidate" aria-label="Candidate dashboard"><Wordmark /></Link>
          <div className="flex items-center gap-2">
            <Link className="hidden rounded-lg px-3 py-2 text-sm font-semibold text-ink-muted transition hover:bg-slate-50 hover:text-ink sm:block" href="/">Public site</Link>
            <LogoutButton />
          </div>
        </div>
      </header>
      <div className="mx-auto grid max-w-[96rem] gap-5 px-4 py-4 sm:px-6 lg:grid-cols-[13rem_minmax(0,1fr)] lg:px-8 lg:py-6">
        <aside className="lg:sticky lg:top-[5.75rem] lg:self-start">
          <div className="rounded-2xl border border-line/70 bg-white p-2.5 shadow-[0_1px_3px_rgba(16,33,63,0.04)]">
            <CandidateNav />
          </div>
        </aside>
        <main id="main-content" className="min-w-0">{children}</main>
      </div>
    </div>
  );
}
