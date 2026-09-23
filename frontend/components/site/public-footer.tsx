import Link from "next/link";

import { Wordmark } from "@/components/brand/wordmark";

const sections = [
  { title: "For Candidates", links: [["Find Jobs", "/jobs"], ["Knowledge Hub", "/#knowledge-hub"], ["Career Resources", "/resources/build-a-resume"], ["Create Account", "/signup"]] },
  { title: "For Recruiters", links: [["Recruiter Login", "/recruiter/login"], ["Post a Job", "/recruiter/login"], ["Recruiter Signup", "/recruiter/signup"], ["Recruiter Workspace", "/recruiter"]] },
  { title: "Company", links: [["About Us", "/#about"], ["Our Approach", "/#how-it-works"], ["Candidate Login", "/login"]] },
  { title: "Legal", links: [["Privacy Policy", "/privacy"], ["Subprocessors", "/subprocessors"]] },
] as const;

export function PublicFooter() {
  return (
    <footer className="swx-public-footer">
      <div className="swx-wrap">
        <div className="swx-footer-grid">
          <div className="swx-footer-brand">
            <Link href="/" aria-label="SapienWorx home"><Wordmark /></Link>
            <p>People. Potential. Progress.<br />A career platform for what’s next.</p>
          </div>
          {sections.map((section) => (
            <nav key={section.title} aria-label={section.title} className="swx-footer-column">
              <h2>{section.title}</h2>
              {section.links.map(([label, href]) => <Link key={label} href={href}>{label}</Link>)}
            </nav>
          ))}
        </div>
        <div className="swx-footer-bottom">
          <span>© {new Date().getFullYear()} SapienWorx. All rights reserved.</span>
          <span>People make a brighter tomorrow.</span>
        </div>
      </div>
    </footer>
  );
}
