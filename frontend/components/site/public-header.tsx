import Link from "next/link";

import { Wordmark } from "@/components/brand/wordmark";
import { Button } from "@/components/ui/button";
import { Container } from "@/components/layout/container";

export function PublicHeader() {
  return (
    <header className="sticky top-0 z-50 border-b border-white/60 bg-white/95 backdrop-blur-xl supports-[backdrop-filter]:bg-white/92">
      <Container className="flex min-h-[64px] items-center justify-between gap-3 py-2 sm:min-h-[72px] sm:gap-4 sm:py-3">
        <Link href="/" aria-label="SapienWorx home" className="shrink-0">
          <Wordmark className="text-sm sm:text-lg" />
        </Link>

        <nav className="hidden items-center gap-1 lg:flex" aria-label="Primary navigation">
          <Link className="rounded-full px-3.5 py-2 text-[13px] font-semibold text-navy/78 transition hover:bg-indigo-soft/55 hover:text-navy" href="/jobs">Find Jobs</Link>
          
          <Link className="rounded-full px-3.5 py-2 text-[13px] font-semibold text-navy/78 transition hover:bg-indigo-soft/55 hover:text-navy" href="/knowledge-hub">Knowledge Hub</Link>
          <Link className="rounded-full px-3.5 py-2 text-[13px] font-semibold text-navy/78 transition hover:bg-indigo-soft/55 hover:text-navy" href="/#about">About</Link>
        </nav>

        <div className="flex items-center gap-1.5 sm:gap-2">
          <Link className="hidden min-h-10 items-center justify-center rounded-full border border-indigo/35 bg-white px-4 text-sm font-bold text-navy transition hover:border-indigo hover:bg-indigo-soft lg:inline-flex" href="/recruiter/login">For Recruiters <span className="ml-1.5" aria-hidden="true">→</span></Link>
          <Button href="/signup" size="sm" className="whitespace-nowrap px-3 sm:px-5"><span className="sm:hidden">Join</span><span className="hidden sm:inline">Create Account</span><span aria-hidden="true">→</span></Button>
          <details className="group relative lg:hidden">
            <summary className="flex min-h-10 cursor-pointer list-none items-center rounded-full border border-line bg-white px-3 text-sm font-semibold text-navy hover:bg-indigo-soft/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo">Menu <span className="ml-1.5 text-xs transition-transform group-open:rotate-180" aria-hidden="true">▾</span></summary>
            <nav aria-label="Mobile navigation" className="absolute right-0 top-full z-50 mt-2 grid w-52 gap-1 rounded-2xl border border-line bg-white p-2 shadow-card">
              <Link className="rounded-lg px-3 py-2.5 text-sm font-semibold text-navy hover:bg-indigo-soft" href="/jobs">Find Jobs</Link>
              <Link className="rounded-lg px-3 py-2.5 text-sm font-semibold text-navy hover:bg-indigo-soft" href="/login">Log in</Link>
              <Link className="rounded-lg px-3 py-2.5 text-sm font-semibold text-navy hover:bg-indigo-soft" href="/knowledge-hub">Knowledge Hub</Link>
              <Link className="rounded-lg px-3 py-2.5 text-sm font-semibold text-navy hover:bg-indigo-soft" href="/#about">About</Link>
              <div className="my-1 border-t border-line" />
              <Link className="rounded-lg px-3 py-2.5 text-sm font-semibold text-indigo hover:bg-indigo-soft" href="/recruiter/login">For Recruiters</Link>
            </nav>
          </details>
        </div>
      </Container>
    </header>
  );
}
