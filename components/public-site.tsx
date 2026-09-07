import Link from "next/link";
import { Logo } from "./ui";
import { PublicJobSave } from "./public-job-save";
import type { PublicKnowledgePost } from "../lib/backend";

export type PublicJob = { id: string; company: string; companySlug: string; title: string; tags: string[]; experience: string; location: string; department: string; employmentType: string; workplaceModel: string; postedAt: string | null; verifiedEmployer: boolean; publicPath?: string; mark: string; tone: string };

export const publicJobs: PublicJob[] = [
  { id: "senior-product-designer", company: "Northstar Labs", companySlug: "northstar-labs", title: "Senior Product Designer", tags: ["Figma", "Design systems", "Research"], experience: "5–7 years", location: "London · Hybrid", department: "Design", employmentType: "FULL_TIME", workplaceModel: "HYBRID", postedAt: "2026-08-29T09:00:00Z", verifiedEmployer: true, mark: "N", tone: "navy" },
  { id: "frontend-engineer", company: "Cascade", companySlug: "cascade", title: "Frontend Engineer", tags: ["React", "TypeScript", "Next.js"], experience: "3–5 years", location: "Remote · United Kingdom", department: "Engineering", employmentType: "FULL_TIME", workplaceModel: "REMOTE", postedAt: "2026-08-28T09:00:00Z", verifiedEmployer: true, mark: "C", tone: "blue" },
  { id: "growth-marketing-lead", company: "Plume Health", companySlug: "plume-health", title: "Growth Marketing Lead", tags: ["Growth", "B2B", "Analytics"], experience: "6–8 years", location: "Manchester · Hybrid", department: "Marketing", employmentType: "FULL_TIME", workplaceModel: "HYBRID", postedAt: "2026-08-27T09:00:00Z", verifiedEmployer: true, mark: "P", tone: "orange" },
  { id: "data-analyst", company: "Kinetic", companySlug: "kinetic", title: "Data Analyst", tags: ["SQL", "Python", "Tableau"], experience: "2–4 years", location: "London · Hybrid", department: "Analytics", employmentType: "FULL_TIME", workplaceModel: "HYBRID", postedAt: "2026-08-26T09:00:00Z", verifiedEmployer: true, mark: "K", tone: "purple" },
  { id: "people-operations-partner", company: "Halcyon", companySlug: "halcyon", title: "People Operations Partner", tags: ["HRIS", "Employee experience", "Policy"], experience: "4–6 years", location: "Bristol · Hybrid", department: "People", employmentType: "FULL_TIME", workplaceModel: "HYBRID", postedAt: "2026-08-25T09:00:00Z", verifiedEmployer: true, mark: "H", tone: "green" },
  { id: "product-manager", company: "Morrow", companySlug: "morrow", title: "Product Manager", tags: ["Strategy", "SaaS", "Discovery"], experience: "4–6 years", location: "Remote · United Kingdom", department: "Product", employmentType: "FULL_TIME", workplaceModel: "REMOTE", postedAt: "2026-08-24T09:00:00Z", verifiedEmployer: true, mark: "M", tone: "rose" },
];

const companies = [
  { name: "Northstar Labs", slug: "northstar-labs", mark: "N", tone: "navy", industry: "Analytics" }, { name: "Cascade", slug: "cascade", mark: "C", tone: "blue", industry: "Technology" }, { name: "Plume Health", slug: "plume-health", mark: "P", tone: "orange", industry: "Healthtech" }, { name: "Kinetic", slug: "kinetic", mark: "K", tone: "purple", industry: "Climate tech" }, { name: "Halcyon", slug: "halcyon", mark: "H", tone: "green", industry: "Consulting" }, { name: "Morrow", slug: "morrow", mark: "M", tone: "rose", industry: "Fintech" },
];

