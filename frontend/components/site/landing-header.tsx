import Link from "next/link";
import { Container } from "@/components/layout/container";
import { Wordmark } from "@/components/brand/wordmark";

export function LandingHeader() {
  return (
    <header className="swx-header">
      <Container className="swx-header-inner">
        <Link href="/" aria-label="SapienWorx home"><Wordmark className="swx-wordmark" /></Link>
        <nav className="swx-desktop-nav" aria-label="Landing navigation"><Link href="/jobs">Find Jobs</Link><Link href="/#knowledge-hub">Knowledge Hub</Link><Link href="/#about">About</Link></nav>
        <div className="swx-header-actions">
          <Link className="swx-recruiter-link" href="/recruiter/login">For Recruiters <span aria-hidden="true">→</span></Link>
          <Link className="swx-create-link" href="/signup">Create Account <span aria-hidden="true">→</span></Link>
          <details className="swx-mobile-menu"><summary aria-label="Open navigation">☰</summary><nav aria-label="Mobile navigation"><Link href="/jobs">Find Jobs</Link><Link href="/#knowledge-hub">Knowledge Hub</Link><Link href="/#about">About</Link><Link href="/login">Log in</Link><Link href="/recruiter/login">For Recruiters</Link><Link href="/signup">Create Account</Link></nav></details>
        </div>
      </Container>
    </header>
  );
}
