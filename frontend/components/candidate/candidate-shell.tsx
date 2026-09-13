import Link from "next/link";

import { LogoutButton } from "@/components/auth/logout-button";
import { HumanSignal } from "@/components/brand/human-signal";
import { Wordmark } from "@/components/brand/wordmark";
import { CandidateNav } from "@/components/candidate/candidate-nav";

export function CandidateShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-canvas">
      <header className="border-b border-line/60 bg-white/75 backdrop-blur-xl">
        <div className="mx-auto flex min-h-18 max-w-[90rem] items-center justify-between gap-4 px-4 py-3 sm:px-6 lg:px-8">
          <Link href="/candidate" aria-label="Candidate dashboard"><Wordmark /></Link>
          <div className="flex items-center gap-2"><Link className="hidden text-sm font-semibold text-ink-muted hover:text-ink sm:block" href="/">Public site</Link><LogoutButton /></div>
        </div>
      </header>
      <div className="mx-auto grid max-w-[90rem] gap-5 px-4 py-5 sm:px-6 lg:grid-cols-[13rem_minmax(0,1fr)] lg:px-8 lg:py-8">
        <aside className="relative lg:sticky lg:top-8 lg:self-start">
          <div className="relative overflow-hidden rounded-[1.5rem] border border-white/80 bg-white/75 p-3 shadow-soft">
            <CandidateNav />
            <HumanSignal className="pointer-events-none absolute -bottom-24 -right-20 hidden w-52 text-indigo/10 lg:block" title="" />
          </div>
        </aside>
        <main id="main-content" className="min-w-0">{children}</main>
      </div>
    </div>
  );
}