const features = [
  { icon: "✦", title: "A profile you control", copy: "Build from your CV, review every extracted detail, and decide exactly what recruitment teams can see." },
  { icon: "⌕", title: "Jobs worth your time", copy: "Search roles by job title, skills, experience and location, with every application in one clear timeline." },
  { icon: "⇄", title: "A more human hiring process", copy: "Know where you stand with clear status updates, thoughtful communication and no disappearing applications." },
];

const articles: PublicKnowledgePost[] = [
  { id: "default-1", slug: "make-your-portfolio-tell-a-stronger-product-story", category: "Career growth", title: "How to make your portfolio tell a stronger product story", excerpt: "A practical structure for showing the decisions, trade-offs and outcomes behind your strongest work.", body: "", readingMinutes: 6, heroTone: "blue", featured: true, status: "PUBLISHED", authorName: "Sapienworx Editorial", publishedAt: "" },
  { id: "default-2", slug: "practical-guide-to-finding-the-right-hybrid-role", category: "Job search", title: "A practical guide to finding the right hybrid role", excerpt: "Questions that reveal whether a company’s hybrid policy will genuinely support your best work.", body: "", readingMinutes: 5, heroTone: "purple", featured: true, status: "PUBLISHED", authorName: "Sapienworx Editorial", publishedAt: "" },
  { id: "default-3", slug: "questions-worth-asking-before-you-accept-an-offer", category: "Work life", title: "Questions worth asking before you accept an offer", excerpt: "A concise guide to understanding expectations, growth, management and the realities behind an offer.", body: "", readingMinutes: 4, heroTone: "sage", featured: true, status: "PUBLISHED", authorName: "Sapienworx Editorial", publishedAt: "" },
];

export function PublicNavigation({ editorial = false }: { editorial?: boolean }) {
  if (editorial) return <header className="public-nav public-nav-editorial"><Logo/><nav aria-label="Public navigation"><Link href="/jobs">Find jobs</Link><Link href="/#how-it-works">For you</Link><Link href="/jobs">Explore roles</Link><Link href="/knowledge">Resources</Link></nav><div className="public-nav-actions"><Link className="recruiter-entry" href="/recruiter/login">For recruiters <span>→</span></Link><Link className="text-action" href="/login">Sign in</Link><Link className="button button-primary" href="/candidate/jobs">Search jobs</Link><details className="public-mobile-menu"><summary aria-label="Open navigation menu"><i/><i/><i/></summary><nav aria-label="Mobile public navigation"><Link href="/candidate/jobs">Search jobs</Link><Link href="/#how-it-works">For you</Link><Link href="/jobs">Explore roles</Link><Link href="/knowledge">Resources</Link><Link href="/login">Sign in</Link><Link className="mobile-recruiter-entry" href="/recruiter/login">For recruiters <span>→</span></Link></nav></details></div></header>;
  return <header className="public-nav"><Logo/><nav aria-label="Public navigation"><Link href="/jobs">Find jobs</Link><Link href="/companies">Companies</Link><Link href="/knowledge">Knowledge hub</Link><Link href="/#features">How it works</Link></nav><div className="public-nav-actions"><Link className="text-action" href="/login">Sign in</Link><Link className="button button-primary" href="/register">Create profile</Link><Link className="recruiter-entry" href="/recruiter/login">For recruiters <span>→</span></Link><details className="public-mobile-menu"><summary aria-label="Open navigation menu"><i/><i/><i/></summary><nav aria-label="Mobile public navigation"><Link href="/login">Sign in</Link><Link href="/jobs">Find jobs</Link><Link href="/companies">Companies</Link><Link href="/knowledge">Knowledge hub</Link><Link href="/#features">How it works</Link><Link className="mobile-recruiter-entry" href="/recruiter/login">For recruiters <span>→</span></Link></nav></details></div></header>;
}

