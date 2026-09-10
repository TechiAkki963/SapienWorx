import Link from "next/link";
import { PublicNavigation } from "../../components/public-site";

const recruiterFlow = [
  ["01", "Source", "Structured and Boolean search with transparent criteria."],
  ["02", "Engage", "Candidate outreach and communication kept in context."],
  ["03", "Assess", "Review evidence, notes, interviews and hiring feedback."],
  ["04", "Hire", "Move candidates through a clear list-based pipeline."],
  ["05", "Measure", "Understand activity and outcomes without inflated claims."],
] as const;

export default function RecruitersPage() {
  return (
    <main className="public-page recruiter-marketing-page">
      <PublicNavigation />

      <section className="recruiter-marketing-hero">
        <div className="public-container recruiter-marketing-hero-grid">
          <div className="recruiter-marketing-copy">
            <span className="eyebrow">SapienWorx for recruiters</span>
            <h1>From open role to successful hire — one workspace.</h1>
            <p>Post roles, source with professional criteria, review candidates, communicate, schedule externally created interviews and keep every hiring decision connected to the role.</p>
            <div className="landing-v2-actions">
              <Link className="button button-primary" href="/recruiter/register">Create recruiter account</Link>
              <Link className="button button-secondary" href="/recruiter/login">Recruiter sign in</Link>
            </div>
          </div>

          <aside className="recruiter-marketing-flow" aria-label="Recruiter workflow">
            <span>One connected hiring flow</span>
            <ol>
              {recruiterFlow.map(([index, title, copy]) => (
                <li key={title}>
                  <span>{index}</span>
                  <div><strong>{title}</strong><br/><small>{copy}</small></div>
                </li>
              ))}
            </ol>
          </aside>
        </div>
      </section>

      <section className="public-section">
        <div className="recruiter-marketing-pillars">
          <article><span>01</span><h2>Structured sourcing</h2><p>Use professional criteria and Boolean search with deterministic relevance. Protected personal attributes are excluded from sourcing and ranking.</p></article>
          <article><span>02</span><h2>Candidate context</h2><p>Review profile evidence, role history, notes and communication without forcing recruiters through disconnected screens.</p></article>
          <article><span>03</span><h2>List-based pipeline</h2><p>Work with compact candidate cards, stage filters and quick actions. SapienWorx does not require a Kanban workflow.</p></article>
          <article><span>04</span><h2>External-link interviews</h2><p>Create the meeting in your preferred provider, paste the HTTPS link into SapienWorx and send the candidate invitation from the hiring workflow.</p></article>
        </div>
      </section>

      <section className="public-section">
        <div className="recruiter-marketing-cta">
          <div><h2>Build a hiring process your team can actually follow.</h2><p>Start with verified work-email access and bring each role, candidate and decision into one governed workspace.</p></div>
          <Link className="button button-primary" href="/recruiter/register">Start recruiter setup</Link>
        </div>
      </section>
    </main>
  );
}
