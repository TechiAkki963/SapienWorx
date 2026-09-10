import Link from "next/link";
import { PublicNavigation } from "../../components/public-site";

export default function RecruitersPage() {
  return (
    <main className="public-page public-list-page">
      <PublicNavigation />
      <section className="public-page-heading">
        <div className="public-container">
          <span className="eyebrow">SapienWorx for recruiters</span>
          <h1>From open role to successful hire — one workspace.</h1>
          <p>Post roles, source candidates with structured search, manage a clear pipeline, communicate with applicants and schedule interviews using recruiter-supplied external meeting links.</p>
          <div className="landing-v2-actions">
            <Link className="button button-primary" href="/recruiter/register">Create recruiter account</Link>
            <Link className="button button-secondary" href="/recruiter/login">Recruiter sign in</Link>
          </div>
        </div>
      </section>
      <section className="public-section">
        <div className="landing-v2-trust-grid">
          <article><span aria-hidden="true">✓</span><div><h2>Structured sourcing</h2><p>Use professional criteria and Boolean search with transparent deterministic relevance. Protected personal attributes are excluded from sourcing and ranking.</p></div></article>
          <article><span aria-hidden="true">✓</span><div><h2>One candidate pipeline</h2><p>Review candidates in a compact list, move stages, add context and keep the hiring team aligned without a forced Kanban workflow.</p></div></article>
          <article><span aria-hidden="true">✓</span><div><h2>External-link interviews</h2><p>Create the meeting in your preferred provider, paste the HTTPS link into SapienWorx and send the candidate invitation from one workflow.</p></div></article>
          <article><span aria-hidden="true">✓</span><div><h2>Governed hiring</h2><p>Keep organisation access, privacy controls, activity and operational history visible to the people responsible for the hiring process.</p></div></article>
        </div>
      </section>
    </main>
  );
}