export function JobSearch({ compact = false }: { compact?: boolean }) {
  return <form className={compact ? "job-search job-search-compact" : "job-search"} action="/jobs"><label><span>⌕</span><input name="keywords" placeholder="Job title or keywords" aria-label="Job title or keywords"/></label><label><span>↗</span><input name="experience" placeholder="Experience" aria-label="Experience"/></label><label><span>⌖</span><input name="location" placeholder="Location" aria-label="Location"/></label><button type="submit">Search jobs</button></form>;
}

export function JobCard({ job }: { job: PublicJob }) { const jobPath = job.publicPath ?? (job.id.startsWith("SWX_") ? `/jobs/${encodeURIComponent(job.id)}/${jobTitleSlug(job.title)}` : `/jobs?keywords=${encodeURIComponent(job.title)}`); return <article className="public-job-card"><div className={`public-company-mark mark-${job.tone}`}>{job.mark}</div><div className="public-job-content"><p className="public-job-company">{job.company}{job.verifiedEmployer && <span title="Employer work domain verified">✓ Verified employer</span>}</p><h3>{job.title}</h3><div className="public-job-decision-meta"><span>{displayLocation(job.location, job.workplaceModel)}</span><span>{humanJobLabel(job.workplaceModel)}</span><span>{humanJobLabel(job.employmentType)}</span><span>{postedLabel(job.postedAt)}</span></div><div className="public-tags">{job.tags.map((tag) => <span key={tag}>{tag}</span>)}</div><footer><span>{job.experience}</span><span>{job.department}</span></footer><div className="public-job-actions"><Link className="public-job-view" href={jobPath}>View job <span>→</span></Link><PublicJobSave jobId={job.id} jobTitle={job.title}/></div></div></article>; }

function CompanyCard({ company }: { company: typeof companies[number] }) { const jobCount = publicJobs.filter((job) => job.companySlug === company.slug).length; return <Link className="public-company-card" href={`/companies/${company.slug}`}><span className={`public-company-mark mark-${company.tone}`}>{company.mark}</span><div><strong>{company.name}</strong><small>{company.industry}</small></div><span className="company-count">{jobCount || 1} jobs</span><b>→</b></Link>; }
function SectionHead({ eyebrow, title, copy, href, label }: { eyebrow: string; title: string; copy?: string; href: string; label: string }) { return <header className="public-section-head"><div><span className="eyebrow">{eyebrow}</span><h2>{title}</h2>{copy && <p>{copy}</p>}</div><Link href={href} className="view-all">{label} <span>→</span></Link></header>; }

