import Link from "next/link";
import type { PublicKnowledgePost } from "../lib/backend";
import type { PublicJob } from "./public-site";
import { HumanPortrait } from "./human-portrait";
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

const roles = [
  { title: "Candidates", copy: "Discover roles, showcase your potential, and grow your career.", href: "/jobs", action: "Explore jobs", role: "candidate" as const },
  { title: "Recruiters", copy: "Find and engage great talent faster with a focused hiring workspace.", href: "/recruiters", action: "Explore recruiting", role: "recruiter" as const },
  { title: "Hiring Managers", copy: "Make confident hiring decisions with clearer people signals.", href: "/recruiters", action: "See how it works", role: "manager" as const },
  { title: "Consultants", copy: "Expand your network, submit candidates, and create more opportunity.", href: "/recruiter/register", action: "Join as consultant", role: "consultant" as const },
  { title: "Companies", copy: "Build stronger teams and a better candidate experience.", href: "/companies", action: "Explore companies", role: "company" as const },
  { title: "Referral Partners", copy: "Connect people to opportunities and create impact together.", href: "/register", action: "Start connecting", role: "referral" as const },
];

export function PublicLandingRebuildV2({ jobs = [], articles = [] }: PublicLandingRebuildV2Props) {
  const visibleJobs = jobs.slice(0, 6);
  const heroJob = visibleJobs[0];
  const featuredArticles = articles.filter((article) => article.featured).slice(0, 3);
  const visibleArticles = featuredArticles.length ? featuredArticles : articles.slice(0, 3);

  return (
    <main className={styles.page}>
      <header className={styles.header}>
        <Link className={styles.wordmark} href="/" aria-label="SapienWorx home">SapienWorx<span>People. Opportunities. Real growth.</span></Link>
        <nav className={styles.primaryNav} aria-label="Public navigation">
          <Link href="/jobs">Find Jobs</Link>
          <Link href="/companies">Companies</Link>
          <Link href="/knowledge">Career Resources</Link>
        </nav>
        <div className={styles.headerActions}>
          <Link className={styles.recruiterEntry} href="/recruiters">For Recruiters</Link>
          <Link className={styles.signIn} href="/login">Sign In</Link>
          <Link className={styles.candidateCta} href="/register">Create Profile</Link>
          <details className={styles.mobileMenu}>
            <summary aria-label="Open navigation">Menu</summary>
            <nav aria-label="Mobile public navigation">
              <Link href="/jobs">Find Jobs</Link><Link href="/companies">Companies</Link><Link href="/knowledge">Career Resources</Link><Link href="/login">Sign In</Link><Link href="/register">Create Profile</Link><Link href="/recruiters">For Recruiters</Link>
            </nav>
          </details>
        </div>
      </header>

      <section className={styles.hero}>
        <div className={styles.heroGrid}>
          <div className={styles.heroCopy}>
            <span className={styles.eyebrow}>Built around your career, not a hiring workflow.</span>
            <h1>Your next opportunity starts with <em>your signal.</em></h1>
            <p>Discover meaningful opportunities, show what you can do, and stay in control of your career journey.</p>
            <form className={styles.search} action="/jobs" method="get" aria-label="Search jobs">
              <label><span>Job title or skills</span><input name="keywords" placeholder="Java, Product Designer…" /></label>
              <label><span>Location</span><input name="location" placeholder="City or remote" /></label>
              <button type="submit">Explore Jobs <span aria-hidden="true">→</span></button>
            </form>
            <div className={styles.heroActions}>
              <Link className={styles.primaryAction} href="/register">Build Your Profile</Link>
              <Link className={styles.inlineAction} href="/jobs">Browse all jobs <span aria-hidden="true">→</span></Link>
            </div>
            <div className={styles.candidateBenefits} aria-label="Candidate benefits"><span>Verified employers</span><span>Clear application status</span><span>Privacy controls</span></div>
          </div>

          <div className={styles.heroVisual} aria-label="Candidate profile and opportunity signals">
            <div className={styles.heroGlow} />
            <HumanPortrait role="candidate" className={styles.heroPortrait} />
            <div className={`${styles.floatCard} ${styles.profileCard}`}><span>Profile strength</span><strong>85%</strong><small>Resume · Skills · Experience</small></div>
            <div className={`${styles.floatCard} ${styles.matchCard}`}><span>{heroJob ? "Top match" : "Ready for opportunities"}</span><strong>{heroJob?.title ?? "Your profile, your signal"}</strong><small>{heroJob ? `${heroJob.company} · ${jobLocation(heroJob)}` : "Complete your profile to improve discovery"}</small>{heroJob ? <Link href={jobHref(heroJob)}>View role →</Link> : null}</div>
          </div>
        </div>
      </section>

      <section className={styles.trust} aria-label="Candidate experience principles">
        <article><span>01</span><h2>Real roles. Clear details.</h2><p>Compare skills, experience, work model, and employer context without digging.</p></article>
        <article><span>02</span><h2>Your profile stays yours.</h2><p>Control visibility and how hiring teams can contact you.</p></article>
        <article><span>03</span><h2>Know what happens next.</h2><p>Follow your application journey with less uncertainty.</p></article>
      </section>

      <section className={styles.roleSection}>
        <header className={styles.sectionHeading}><div><span className={styles.eyebrow}>One ecosystem. Different goals.</span><h2>A better hiring experience for everyone.</h2><p>Same Human Signal. Different ways to create opportunity.</p></div></header>
        <div className={styles.roleGrid}>
          {roles.map((item) => <article className={`${styles.roleCard} ${styles[item.role]}`} key={item.title}><HumanPortrait role={item.role} compact/><div><h3>{item.title}</h3><p>{item.copy}</p><Link href={item.href}>{item.action} <span aria-hidden="true">→</span></Link></div></article>)}
        </div>
      </section>

      <section className={styles.platformSection}>
        <div className={styles.platformCopy}><span className={styles.eyebrow}>Human insight. Product intelligence.</span><h2>Everything you need to hire smarter.</h2><p>Human-first tools for finding, engaging, assessing, and moving talent through a clear process.</p><Link className={styles.primaryAction} href="/recruiters">Explore recruiter workspace</Link></div>
        <div className={styles.featureGrid}>
          <article><span>⌕</span><h3>Advanced Talent Search</h3><p>Go beyond keywords with structured skills and experience signals.</p></article>
          <article><span>◎</span><h3>Candidate Management</h3><p>Keep hiring teams aligned around people, context, and next steps.</p></article>
          <article><span>↗</span><h3>Outreach & Automation</h3><p>Personalize communication without losing the human relationship.</p></article>
          <article><span>▥</span><h3>Analytics & Insights</h3><p>Understand the flow of hiring and where teams need attention.</p></article>
        </div>
      </section>

      {visibleJobs.length ? <section className={styles.jobsSection}>
        <header className={styles.sectionHeading}><div><span className={styles.eyebrow}>Verified opportunities</span><h2>Roles worth your attention.</h2></div><Link href="/jobs">View all jobs →</Link></header>
        <div className={styles.jobGrid}>{visibleJobs.map((job) => <Link href={jobHref(job)} className={styles.jobCard} key={job.id}><div><span>{job.company}</span>{job.verifiedEmployer ? <b>✓ Verified</b> : null}</div><h3>{job.title}</h3><p>{jobLocation(job)} · {job.experience}</p><div className={styles.tags}>{job.tags.slice(0, 4).map((tag) => <span key={tag}>{tag}</span>)}</div><strong>View role →</strong></Link>)}</div>
      </section> : null}

      <section className={styles.recruiterBand}>
        <div><span className={styles.eyebrow}>Hiring talent?</span><h2>See the people signal behind every hire.</h2><p>A dedicated workspace for recruiters, consultants, and hiring teams to source, evaluate, collaborate, and decide with more context.</p><Link className={styles.lightAction} href="/recruiters">Go to Recruiter Portal</Link></div>
        <div className={styles.recruiterVisual}><HumanPortrait role="recruiter"/><div className={styles.pipelineCard}><span>Hiring pipeline</span><strong>248</strong><small>Applications</small><strong>64</strong><small>Shortlisted</small></div></div>
      </section>

      {visibleArticles.length ? <section className={styles.resourcesSection}><header className={styles.sectionHeading}><div><span className={styles.eyebrow}>Career resources</span><h2>Useful guidance for real career decisions.</h2></div><Link href="/knowledge">All resources →</Link></header><div className={styles.articleGrid}>{visibleArticles.map((article) => <article key={article.id}><span>{article.category}</span><h3>{article.title}</h3><p>{article.excerpt}</p><footer><small>{article.readingMinutes} min read</small><Link href={`/knowledge/${article.slug}`}>Read article →</Link></footer></article>)}</div></section> : null}

      <section className={styles.closingCta}><div><span className={styles.eyebrow}>People. Opportunities. Real growth.</span><h2>Build a brighter next chapter.</h2><p>Whether you are exploring your next role or building your next team, SapienWorx keeps the experience clear, human, and connected.</p><div><Link className={styles.primaryAction} href="/register">Create your profile</Link><Link className={styles.secondaryAction} href="/recruiters">For recruiters</Link></div></div><HumanPortrait role="candidate" compact/></section>

      <footer className={styles.footer}><div><Link className={styles.footerWordmark} href="/">SapienWorx</Link><p>Human-first hiring, intelligently structured.</p></div><nav><div><strong>Candidates</strong><Link href="/jobs">Find jobs</Link><Link href="/register">Create profile</Link><Link href="/login">Sign in</Link></div><div><strong>Recruiters</strong><Link href="/recruiters">Recruiter product</Link><Link href="/recruiter/register">Create account</Link><Link href="/recruiter/login">Sign in</Link></div><div><strong>Resources</strong><Link href="/companies">Companies</Link><Link href="/knowledge">Career resources</Link></div><div><strong>Legal</strong><Link href="/privacy">Privacy</Link><Link href="/terms">Terms</Link><Link href="/cookies">Cookies</Link></div></nav><small>© 2026 SapienWorx. All rights reserved.</small></footer>
    </main>
  );
}
