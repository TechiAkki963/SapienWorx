import Link from "next/link";

import { Wordmark } from "@/components/brand/wordmark";
import { Button } from "@/components/ui/button";
import { Container } from "@/components/layout/container";

export function PublicHeader() {
  return (
    <header className="sticky top-0 z-50 border-b border-white/60 bg-white/82 backdrop-blur-xl supports-[backdrop-filter]:bg-white/74">
      <Container className="flex min-h-[72px] items-center justify-between gap-4 py-3">
        <Link href="/" aria-label="SapienWorx home" className="shrink-0">
          <Wordmark className="text-lg" />
        </Link>

        <nav className="hidden items-center gap-1 lg:flex" aria-label="Primary navigation">
          <Link className="rounded-full px-3.5 py-2 text-[13px] font-semibold text-navy/78 transition hover:bg-indigo-soft/55 hover:text-navy" href="/jobs">Find Jobs</Link>
          <Link className="rounded-full px-3.5 py-2 text-[13px] font-semibold text-navy/78 transition hover:bg-indigo-soft/55 hover:text-navy" href="/recruiter/login">For Recruiters</Link>
          <Link className="rounded-full px-3.5 py-2 text-[13px] font-semibold text-navy/78 transition hover:bg-indigo-soft/55 hover:text-navy" href="/#how-it-works">Resources</Link>
          <Link className="rounded-full px-3.5 py-2 text-[13px] font-semibold text-navy/78 transition hover:bg-indigo-soft/55 hover:text-navy" href="/#about">About</Link>
        </nav>

        <div className="flex items-center gap-1.5 sm:gap-2">
          <Button href="/login" size="sm" variant="ghost" className="hidden sm:inline-flex">Log in</Button>
          <Button href="/signup" size="sm" className="px-4 sm:px-5">Create Account <span aria-hidden="true">→</span></Button>
        </div>
      </Container>
    </header>
  );
}