export function PublicLanding({ jobs = publicJobs, articles: publishedArticles = articles }: { jobs?: PublicJob[]; articles?: PublicKnowledgePost[] }) {
  const featuredArticles = publishedArticles.filter((article) => article.featured).slice(0, 3);
  const visibleArticles = featuredArticles.length ? featuredArticles : publishedArticles.slice(0, 3);
  const visibleJobs = (jobs.length ? jobs : publicJobs).slice(0, 3);

  return <main className="public-page landing-v2">
    <PublicNavigation editorial/>
    <section className="landing-v2-hero">
      <div className="landing-v2-container landing-v2-hero-grid">
        <div className="landing-v2-hero-copy">
          <span className="landing-v2-kicker">Work that moves you forward</span>
          <h1>Find roles that<br/>challenge you.<br/><em>Build what’s next.</em></h1>
          <p>Sapienworx connects ambitious people with verified companies building meaningful work.</p>
          <div className="landing-v2-actions">
            <Link className="landing-v2-button landing-v2-button-primary" href="/candidate/jobs">Search jobs <span>→</span></Link>
            <Link className="landing-v2-button landing-v2-button-secondary" href="/register"><span aria-hidden="true">▤</span> Build my profile from CV</Link>
          </div>
          <p className="landing-v2-promise"><span aria-hidden="true">✓</span> Career-defining roles from verified companies building what’s next.</p>
        </div>
        <div className="landing-v2-role-stack" aria-label="Preview of verified opportunities">
          <i className="landing-v2-paper landing-v2-paper-sage"/><i className="landing-v2-paper landing-v2-paper-navy"/><i className="landing-v2-paper landing-v2-paper-terracotta"/>
          <div className="landing-v2-role-stack-cards">{visibleJobs.map((job) => <LandingRoleCard job={job} key={job.id}/>)}</div>
        </div>
      </div>
    </section>

    <section className="landing-v2-trust" aria-label="Sapienworx principles"><div className="landing-v2-container landing-v2-trust-grid">
      <LandingTrust icon="◇" title="Every company verified" copy="We verify every company and role so you can apply with confidence."/>
      <LandingTrust icon="⌁" title="Human-first matching" copy="Smart matching that values your potential, not just keywords."/>
      <LandingTrust icon="⌑" title="Your data stays protected" copy="Your privacy is our priority. Your data is never sold."/>
      <LandingTrust icon="⌇" title="Built for long-term impact" copy="We connect you with companies creating lasting value."/>
    </div></section>

    <section className="landing-v2-section landing-v2-how" id="how-it-works"><div className="landing-v2-container landing-v2-how-grid">
      <div><span className="landing-v2-kicker">How Sapienworx works</span><h2>Your next role, in three simple steps.</h2></div>
      <ol className="landing-v2-steps"><LandingStep index="1" title="Create your profile" copy="Share your experience and what drives you."/><LandingStep index="2" title="Discover better matches" copy="We surface roles that fit your skills and ambitions."/><LandingStep index="3" title="Connect with purpose" copy="Start conversations with teams building what’s next."/></ol>
      <div className="landing-v2-abstract-art" aria-hidden="true"><i/><b/><span/><em/></div>
    </div></section>

    <section className="landing-v2-section landing-v2-roles"><div className="landing-v2-container">
      <header className="landing-v2-section-head"><div><span className="landing-v2-kicker">Verified opportunities</span><h2>Roles worth your attention.</h2><p>Considered opportunities from teams doing work that matters.</p></div><Link href="/jobs">View all jobs <span>→</span></Link></header>
      <div className="landing-v2-role-grid">{visibleJobs.map((job) => <LandingRoleCard job={job} detailed key={job.id}/>)}</div>
    </div></section>

    <section className="landing-v2-section landing-v2-profile"><div className="landing-v2-container landing-v2-profile-panel">
      <div className="landing-v2-profile-copy"><span className="landing-v2-kicker">A profile on your terms</span><h2>Your profile. Your privacy. Your next opportunity.</h2><p>Share your professional story with confidence. Your contact details stay protected until you choose to connect.</p><ul><li>Only verified companies can view your profile</li><li>You control when and how you are contacted</li><li>A stronger profile brings more relevant matches</li></ul><Link href="/register">Build my profile <span>→</span></Link></div>
      <div className="landing-v2-profile-preview"><div className="landing-v2-avatar">AS</div><div><strong>Alex Stewart</strong><span>Product Designer</span><small>London, UK · Open to new opportunities <b>●</b></small></div><div className="landing-v2-profile-skills"><span>Product design</span><span>Design systems</span><span>Figma</span><span>User research</span></div><footer><span aria-hidden="true">⌑</span><p><strong>Your contact details are protected</strong>Companies will only see your details after you accept a connection.</p></footer></div>
    </div></section>

    <section className="landing-v2-recruiter"><div className="landing-v2-container"><div><span className="landing-v2-kicker">For hiring teams</span><h2>Hiring with purpose?</h2><p>Find and connect with the people who will shape what’s next.</p></div><Link href="/recruiter/login">For recruiters <span>→</span></Link></div></section>

    <section className="landing-v2-section landing-v2-knowledge"><div className="landing-v2-container">
      <header className="landing-v2-section-head"><div><span className="landing-v2-kicker">Knowledge Hub</span><h2>Useful guidance for real career decisions.</h2><p>Practical ideas to help you grow and make confident next moves.</p></div><Link href="/knowledge">Visit all articles <span>→</span></Link></header>
      {visibleArticles.length ? <div className="landing-v2-article-grid">{visibleArticles.map((article, index) => <LandingArticleCard article={article} index={index} key={article.id}/>)}</div> : <p className="landing-v2-empty">Fresh guidance is being prepared by the Sapienworx editorial team.</p>}
    </div></section>

    <section className="landing-v2-final"><div className="landing-v2-container"><div className="landing-v2-final-art" aria-hidden="true"><i/><b/><span/></div><h2>Your next chapter starts here.</h2><p>Join Sapienworx and discover roles that challenge you and build the future.</p><div><Link className="landing-v2-button landing-v2-button-primary" href="/candidate/jobs">Search jobs <span>→</span></Link><Link href="/register">Build my profile from CV <span>→</span></Link></div></div></section>
    <LandingFooter/>
  </main>;
}

