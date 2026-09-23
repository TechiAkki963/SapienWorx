import Link from "next/link";

import { Wordmark } from "@/components/brand/wordmark";

const nav = [
  ["Find Jobs", "/jobs"],
  ["Knowledge Hub", "/#knowledge-hub"],
  ["About", "/#about"],
] as const;

export function PublicHeader() {
  return (
    <header className="swx-public-header">
      <div className="swx-wrap swx-header-inner">
        <Link href="/" aria-label="SapienWorx home" className="swx-brand-link"><Wordmark /></Link>
        <nav className="swx-desktop-nav" aria-label="Primary navigation">
          {nav.map(([label, href]) => <Link key={href} href={href}>{label}</Link>)}
        </nav>
        <div className="swx-header-actions">
          <Link href="/recruiter/login" className="swx-pill swx-pill-outline swx-recruiter-link">For Recruiters <span aria-hidden="true">→</span></Link>
          <Link href="/login" className="swx-header-login">Log in</Link>
          <Link href="/signup" className="swx-pill swx-pill-primary swx-header-signup">Create Account <span aria-hidden="true">→</span></Link>
        </div>
        <details className="swx-mobile-menu">
          <summary aria-label="Menu">Menu <span aria-hidden="true">☰</span></summary>
          <nav aria-label="Mobile navigation" className="swx-mobile-nav">
            {nav.map(([label, href]) => <Link key={href} href={href}>{label}</Link>)}
            <Link href="/recruiter/login">For Recruiters</Link>
            <Link href="/login">Log in</Link>
            <Link href="/signup" className="swx-mobile-join">Create Account →</Link>
          </nav>
        </details>
      </div>
    </header>
  );
}
