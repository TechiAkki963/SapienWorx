import Link from "next/link";
import type { PublicKnowledgePost } from "../lib/backend";
import type { PublicJob } from "./public-site";
import { HumanSignal } from "./human-signal";
import styles from "./public-landing-rebuild-v2.module.css";

type PublicLandingRebuildV2Props = {
  jobs?: PublicJob[];
  articles?: PublicKnowledgePost[];
};

function jobHref(job: PublicJob) {
  return job.publicPath ?? `/jobs/${encodeURIComponent(job.id)}/${job.title.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "")}`;
}

function humanLabel(value: string) {
  return value.toLowerCase().split("_").filter(Boolean).map((part) => `${part[0]?.toUpperCase() ?? ""}${part.slice(1)}`).join(" ");
}

function jobLocation(job: PublicJob) {
  const workplace = humanLabel(job.workplaceModel);
  return job.location.toLowerCase().includes(workplace.toLowerCase()) ? job.location : `${job.location} · ${workplace}`;
}

export function PublicLandingRebuildV2({ jobs = [], articles = [] }: PublicLandingRebuildV2Props) {
  const visibleJobs = jobs.slice(0, 6);
  const heroJobs = visibleJobs.slice(0, 3);
  const featuredArticles = articles.filter((article) => article.featured).slice(0, 3);
  const visibleArticles = featuredArticles.length ? featuredArticles : articles.slice(0, 3);
  const companies = Array.from(new Map(jobs.map((job) => [job.companySlug, job])).values()).slice(0, 6);

  return (
    <main className={styles.page}>
      <header className={styles.header}>
        <Link className={styles.wordmark} href="/" aria-label="SapienWorx home">SapienWorx</Link>
        <nav className={styles.primaryNav} aria-label="Public navigation">
          <Link href="/jobs">Find Jobs</Link>
          <Link href="/companies">Companies</Link>
          <Link href="/knowledge">Career Resources</Link>
        </nav>
        <div className={styles.headerActions}>
          <Link className={styles.recruiterEntry} href="/recruiters">Hiring talent?</Link>
          <Link className={styles.signIn} href="/login">Sign In</Link>
          <Link className={styles.candidateCta} href="/register">Create Profile</Link>
          <details className={styles.mobileMenu}>
            <summary aria-label="Open navigation">Menu</summary>
            <nav aria-label="Mobile public navigation">
              <Link href="/jobs">Find Jobs</Link>
              <Link href="/companies">Companies</Link>
              <Link href="/knowledge">Career Resources</Link>
              <Link href="/login">Candidate Sign In</Link>
              <Link href="/register">Create Profile</Link>
              <Link href="/recruiters">Hiring talent? Recruiter Portal</Link>
            </nav>
          </details>
        </div>
      </header>

      <section className={styles.hero}>
        <div className={styles.heroGrid}>
          <div className={styles.heroCopy}>
            <span className={styles.eyebrow}>Built around your career, not a hiring workflow.</span>
            <h1>Your next chapter <em>is closer than you think.</em></h1>
            <p>Discover meaningful opportunities, show what you can do, and stay in control of your profile while SapienWorx keeps every step clear.</p>

            <form className={styles.search} action="/jobs" method="get" aria-label="Search jobs">
              <label className={styles.searchField}>
                <span>Job title or skills</span>
                <input name="keywords" placeholder="e.g. Java, Product Designer" />
              </label>
              <label className={styles.searchField}>
                <span>Experience</span>
                <input name="minimumExperienceYears" type="number" min="0" max="60" inputMode="numeric" placeholder="Years" />
              </label>
              <label className={styles.searchField}>
                <span>Location</span>
                <input name="location" placeholder="City or location" />
              </label>
              <button type="submit">Explore Jobs</button>
            </form>

            <div className={styles.candidateBenefits} aria-label="Candidate benefits">
              <span>Clear application status</span>
              <span>Profile privacy controls</span>
              <span>Relevant opportunities</span>
            </div>

            <div className={styles.heroActions}>
              <Link className={styles.secondaryAction} href="/register">Build Your Profile</Link>
              <Link className={styles.inlineAction} href="/jobs">Browse all jobs <span aria-hidden="true">→</span></Link>
            </div>
            <p className={styles.privacyNote}><span aria-hidden="true">✓</span> You decide how visible your profile is and how employers can contact you.</p>
          </div>

          <div className={styles.heroVisual} aria-label="Candidate opportunities connected through the SapienWorx Human Signal">
            <HumanSignal tone="candidate" className={styles.heroSignal} />
            <aside className={styles.heroPreview} aria-label="Current opportunities">
              <div className={styles.previewHeading}>
                <span>Opportunities for you</span>
                <strong>{jobs.length ? `${jobs.length}+ roles` : "Published roles"}</strong>
              </div>
              {heroJobs.length ? (
                <div className={styles.previewList}>
                  {heroJobs.map((job) => (
                    <Link href={jobHref(job)} className={styles.previewJob} key={job.id}>
                      <span className={styles.companyMark} aria-hidden="true">{job.mark}</span>
                      <span>
                        <strong>{job.title}</strong>
                        <small>{job.company}</small>
                        <small>{jobLocation(job)}</small>
                      </span>
                      <b aria-hidden="true">→</b>
                    </Link>
                  ))}
                </div>
              ) : (
                <div className={styles.previewEmpty}><strong>New roles will appear here.</strong><p>Search current opportunities when hiring teams publish them.</p></div>
              )}
            </aside>
          </div>
        </div>
      </section>

      <section className={styles.trust} aria-label="Why candidates use SapienWorx">
        <article><span>01</span><h2>Verified employers</h2><p>Know when an employer has completed SapienWorx verification before you engage.</p></article>
        <article><span>02</span><h2>Clear role details</h2><p>Compare skills, experience, location, and work model without digging through vague listings.</p></article>
        <article><span>03</span><h2>Application visibility</h2><p>Follow your recruitment progress without guessing where your application stands.</p></article>
      </section>

      <section className={styles.section}>
        <header className={styles.sectionHeading}>
          <div><span className={styles.eyebrow}>Verified opportunities</span><h2>Roles worth your attention.</h2><p>Current published opportunities from hiring teams using SapienWorx.</p></div>
          <Link href="/jobs">View all jobs <span aria-hidden="true">→</span></Link>
        </header>
        {visibleJobs.length ? (
          <div className={styles.jobList}>
            {visibleJobs.map((job) => (
              <article className={styles.jobRow} key={job.id}>
                <span className={styles.companyMark} aria-hidden="true">{job.mark}</span>
                <div className={styles.jobMain}>
                  <p>{job.company}{job.verifiedEmployer ? <span className={styles.verified}>✓ Verified employer</span> : null}</p>
                  <h3>{job.title}</h3>
                  <div className={styles.meta}><span>{jobLocation(job)}</span><span>{job.experience}</span><span>{humanLabel(job.employmentType)}</span></div>
                  {job.tags.length ? <div className={styles.tags}>{job.tags.slice(0, 5).map((tag) => <span key={tag}>{tag}</span>)}</div> : null}
                </div>
                <Link className={styles.rowAction} href={jobHref(job)}>View role <span aria-hidden="true">→</span></Link>
              </article>
            ))}
          </div>
        ) : (
          <div className={styles.emptyState}><HumanSignal tone="candidate" compact/><h3>No published roles right now.</h3><p>Check again later or create your profile so you are ready when new roles are published.</p><Link href="/register">Create profile</Link></div>
        )}
      </section>

      {companies.length ? (
        <section className={`${styles.section} ${styles.companySection}`}>
          <header className={styles.sectionHeading}><div><span className={styles.eyebrow}>Hiring companies</span><h2>Explore teams that are hiring.</h2></div><Link href="/companies">Browse companies <span aria-hidden="true">→</span></Link></header>
          <div className={styles.companyGrid}>{companies.map((job) => <Link href={`/companies/${encodeURIComponent(job.companySlug)}`} key={job.companySlug}><span className={styles.companyMark} aria-hidden="true">{job.mark}</span><span><strong>{job.company}</strong><small>{job.verifiedEmployer ? "Verified employer" : "Company profile"}</small></span><b aria-hidden="true">→</b></Link>)}</div>
        </section>
      ) : null}

      <section className={styles.recruiterBand}>
        <div className={styles.recruiterBandCopy}>
          <span className={styles.recruiterEyebrow}>Hiring talent?</span>
          <h2>There is a dedicated workspace for recruiters and hiring teams.</h2>
          <p>Source, review, interview, and decide in a structured hiring workspace without changing the candidate-first experience on the public site.</p>
          <Link className={styles.recruiterCta} href="/recruiters">Go to Recruiter Portal</Link>
        </div>
        <HumanSignal tone="recruiter" className={styles.recruiterSignal}/>
      </section>

      {visibleArticles.length ? (
        <section className={styles.section}>
          <header className={styles.sectionHeading}><div><span className={styles.eyebrow}>Career resources</span><h2>Useful guidance for real career decisions.</h2></div><Link href="/knowledge">All resources <span aria-hidden="true">→</span></Link></header>
          <div className={styles.articleGrid}>{visibleArticles.map((article) => <article key={article.id}><span>{article.category}</span><h3>{article.title}</h3><p>{article.excerpt}</p><footer><small>{article.readingMinutes} min read</small><Link href={`/knowledge/${article.slug}`}>Read article <span aria-hidden="true">→</span></Link></footer></article>)}</div>
        </section>
      ) : null}

      <footer className={styles.footer}>
        <div className={styles.footerBrand}><Link className={styles.footerWordmark} href="/">SapienWorx</Link><p>Human-first hiring, intelligently structured.</p></div>
        <div className={styles.footerLinks}>
          <div><strong>Candidates</strong><Link href="/jobs">Find jobs</Link><Link href="/register">Create profile</Link><Link href="/login">Sign in</Link></div>
          <div><strong>Recruiters</strong><Link href="/recruiters">Recruiter product</Link><Link href="/recruiter/register">Create account</Link><Link href="/recruiter/login">Sign in</Link></div>
          <div><strong>Resources</strong><Link href="/companies">Companies</Link><Link href="/knowledge">Career resources</Link></div>
          <div><strong>Legal</strong><Link href="/privacy">Privacy</Link><Link href="/terms">Terms of use</Link><Link href="/cookies">Cookies</Link></div>
        </div>
        <small>© 2026 SapienWorx. All rights reserved.</small>
      </footer>
    </main>
  );
}
