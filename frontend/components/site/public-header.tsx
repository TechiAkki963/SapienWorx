import Link from "next/link";

import { Wordmark } from "@/components/brand/wordmark";
import { Button } from "@/components/ui/button";
import { Container } from "@/components/layout/container";
import type { Role } from "@/lib/auth-server";

export function PublicHeader({ sessionRole }: { sessionRole?: Role }) {
  const workspaceHref = sessionRole === "recruiter" ? "/recruiter" : sessionRole === "candidate" ? "/candidate" : sessionRole === "master_admin" ? "/swx-command-centre/overview" : "";
  const workspaceLabel = sessionRole === "recruiter" ? "Recruiter workspace" : sessionRole === "candidate" ? "Candidate workspace" : "Admin workspace";
  return (
    <header className="sticky top-0 z-50 border-b border-white/60 bg-white/82 backdrop-blur-xl supports-[backdrop-filter]:bg-white/74">
      <Container className="flex min-h-[72px] min-w-0 items-center justify-between gap-2 py-3 sm:gap-4">
        <Link href="/" aria-label="SapienWorx home" className="min-w-0 shrink">
          <Wordmark className="text-sm sm:text-lg" />
        </Link>

        <nav className="hidden items-center gap-1 lg:flex" aria-label="Primary navigation">
          <Link className="rounded-full px-3.5 py-2 text-[13px] font-semibold text-navy/78 transition hover:bg-indigo-soft/55 hover:text-navy" href="/jobs">Find Jobs</Link>
          <Link className="rounded-full px-3.5 py-2 text-[13px] font-semibold text-navy/78 transition hover:bg-indigo-soft/55 hover:text-navy" href={sessionRole === "recruiter" ? "/recruiter" : "/recruiter/login"}>{sessionRole === "recruiter" ? "Recruiter workspace" : "For Recruiters"}</Link>
          <Link className="rounded-full px-3.5 py-2 text-[13px] font-semibold text-navy/78 transition hover:bg-indigo-soft/55 hover:text-navy" href="/#knowledge-hub">Resources</Link>
          <Link className="rounded-full px-3.5 py-2 text-[13px] font-semibold text-navy/78 transition hover:bg-indigo-soft/55 hover:text-navy" href="/#about">About</Link>
        </nav>

        <div className="flex items-center gap-1.5 sm:gap-2">
          {workspaceHref ? (
            <span className="hidden sm:inline-flex"><Button href={workspaceHref} size="sm" className="px-3 sm:px-5">{workspaceLabel} <span aria-hidden="true">→</span></Button></span>
          ) : (
            <>
              <Button href="/login" size="sm" variant="ghost" className="hidden md:inline-flex">Log in</Button>
              <Button href="/signup" size="sm" className="px-3 sm:px-5"><span className="sm:hidden">Join</span><span className="hidden sm:inline">Create Account</span><span aria-hidden="true">→</span></Button>
            </>
          )}
          <details className="group relative lg:hidden">
            <summary className="flex min-h-10 cursor-pointer list-none items-center rounded-full border border-line bg-white px-3 text-sm font-semibold text-navy hover:bg-indigo-soft/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo">Menu <span className="ml-1.5 text-xs transition-transform group-open:rotate-180" aria-hidden="true">▾</span></summary>
            <nav aria-label="Mobile navigation" className="absolute right-0 top-full z-50 mt-2 grid w-52 gap-1 rounded-2xl border border-line bg-white p-2 shadow-card">
              <Link className="rounded-lg px-3 py-2.5 text-sm font-semibold text-navy hover:bg-indigo-soft" href="/jobs">Find Jobs</Link>
              {workspaceHref ? <Link className="rounded-lg px-3 py-2.5 text-sm font-semibold text-navy hover:bg-indigo-soft" href={workspaceHref}>{workspaceLabel}</Link> : <Link className="rounded-lg px-3 py-2.5 text-sm font-semibold text-navy hover:bg-indigo-soft" href="/login">Log in</Link>}
              <Link className="rounded-lg px-3 py-2.5 text-sm font-semibold text-navy hover:bg-indigo-soft" href="/#how-it-works">How it works</Link>
              <Link className="rounded-lg px-3 py-2.5 text-sm font-semibold text-navy hover:bg-indigo-soft" href="/#about">About</Link>
              <div className="my-1 border-t border-line" />
              <Link className="rounded-lg px-3 py-2.5 text-sm font-semibold text-indigo hover:bg-indigo-soft" href={sessionRole === "recruiter" ? "/recruiter" : "/recruiter/login"}>{sessionRole === "recruiter" ? "Recruiter workspace" : "For Recruiters"}</Link>
            </nav>
          </details>
        </div>
      </Container>
    </header>
  );
}