function LandingRoleCard({ job, detailed = false }: { job: PublicJob; detailed?: boolean }) {
  const jobPath = job.publicPath ?? (job.id.startsWith("SWX_") ? `/jobs/${encodeURIComponent(job.id)}/${jobTitleSlug(job.title)}` : `/jobs?keywords=${encodeURIComponent(job.title)}`);
  return <article className={`landing-v2-role-card ${detailed ? "landing-v2-role-card-detailed" : ""}`}><header><span className={`public-company-mark mark-${job.tone}`}>{job.mark}</span><div><small>{job.verifiedEmployer ? "● Verified company" : job.company}</small><h3>{job.title}</h3><p>{displayLocation(job.location, job.workplaceModel)} <b>·</b> {job.department}</p></div><span className="landing-v2-bookmark" aria-label={`Save ${job.title}`}>⌑</span></header><div className="landing-v2-role-tags">{job.tags.slice(0, 4).map((tag) => <span key={tag}>{tag}</span>)}</div>{detailed && <><p className="landing-v2-role-summary">A focused opportunity for people ready to build meaningful work with an ambitious team.</p><footer><span>{job.experience}</span><span>{humanJobLabel(job.workplaceModel)}</span><Link href={jobPath}>View role <b>→</b></Link></footer></>}</article>;
}

function LandingTrust({ icon, title, copy }: { icon: string; title: string; copy: string }) { return <article><span>{icon}</span><div><h3>{title}</h3><p>{copy}</p></div></article>; }
function LandingStep({ index, title, copy }: { index: string; title: string; copy: string }) { return <li><span>{index}</span><div><h3>{title}</h3><p>{copy}</p></div></li>; }
function LandingArticleCard({ article, index }: { article: PublicKnowledgePost; index: number }) { return <article className={`landing-v2-article landing-v2-article-${index % 3}`}><div className="landing-v2-article-art" aria-hidden="true"><i/><b/><span/></div><div><span>{article.category}</span><h3>{article.title}</h3><p>{article.excerpt}</p></div><footer><small>{article.readingMinutes} min read</small><Link href={`/knowledge/${article.slug}`}>Read article <b>→</b></Link></footer></article>; }
function LandingFooter() { return <footer className="landing-v2-footer"><div className="landing-v2-container"><div className="landing-v2-footer-brand"><Logo/><p>Meaningful work, made more accessible.</p></div><div className="landing-v2-footer-links"><div><strong>Product</strong><Link href="/jobs">Find jobs</Link><Link href="/#features">How it works</Link><Link href="/knowledge">Career advice</Link></div><div><strong>Candidates</strong><Link href="/register">Create profile</Link><Link href="/candidate/jobs">Search roles</Link><Link href="/login">Sign in</Link></div><div><strong>Recruiters</strong><Link href="/recruiter/login">For recruiters</Link><Link href="/recruiter/register">Post a role</Link><Link href="/recruiter">Recruitment workspace</Link></div><div><strong>Legal</strong><Link href="/privacy">Privacy</Link><Link href="/terms">Terms of use</Link><Link href="/cookies">Cookies</Link></div></div><small>© 2026 Sapienworx. All rights reserved.</small></div></footer>; }

