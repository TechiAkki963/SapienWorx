import { WorkspaceShell } from "../../../../components/ui";
import Link from "next/link";

function safeReturnTo(value: string | string[] | undefined) {
  const destination = Array.isArray(value) ? value[0] : value;
  return destination?.startsWith("/search/results") ? destination : "/recruiter/sourcing";
}

export default async function RecruiterCandidateProfilePage({ params, searchParams }: { params: Promise<{ candidateId: string }>; searchParams: Promise<{ returnTo?: string | string[] }> }) {
  const { candidateId } = await params;
  const { returnTo } = await searchParams;
  return <WorkspaceShell workspace="recruiter" active="sourcing" title="Candidate profile" description="Review a candidate while keeping your sourcing context intact.">
    <section className="panel candidate-profile-return"><span className="eyebrow">Sourcing review</span><h2>Candidate reference</h2><p>Profile {candidateId.slice(0, 12)} is opened in a focused review space. Returning to results preserves every search criterion and quick refinement.</p><Link className="button button-primary" href={safeReturnTo(returnTo)}>← Back to search results</Link>
  </section>
  </WorkspaceShell>;
}
