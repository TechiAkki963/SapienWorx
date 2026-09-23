import Link from "next/link";

import { Wordmark } from "@/components/brand/wordmark";
import { Container } from "@/components/layout/container";

const groups = [
  {
    title: "For Candidates",
    links: [
      ["Find Jobs", "/jobs"],
      ["Create Profile", "/signup"],
      ["Knowledge Hub", "/knowledge-hub"],
      ["Applications", "/candidate/applications"],
      ["Saved Jobs", "/candidate/saved"],
    ],
  },
  {
    title: "For Recruiters",
    links: [
      ["Recruiter Login", "/recruiter/login"],
      ["Recruiter Signup", "/recruiter/signup"],
      ["Recruiter Workspace", "/recruiter"],
    ],
  },
  {
    title: "SapienWorx",
    links: [
      ["About", "/#about"],
      ["How it works", "/#how-it-works"],
      ["Career Resources", "/knowledge-hub"],
      ["Candidate Login", "/login"],
    ],
  },
  {
    title: "Legal & Privacy",
    links: [
      ["Privacy Policy", "/privacy"],
      ["Subprocessors", "/subprocessors"],
    ],
  },
] as const;

export function PublicFooter() {
  return (
    <footer className="border-t border-line/70 bg-white">
      <Container className="py-12 sm:py-14">
        <div className="grid gap-9 border-b border-line/70 pb-9 lg:grid-cols-[minmax(15rem,1fr)_3fr] lg:gap-12">
          <div>
            <Wordmark />
            <p className="mt-3 font-semibold text-navy">People. Work. Forward.</p>
            <p className="mt-3 max-w-xs text-sm leading-6 text-ink-muted">
              A candidate-first recruitment platform focused on clearer opportunities and more human hiring.
            </p>
          </div>
          <nav aria-label="Footer navigation" className="grid grid-cols-2 gap-x-5 gap-y-9 sm:grid-cols-4 sm:gap-6">
            {groups.map((group) => (
              <div key={group.title} className="min-w-0">
                <h2 className="text-xs font-extrabold uppercase tracking-[0.1em] text-navy">{group.title}</h2>
                <ul className="mt-4 grid gap-2.5 text-sm text-ink-muted">
                  {group.links.map(([label, href]) => (
                    <li key={href}><Link href={href} className="inline-flex min-h-6 items-center transition hover:text-indigo focus-visible:text-indigo">{label}</Link></li>
                  ))}
                </ul>
              </div>
            ))}
          </nav>
        </div>
        <div className="flex flex-col gap-3 pt-6 text-xs text-ink-muted sm:flex-row sm:items-center sm:justify-between">
          <p>© 2026 SapienWorx. All rights reserved.</p>
          <p>Social updates: <Link href="/knowledge-hub" className="font-semibold text-indigo hover:underline">Knowledge Hub</Link> · A more human way to work.</p>
        </div>
      </Container>
    </footer>
  );
}
