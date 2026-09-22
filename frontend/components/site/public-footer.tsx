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
      ["Career resources", "/knowledge-hub"],
      ["Candidate Login", "/login"],
    ],
  },
];

export function PublicFooter() {
  return (
    <footer className="border-t border-line/70 bg-white">
      <Container className="py-12 sm:py-14">
        <div className="grid gap-10 lg:grid-cols-[1.2fr_2fr_1fr]">
          <div>
            <Wordmark />
            <p className="mt-3 max-w-xs text-sm leading-6 text-ink-muted">People. Work. Forward.</p>
            <p className="mt-5 max-w-xs text-xs leading-5 text-ink-muted">A candidate-first recruitment platform focused on clearer opportunities and more human hiring experiences.</p>
          </div>

          <div className="grid gap-8 sm:grid-cols-3">
            {groups.map((group) => (
              <div key={group.title}>
                <h2 className="text-xs font-extrabold uppercase tracking-[0.13em] text-navy">{group.title}</h2>
                <ul className="mt-4 grid gap-2.5 text-sm text-ink-muted">
                  {group.links.map(([label, href]) => (
                    <li key={label}><Link href={href} className="transition hover:text-indigo">{label}</Link></li>
                  ))}
                </ul>
              </div>
            ))}
          </div>

          <div>
            <h2 className="text-xs font-extrabold uppercase tracking-[0.13em] text-navy">Stay in the loop</h2>
            <p className="mt-3 text-sm leading-6 text-ink-muted">Product updates and career resources will live here as SapienWorx grows.</p>
            <Link href="/signup" className="mt-5 inline-flex min-h-11 items-center rounded-full bg-indigo px-5 text-sm font-bold text-white transition hover:-translate-y-0.5 hover:bg-navy">Create account →</Link>
          </div>
        </div>

        <div className="mt-12 flex flex-col gap-3 border-t border-line/70 pt-6 text-xs text-ink-muted sm:flex-row sm:items-center sm:justify-between">
          <p>© 2026 SapienWorx. All rights reserved.</p>
          <p>A more human way to work.</p>
        </div>
      </Container>
    </footer>
  );
}