function ArticleCard({ article, detailed = false }: { article: PublicKnowledgePost; detailed?: boolean }) { return <article className={`article-card article-${article.heroTone}`}><div><span>{article.category}</span><h3>{article.title}</h3>{detailed && <p>{article.excerpt}</p>}</div><footer><small>{article.readingMinutes} min read</small><Link href={`/knowledge/${article.slug}`}>Read article <b>→</b></Link></footer></article>; }
function PublicFooter() { return <footer className="public-footer"><Logo light/><p>Clearer careers. More confident hiring.</p><div><Link href="/jobs">Jobs</Link><Link href="/companies">Companies</Link><Link href="/recruiter/login">Recruiter workspace</Link><Link href="/privacy">Privacy</Link><Link href="/terms">Terms</Link><Link href="/cookies">Cookies</Link></div></footer>; }

export function PublicJobsPage({ search, jobs = publicJobs }: { search?: { keywords?: string | string[] }, jobs?: PublicJob[] }) {
  const keyword = Array.isArray(search?.keywords) ? search.keywords[0] : search?.keywords;
  return <main className="public-page public-list-page"><PublicNavigation/><section className="public-page-heading"><div className="public-container"><span className="eyebrow">Job search</span><h1>{keyword ? `Roles matching “${keyword}”` : "Find a role that fits"}</h1><p>Use your job title, keywords, experience or preferred location to narrow the field.</p><JobSearch compact/></div></section><section className="public-section public-jobs-layout"><aside className="public-filters"><strong>Refine your search</strong><FilterGroup title="Workplace" values={["Remote", "Hybrid", "On-site"]}/><FilterGroup title="Experience" values={["Entry level", "Mid level", "Senior", "Leadership"]}/><FilterGroup title="Employment type" values={["Full-time", "Contract", "Permanent"]}/></aside><div><div className="listing-summary"><strong>{jobs.length} jobs available</strong><span>Sorted by relevance</span></div>{jobs.length ? <div className="public-job-grid public-job-grid-list">{jobs.map((job) => <JobCard job={job} key={job.id}/>)}</div> : <section className="public-job-zero editorial-empty-state" aria-live="polite"><span className="public-job-zero-sketch" aria-hidden="true">⌕</span><span className="eyebrow">Search reset</span><h2>We’ve scoured the listings, but this exact role is proving elusive.</h2><p>{keyword ? `Try a broader title than “${keyword}”, remove one filter, or let your profile bring relevant opportunities to you.` : "Try one title or skill at a time, or let your profile bring relevant opportunities to you."}</p><div><a className="button button-primary" href="/jobs">Clear search</a><a className="button button-secondary" href="/register">Build my profile</a></div></section>}</div></section></main>;
}
function FilterGroup({ title, values }: { title: string; values: string[] }) { return <section className="public-filter-group"><strong>{title}</strong>{values.map((value) => <label key={value}><input type="checkbox"/> {value}</label>)}</section>; }

