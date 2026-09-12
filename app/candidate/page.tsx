import { CandidateDashboardSnapshot } from "../../components/candidate-dashboard-snapshot";
import { Button, WorkspaceShell } from "../../components/ui";
import { getCandidateDashboardSnapshot } from "../../lib/backend";

export const dynamic = "force-dynamic";

export default async function CandidatePage() {
  const dashboard = await getCandidateDashboardSnapshot();

  if (!dashboard) {
    return (
      <WorkspaceShell
        workspace="candidate"
        active="dashboard"
        title="Career workspace"
        description="Your private overview of recruiter activity, applications, and profile progress."
      >
        <main className="candidate-analytics-dashboard">
          <section className="panel editorial-empty-state" role="status">
            <span className="eyebrow">Dashboard unavailable</span>
            <h2>We don&apos;t have profile-performance data to show yet.</h2>
            <p>No sample candidate data is shown here. Complete your profile or explore jobs while your real activity builds up.</p>
            <div className="heading-actions">
              <Button href="/candidate/profile">Review profile</Button>
              <Button href="/candidate/jobs" variant="secondary">Explore jobs</Button>
            </div>
          </section>
        </main>
      </WorkspaceShell>
    );
  }

  return <CandidateDashboardSnapshot initialData={dashboard} />;
}
