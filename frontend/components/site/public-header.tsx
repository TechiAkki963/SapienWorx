import Link from "next/link";
import { Wordmark } from "@/components/brand/wordmark";
import { Button } from "@/components/ui/button";
import { Container } from "@/components/layout/container";

export function PublicHeader() {
  return (
    <header className="sticky top-0 z-40 border-b border-white/70 bg-canvas/90 backdrop-blur-xl">
      <Container className="flex min-h-16 items-center justify-between gap-2 py-2.5 sm:gap-4 sm:py-3">
        <Link href="/" aria-label="SapienWorx home"><Wordmark compactOnMobile className="text-lg" /></Link>
        <nav className="hidden items-center gap-1 md:flex" aria-label="Primary navigation">
          <Link className="rounded-full px-4 py-2 text-sm font-semibold text-ink-muted transition hover:bg-white hover:text-ink" href="/jobs">Find jobs</Link>
          <Link className="rounded-full px-4 py-2 text-sm font-semibold text-ink-muted transition hover:bg-white hover:text-ink" href="/#how-it-works">How it works</Link>
          <Link className="rounded-full px-4 py-2 text-sm font-semibold text-ink-muted transition hover:bg-white hover:text-ink" href="/recruiter/login">For recruiters</Link>
        </nav>
        <div className="flex shrink-0 items-center gap-1 sm:gap-2">
          <Button href="/login" size="sm" variant="ghost" className="whitespace-nowrap px-2.5 sm:px-3.5">Sign in</Button>
          <Button href="/signup" size="sm" className="whitespace-nowrap px-3 sm:px-3.5"><span className="sm:hidden">Join</span><span className="hidden sm:inline">Create profile</span></Button>
        </div>
      </Container>
    </header>
  );
}