export function CompaniesPage() { return <main className="public-page public-list-page"><PublicNavigation/><section className="public-page-heading"><div className="public-container"><span className="eyebrow">Company directory</span><h1>Meet the teams behind the roles.</h1><p>Explore companies, what they do and the opportunities they are currently hiring for.</p></div></section><section className="public-section"><div className="company-directory-grid">{companies.map((company) => <CompanyCard company={company} key={company.slug}/>)}</div></section></main>; }
export function CompanyJobsPage({ slug, jobs = publicJobs }: { slug: string; jobs?: PublicJob[] }) { const staticCompany = companies.find((item) => item.slug === slug); const roles = jobs.filter((job) => job.companySlug === slug); const fallbackJob = roles[0] ?? jobs[0]; const company = staticCompany ?? { slug, name: fallbackJob?.company ?? slug.replace(/-/g, " "), industry: "Hiring on Sapienworx", mark: fallbackJob?.mark ?? "SW", tone: fallbackJob?.tone ?? "teal" }; const displayedRoles = roles.length ? roles : jobs.filter((job) => job.company === company.name); return <main className="public-page public-list-page"><PublicNavigation/><section className="company-detail-hero"><div className="public-container"><span className={`public-company-mark mark-${company.tone}`}>{company.mark}</span><div><span className="eyebrow">{company.industry}</span><h1>{company.name}</h1><p>Browse the roles this team is currently hiring for through Sapienworx.</p></div></div></section><section className="public-section"><SectionHead eyebrow="Open positions" title={`${displayedRoles.length || 1} roles at ${company.name}`} href="/companies" label="All companies"/><div className="public-job-grid">{(displayedRoles.length ? displayedRoles : jobs.slice(0, 1)).map((job) => <JobCard job={job} key={job.id}/>)}</div></section></main>; }
export function KnowledgePage({ articles: publishedArticles = articles }: { articles?: PublicKnowledgePost[] }) { return <main className="public-page public-list-page"><PublicNavigation/><section className="public-page-heading"><div className="public-container"><span className="eyebrow">Sapienworx knowledge hub</span><h1>Useful guidance for every stage of your career.</h1><p>Practical articles for applications, interviews, professional growth and better work decisions.</p></div></section><section className="public-section"><div className="article-grid article-grid-library">{publishedArticles.map((article) => <ArticleCard article={article} detailed key={article.id}/>)}</div>{!publishedArticles.length && <div className="knowledge-library-empty"><span>✎</span><h2>The next edition is taking shape.</h2><p>Our editorial team is preparing practical guidance for your next career decision.</p></div>}</section><PublicFooter/></main>; }

export function KnowledgeArticlePage({ article }: { article: PublicKnowledgePost }) { const paragraphs = article.body.split(/\n\s*\n/).map((paragraph) => paragraph.trim()).filter(Boolean); return <main className="public-page public-list-page"><PublicNavigation/><article className={`knowledge-article article-hero-${article.heroTone}`}><header><Link href="/knowledge">← Knowledge hub</Link><span>{article.category}</span><h1>{article.title}</h1><p>{article.excerpt}</p><footer><b>{article.authorName}</b><span>{article.readingMinutes} min read</span>{article.publishedAt && <span>{new Date(article.publishedAt).toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" })}</span>}</footer></header><section>{paragraphs.map((paragraph, index) => <p key={`${article.id}-${index}`}>{paragraph}</p>)}</section></article><PublicFooter/></main>; }
export const companySlugs = companies.map((company) => company.slug);

function humanJobLabel(value: string) {
  const labels: Record<string, string> = { FULL_TIME: "Full-time", PART_TIME: "Part-time", CONTRACT: "Contract", INTERNSHIP: "Internship", TEMPORARY: "Temporary", FREELANCE: "Freelance", ON_SITE: "On-site", HYBRID: "Hybrid", REMOTE: "Remote" };
  return labels[value] ?? value.replace(/_/g, " ").toLowerCase().replace(/^./, (letter) => letter.toUpperCase());
}
function displayLocation(location: string, workplaceModel: string) {
  const workplace = humanJobLabel(workplaceModel).toLowerCase();
  const parts = location.split("·").map((part) => part.trim()).filter(Boolean).filter((part) => part.toLowerCase() !== workplace);
  return parts.join(" · ") || location;
}
function postedLabel(publishedAt: string | null) {
  if (!publishedAt) return "Recently posted";
  const elapsedDays = Math.max(0, Math.floor((Date.now() - new Date(publishedAt).getTime()) / 86_400_000));
  if (elapsedDays === 0) return "Posted today";
  if (elapsedDays === 1) return "Posted yesterday";
  return `Posted ${elapsedDays}d ago`;
}
function jobTitleSlug(title: string) { return title.toLowerCase().trim().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, ""); }
