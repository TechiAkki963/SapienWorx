import { Button, WorkspaceShell } from "../../../components/ui";

export default function ResumeReviewPage() {
  return (
    <WorkspaceShell
      workspace="candidate"
      active="resume"
      title="CV review"
      description="Review parsed CV details only when a real saved parsing result is available."
    >
      <main className="candidate-review-page">
        <section className="panel editorial-empty-state" role="status">
          <span className="eyebrow">No review pending</span>
          <h2>There is no saved CV review waiting for confirmation.</h2>
          <p>
            Sapienworx will not display example candidate details as if they belong to you. Use your profile to review and update the information currently saved to your account.
          </p>
          <div className="heading-actions">
            <Button href="/candidate/profile">Open my profile</Button>
            <Button href="/candidate/onboarding" variant="secondary">Continue onboarding</Button>
          </div>
        </section>
      </main>
    </WorkspaceShell>
  );
}
