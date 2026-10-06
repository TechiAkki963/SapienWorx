import Link from "next/link";

import { Wordmark } from "@/components/brand/wordmark";
import { CandidateNav } from "@/components/candidate/candidate-nav";
import type { CandidateProfileSummary } from "@/lib/candidate";
import { CandidateTopbar } from "./candidate-topbar";
import { CandidateWorkspaceState } from "./candidate-workspace-state";

export function CandidateShell({
  children,
  identity,
  name,
}: {
  children: React.ReactNode;
  identity: CandidateProfileSummary | null;
  name: string;
}) {
  return (
    <CandidateWorkspaceState initialIdentity={identity}>
      <div className="theme-surface candidate-workspace">
        <header className="candidate-workspace-header">
          <div className="candidate-workspace-topbar">
            <Link href="/candidate" aria-label="Candidate dashboard">
              <Wordmark />
            </Link>
            <CandidateTopbar name={name} />
          </div>
        </header>
        <div className="candidate-workspace-grid">
          <aside className="candidate-workspace-sidebar">
            <CandidateNav />
          </aside>
          <main id="main-content" className="candidate-workspace-main">
            {children}
          </main>
        </div>
        <CandidateNav mobile />
      </div>
    </CandidateWorkspaceState>
  );
}
