import Link from "next/link";

import { HumanSignal } from "@/components/brand/human-signal";
import { Wordmark } from "@/components/brand/wordmark";
import { Container } from "@/components/layout/container";

export function PublicFooter() {
  return (
    <footer className="mt-24 overflow-hidden border-t border-line/70 bg-white/55">
      <Container className="relative grid gap-8 py-10 md:grid-cols-[1fr_auto] md:items-end">
        <div className="relative z-10">
          <Wordmark />
          <p className="mt-3 max-w-md text-sm leading-6 text-ink-muted">Human-first job discovery and transparent application tracking, built for candidates first.</p>
          <p className="mt-6 text-xs text-ink-muted">Smarter Hiring. Better Talent. Faster Growth.</p>
        </div>
        <nav className="relative z-10 flex flex-wrap gap-x-5 gap-y-3 text-sm font-semibold text-ink-muted" aria-label="Footer navigation">
          <Link className="hover:text-ink" href="/jobs">Jobs</Link>
          <Link className="hover:text-ink" href="/signup">Create profile</Link>
          <Link className="hover:text-ink" href="/recruiter/login">Recruiter portal</Link>
        </nav>
        <HumanSignal className="pointer-events-none absolute -bottom-40 right-8 w-80 text-indigo/10" title="" />
      </Container>
    </footer>
  );
}
