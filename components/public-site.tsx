import Link from "next/link";
import { Icon, Logo } from "./ui";
import { PublicJobSave } from "./public-job-save";
import type { PublicKnowledgePost } from "../lib/backend";
import { jobLabel as humanJobLabel, jobLocation as displayLocation } from "../lib/job-display";

export type PublicJob = { id: string; company: string; companySlug: string; title: string; tags: string[]; experience: string; location: string; department: string; employmentType: string; workplaceModel: string; postedAt: string | null; verifiedEmployer: boolean; publicPath?: string; mark: string; tone: string };
type PublicPageMeta = { totalElements: number; totalPages: number; number: number };
type PublicSearch = Record<string, string | string[] | undefined>;

/** Demo-only fixtures. Production pages never silently fall back to these records. */
export const publicJobs: PublicJob[] = [
  { id: "SWX_NX_001", company: "Nexora Cloud", companySlug: "nexora-cloud", title: "Senior Backend Engineer", tags: ["TypeScript", "Node.js", "PostgreSQL"], experience: "4–7 years", location: "Bengaluru · Hybrid", department: "Engineering", employmentType: "FULL_TIME", workplaceModel: "HYBRID", postedAt: "2026-08-21T09:00:00Z", verifiedEmployer: true, publicPath: "/jobs/SWX_NX_001/senior-backend-engineer", mark: "N", tone: "navy" },
  { id: "SWX_DM_002", company: "Dharma Mobility", companySlug: "dharma-mobility", title: "Frontend Engineer", tags: ["React", "TypeScript", "Next.js"], experience: "3–5 years", location: "Pune · Hybrid", department: "Engineering", employmentType: "FULL_TIME", workplaceModel: "HYBRID", postedAt: "2026-08-28T09:00:00Z", verifiedEmployer: true, mark: "D", tone: "blue" },
  { id: "SWX_AV_003", company: "Aavishkar Health", companySlug: "aavishkar-health", title: "Product Designer", tags: ["Figma", "Design systems", "Research"], experience: "4–6 years", location: "Mumbai · Remote", department: "Design", employmentType: "FULL_TIME", workplaceModel: "REMOTE", postedAt: "2026-08-27T09:00:00Z", verifiedEmployer: true, mark: "A", tone: "purple" },
];

const demoArticles: PublicKnowledgePost[] = [
  { id: "default-1", slug: "make-your-portfolio-tell-a-stronger-product-story", category: "Career growth", title: "How to make your portfolio tell a stronger product story", excerpt: "A practical structure for showing the decisions, trade-offs and outcomes behind your strongest work.", body: "", readingMinutes: 6, heroTone: "blue", featured: true, status: "PUBLISHED", authorName: "Sapienworx Editorial", publishedAt: "" },
  { id: "default-2", slug: "practical-guide-to-finding-the-right-hybrid-role", category: "Job search", title: "A practical guide to finding the right hybrid role", excerpt: "Questions that reveal whether a company’s hybrid policy will genuinely support your best work.", body: "", readingMinutes: 5, heroTone: "purple", featured: true, status: "PUBLISHED", authorName: "Sapienworx Editorial", publishedAt: "" },
];

const first = (value: string | string[] | undefined) => Array.isArray(value) ? value[0] : value;
const localDemo = process.env.NEXT_PUBLIC_LOCAL_DEMO === "true";

export function PublicNavigation({ editorial = false }: { editorial?: boolean }) {
  return <header className={`public-nav${editorial ? " public-nav-editorial" : ""}`}>
    <Logo/>
    <nav aria-label="Public navigation"><Link href="/jobs">Find Jobs</Link><Link href="/companies">Companies</Link><Link href="/knowledge">Career Resources</Link></nav>
    <div className="public-nav-actions"><Link className="recruiter-entry" href="/recruiters">For Recruiters</Link><Link className="text-action" href="/login">Sign In</Link><Link className="button button-primary" href="/register">Create Profile</Link><details className="public-mobile-menu"><summary aria-label="Open navigation menu"><i/><i/><i/></summary><nav aria-label="Mobile public navigation"><Link href="/jobs">Find Jobs</Link><Link href="/companies">Companies</Link><Link href="/knowledge">Career Resources</Link><Link href="/register">Create Profile</Link><Link href="/recruiters">For Recruiters</Link><Link href="/login">Sign In</Link></nav></details></div>
  </header>;
}

export function JobSearch({ compact = false, search }: { compact?: boolean; search?: PublicSearch }) {
  return <form className={compact ? "job-search job-search-compact" : "job-search"} action="/jobs">
    <label><Icon name="search" size={18}/><input name="keywords" defaultValue={first(search?.keywords) ?? ""} placeholder="Role, skill or company" aria-label="Role, skill or company"/></label>
    <label><Icon name="profile" size={18}/><input name="location" defaultValue={first(search?.location) ?? ""} placeholder="Location" aria-label="Location"/></label>
    <label><Icon name="briefcase" size={18}/><input name="minimumExperienceYears" defaultValue={first(search?.minimumExperienceYears) ?? ""} inputMode="numeric" placeholder="Experience (years)" aria-label="Minimum experience years"/></label>
    <button type="submit">Search Jobs</button>
  </form>;
}

export function JobCard({ job }: { job: PublicJob }) {
  const jobPath = job.publicPath ?? `/jobs/${encodeURIComponent(job.id)}/${jobTitleSlug(job.title)}`;
  return <article className="public-job-card"><div className={`public-company-mark mark-${job.tone}`}>{job.mark}</div><div className="public-job-content"><p className="public-job-company">{job.company}{job.verifiedEmployer && <span title="Employer work domain verified">✓ Verified employer</span>}</p><h3>{job.title}</h3><div className="public-job-decision-meta"><span>{displayLocation(job.location, job.workplaceModel)}</span><span>{humanJobLabel(job.workplaceModel)}</span><span>{humanJobLabel(job.employmentType)}</span><span>{postedLabel(job.postedAt)}</span></div><div className="public-tags">{job.tags.slice(0, 5).map((tag) => <span key={tag}>{tag}</span>)}</div><footer><span>{job.experience}</span><span>{job.department}</span></footer><div className="public-job-actions"><Link className="public-job-view" href={jobPath}>View job <span>→</span></Link><PublicJobSave jobId={job.id} jobTitle={job.title}/></div></div></article>;
}

export function PublicLanding({ jobs, articles }: { jobs?: PublicJob[]; articles?: PublicKnowledgePost[] }) {
  const sourceJobs = jobs ?? (localDemo ? publicJobs : []);
  const sourceArticles = articles ?? (localDemo ? demoArticles : []);
  const visibleJobs = sourceJobs.slice(0, 3);
  const featured = sourceArticles.filter((article) => article.featured).slice(0, 3);
  const visibleArticles = featured.length ? featured : sourceArticles.slice(0, 3);

  return <main className="public-page landing-v2">
    <PublicNavigation editorial/>
    <section className="landing-v2-hero"><div className="landing-v2-container landing-v2-hero-grid"><div className="landing-v2-hero-copy"><span className="landing-v2-kicker">Your next move, with clarity</span><h1>Find the right role.<br/><em>Know where you stand.</em></h1><p>Search verified jobs, create one reusable profile, apply faster, and follow every application from submission to interview and offer.</p><JobSearch/><div className="landing-v2-actions"><Link className="landing-v2-button landing-v2-button-secondary" href="/register">Create my profile</Link></div><p className="landing-v2-promise"><span aria-hidden="true">✓</span> Your profile and contact preferences stay under your control.</p></div><div className="landing-v2-role-stack" aria-label="Available verified opportunities">{visibleJobs.length ? <div className="landing-v2-role-stack-cards">{visibleJobs.map((job) => <LandingRoleCard job={job} key={job.id}/>)}</div> : <div className="landing-v2-empty"><strong>Verified roles will appear here.</strong><p>Use the search to explore current opportunities.</p></div>}</div></div></section>

    <section className="landing-v2-trust" aria-label="Sapienworx principles"><div className="landing-v2-container landing-v2-trust-grid"><LandingTrust title="Verified employers" copy="Employer work domains are verified before candidate-facing trust signals appear."/><LandingTrust title="Clear job requirements" copy="Search and compatibility use explicit skills, experience and job criteria rather than hidden model decisions."/><LandingTrust title="Privacy controls" copy="Control profile visibility, contact preferences and your personal information."/><LandingTrust title="Application visibility" copy="Follow recruitment progress without guessing where your application stands."/></div></section>

    <section className="landing-v2-section landing-v2-how" id="how-it-works"><div className="landing-v2-container landing-v2-how-grid"><div><span className="landing-v2-kicker">How Sapienworx works</span><h2>A clearer job search in three steps.</h2></div><ol className="landing-v2-steps"><LandingStep index="1" title="Create your profile" copy="Build once, review the details and choose what recruiters can see."/><LandingStep index="2" title="Find relevant roles" copy="Search with transparent job criteria such as skills, location and experience."/><LandingStep index="3" title="Track every step" copy="See applications, interviews, messages and offers in one place."/></ol></div></section>

    <section className="landing-v2-section landing-v2-roles"><div className="landing-v2-container"><header className="landing-v2-section-head"><div><span className="landing-v2-kicker">Verified opportunities</span><h2>Roles worth your attention.</h2><p>Current opportunities from hiring teams using Sapienworx.</p></div><Link href="/jobs">View all jobs <span>→</span></Link></header>{visibleJobs.length ? <div className="landing-v2-role-grid">{visibleJobs.map((job) => <LandingRoleCard job={job} detailed key={job.id}/>)}</div> : <div className="editorial-empty-state"><h3>No published roles right now.</h3><p>Search again later or create a profile so you are ready when new roles are published.</p><Link className="button button-primary" href="/register">Create profile</Link></div>}</div></section>

    <section className="landing-v2-recruiter"><div className="landing-v2-container"><div><span className="landing-v2-kicker">For hiring teams</span><h2>One workspace from open role to successful hire.</h2><p>Source, review, communicate, schedule interviews and move candidates through a clear recruitment workflow.</p></div><Link href="/recruiters">Explore Sapienworx for recruiters <span>→</span></Link></div></section>

    <section className="landing-v2-section landing-v2-knowledge"><div className="landing-v2-container"><header className="landing-v2-section-head"><div><span className="landing-v2-kicker">Career resources</span><h2>Useful guidance for real career decisions.</h2></div><Link href="/knowledge">Visit all articles <span>→</span></Link></header>{visibleArticles.length ? <div className="landing-v2-article-grid">{visibleArticles.map((article, index) => <LandingArticleCard article={article} index={index} key={article.id}/>)}</div> : <p className="landing-v2-empty">Fresh guidance is being prepared by the Sapienworx editorial team.</p>}</div></section>
    <LandingFooter/>
  </main>;
}

function LandingRoleCard({ job, detailed = false }: { job: PublicJob; detailed?: boolean }) {
  const jobPath = job.publicPath ?? `/jobs/${encodeURIComponent(job.id)}/${jobTitleSlug(job.title)}`;
  return <article className={`landing-v2-role-card ${detailed ? "landing-v2-role-card-detailed" : ""}`}><header><span className={`public-company-mark mark-${job.tone}`}>{job.mark}</span><div><small>{job.verifiedEmployer ? "Verified employer" : job.company}</small><h3>{job.title}</h3><p>{displayLocation(job.location, job.workplaceModel)} <b>·</b> {job.department}</p></div></header><div className="landing-v2-role-tags">{job.tags.slice(0, 4).map((tag) => <span key={tag}>{tag}</span>)}</div>{detailed && <footer><span>{job.experience}</span><span>{humanJobLabel(job.workplaceModel)}</span><Link href={jobPath}>View role <b>→</b></Link></footer>}</article>;
}

function LandingTrust({ title, copy }: { title: string; copy: string }) { return <article><span aria-hidden="true">✓</span><div><h3>{title}</h3><p>{copy}</p></div></article>; }
function LandingStep({ index, title, copy }: { index: string; title: string; copy: string }) { return <li><span>{index}</span><div><h3>{title}</h3><p>{copy}</p></div></li>; }
function LandingArticleCard({ article, index }: { article: PublicKnowledgePost; index: number }) { return <article className={`landing-v2-article landing-v2-article-${index % 3}`}><div><span>{article.category}</span><h3>{article.title}</h3><p>{article.excerpt}</p></div><footer><small>{article.readingMinutes} min read</small><Link href={`/knowledge/${article.slug}`}>Read article <b>→</b></Link></footer></article>; }
function LandingFooter() { return <footer className="landing-v2-footer"><div className="landing-v2-container"><div className="landing-v2-footer-brand"><Logo/><p>Work and talent, connected better.</p></div><div className="landing-v2-footer-links"><div><strong>Candidates</strong><Link href="/jobs">Find jobs</Link><Link href="/register">Create profile</Link><Link href="/login">Sign in</Link></div><div><strong>Recruiters</strong><Link href="/recruiters">Recruiter product</Link><Link href="/recruiter/register">Create recruiter account</Link><Link href="/recruiter/login">Sign in</Link></div><div><strong>Resources</strong><Link href="/companies">Companies</Link><Link href="/knowledge">Career resources</Link></div><div><strong>Legal</strong><Link href="/privacy">Privacy</Link><Link href="/terms">Terms of use</Link><Link href="/cookies">Cookies</Link></div></div><small>© 2026 Sapienworx. All rights reserved.</small></div></footer>; }

function pageHref(search: PublicSearch | undefined, page: number) {
  const params = new URLSearchParams();
  Object.entries(search ?? {}).forEach(([key, raw]) => { const value = first(raw); if (value && key !== "page") params.set(key, value); });
  if (page > 0) params.set("page", String(page));
  return `/jobs${params.size ? `?${params.toString()}` : ""}`;
}

export function PublicJobsPage({ search, jobs = [], page }: { search?: PublicSearch; jobs?: PublicJob[]; page?: PublicPageMeta }) {
  const keyword = first(search?.keywords);
  const total = page?.totalElements ?? jobs.length;
  return <main className="public-page public-list-page"><PublicNavigation/><section className="public-page-heading"><div className="public-container"><span className="eyebrow">Job search</span><h1>{keyword ? `Roles matching “${keyword}”` : "Find a role that fits"}</h1><p>Search current published roles using criteria that are applied on the server.</p><JobSearch compact search={search}/></div></section><section className="public-section public-jobs-layout"><aside className="public-filters"><form action="/jobs"><strong>Refine your search</strong><input type="hidden" name="keywords" value={keyword ?? ""}/><FilterSelect label="Workplace" name="workplaceModel" value={first(search?.workplaceModel)} options={[["","Any workplace"],["REMOTE","Remote"],["HYBRID","Hybrid"],["ON_SITE","On-site"]]}/><FilterSelect label="Employment type" name="employmentType" value={first(search?.employmentType)} options={[["","Any employment type"],["FULL_TIME","Full-time"],["PART_TIME","Part-time"],["CONTRACT","Contract"],["INTERNSHIP","Internship"],["TEMPORARY","Temporary"],["FREELANCE","Freelance"]]}/><label className="public-filter-field"><span>Location</span><input name="location" defaultValue={first(search?.location) ?? ""} placeholder="Mumbai, Pune, Remote"/></label><div className="public-filter-range"><label><span>Min experience</span><input name="minimumExperienceYears" inputMode="numeric" defaultValue={first(search?.minimumExperienceYears) ?? ""}/></label><label><span>Max experience</span><input name="maximumExperienceYears" inputMode="numeric" defaultValue={first(search?.maximumExperienceYears) ?? ""}/></label></div><div className="public-filter-range"><label><span>Min salary (LPA)</span><input name="minimumSalaryLakhs" inputMode="numeric" defaultValue={first(search?.minimumSalaryLakhs) ?? ""}/></label><label><span>Max salary (LPA)</span><input name="maximumSalaryLakhs" inputMode="numeric" defaultValue={first(search?.maximumSalaryLakhs) ?? ""}/></label></div><button className="button button-primary" type="submit">Apply filters</button><Link className="button button-secondary" href="/jobs">Clear</Link></form></aside><div><div className="listing-summary"><strong>{total} {total === 1 ? "job" : "jobs"} available</strong><span>Newest published first</span></div>{jobs.length ? <div className="public-job-grid public-job-grid-list">{jobs.map((job) => <JobCard job={job} key={job.id}/>)}</div> : <section className="public-job-zero editorial-empty-state" aria-live="polite"><span className="eyebrow">No exact results</span><h2>No published jobs match these filters.</h2><p>Broaden a skill, location, experience or salary filter and try again.</p><div><Link className="button button-primary" href="/jobs">Clear search</Link><Link className="button button-secondary" href="/register">Create profile</Link></div></section>}{page && page.totalPages > 1 && <nav className="public-pagination" aria-label="Job result pages"><Link aria-disabled={page.number === 0} className={page.number === 0 ? "disabled" : ""} href={pageHref(search, Math.max(0, page.number - 1))}>Previous</Link><span>Page {page.number + 1} of {page.totalPages}</span><Link aria-disabled={page.number + 1 >= page.totalPages} className={page.number + 1 >= page.totalPages ? "disabled" : ""} href={pageHref(search, Math.min(page.totalPages - 1, page.number + 1))}>Next</Link></nav>}</div></section></main>;
}

function FilterSelect({ label, name, value, options }: { label: string; name: string; value?: string; options: Array<[string,string]> }) { return <label className="public-filter-field"><span>{label}</span><select name={name} defaultValue={value ?? ""}>{options.map(([id, text]) => <option value={id} key={id}>{text}</option>)}</select></label>; }

function companyRecords(jobs: PublicJob[]) {
  const map = new Map<string, { name: string; slug: string; mark: string; tone: string; industry: string; count: number }>();
  jobs.forEach((job) => { const existing = map.get(job.companySlug); if (existing) existing.count += 1; else map.set(job.companySlug, { name: job.company, slug: job.companySlug, mark: job.mark, tone: job.tone, industry: job.department || "Hiring on Sapienworx", count: 1 }); });
  return [...map.values()].sort((a,b) => a.name.localeCompare(b.name));
}

export function CompaniesPage({ jobs }: { jobs?: PublicJob[] }) {
  const source = jobs ?? (localDemo ? publicJobs : []);
  const companies = companyRecords(source);
  return <main className="public-page public-list-page"><PublicNavigation/><section className="public-page-heading"><div className="public-container"><span className="eyebrow">Company directory</span><h1>Meet the teams behind the roles.</h1><p>Companies shown here are derived from current published jobs rather than invented production records.</p></div></section><section className="public-section">{companies.length ? <div className="company-directory-grid">{companies.map((company) => <Link className="public-company-card" href={`/companies/${company.slug}`} key={company.slug}><span className={`public-company-mark mark-${company.tone}`}>{company.mark}</span><div><strong>{company.name}</strong><small>{company.industry}</small></div><span className="company-count">{company.count} {company.count === 1 ? "job" : "jobs"}</span><b>→</b></Link>)}</div> : <div className="editorial-empty-state"><h2>No companies with published roles right now.</h2><p>Companies will appear here as they publish active opportunities.</p><Link className="button button-primary" href="/jobs">Browse jobs</Link></div>}</section></main>;
}

export function CompanyJobsPage({ slug, jobs = [] }: { slug: string; jobs?: PublicJob[] }) {
  const roles = jobs.filter((job) => job.companySlug === slug);
  const companyName = roles[0]?.company ?? slug.replace(/-/g, " ").replace(/\b\w/g, (letter) => letter.toUpperCase());
  const mark = roles[0]?.mark ?? companyName.slice(0,1).toUpperCase();
  const tone = roles[0]?.tone ?? "teal";
  return <main className="public-page public-list-page"><PublicNavigation/><section className="company-detail-hero"><div className="public-container"><span className={`public-company-mark mark-${tone}`}>{mark}</span><div><span className="eyebrow">Company jobs</span><h1>{companyName}</h1><p>Current published roles for this company on Sapienworx.</p></div></div></section><section className="public-section"><header className="public-section-head"><div><span className="eyebrow">Open positions</span><h2>{roles.length} {roles.length === 1 ? "role" : "roles"}</h2></div><Link href="/companies" className="view-all">All companies →</Link></header>{roles.length ? <div className="public-job-grid">{roles.map((job) => <JobCard job={job} key={job.id}/>)}</div> : <div className="editorial-empty-state"><h2>No published roles for this company.</h2><p>The company may not be hiring through Sapienworx right now.</p><Link className="button button-secondary" href="/jobs">Explore all jobs</Link></div>}</section></main>;
}

function ArticleCard({ article }: { article: PublicKnowledgePost }) { return <article className={`article-card article-${article.heroTone}`}><div><span>{article.category}</span><h3>{article.title}</h3><p>{article.excerpt}</p></div><footer><small>{article.readingMinutes} min read</small><Link href={`/knowledge/${article.slug}`}>Read article <b>→</b></Link></footer></article>; }
export function KnowledgePage({ articles }: { articles?: PublicKnowledgePost[] }) { const source = articles ?? (localDemo ? demoArticles : []); return <main className="public-page public-list-page"><PublicNavigation/><section className="public-page-heading"><div className="public-container"><span className="eyebrow">Sapienworx career resources</span><h1>Useful guidance for every stage of your career.</h1><p>Practical articles for applications, interviews, professional growth and work decisions.</p></div></section><section className="public-section">{source.length ? <div className="article-grid article-grid-library">{source.map((article) => <ArticleCard article={article} key={article.id}/>)}</div> : <div className="knowledge-library-empty"><h2>The next edition is taking shape.</h2><p>Our editorial team is preparing practical guidance for your next career decision.</p></div>}</section><PublicFooter/></main>; }
export function KnowledgeArticlePage({ article }: { article: PublicKnowledgePost }) { const paragraphs = article.body.split(/\n\s*\n/).map((paragraph) => paragraph.trim()).filter(Boolean); return <main className="public-page public-list-page"><PublicNavigation/><article className={`knowledge-article article-hero-${article.heroTone}`}><header><Link href="/knowledge">← Career resources</Link><span>{article.category}</span><h1>{article.title}</h1><p>{article.excerpt}</p><footer><b>{article.authorName}</b><span>{article.readingMinutes} min read</span>{article.publishedAt && <span>{new Date(article.publishedAt).toLocaleDateString("en-IN", { day: "numeric", month: "long", year: "numeric" })}</span>}</footer></header><section>{paragraphs.map((paragraph, index) => <p key={`${article.id}-${index}`}>{paragraph}</p>)}</section></article><PublicFooter/></main>; }
function PublicFooter() { return <footer className="public-footer"><Logo light/><p>Work and talent, connected better.</p><div><Link href="/jobs">Jobs</Link><Link href="/companies">Companies</Link><Link href="/recruiters">Recruiters</Link><Link href="/privacy">Privacy</Link><Link href="/terms">Terms</Link><Link href="/cookies">Cookies</Link></div></footer>; }

/** Demo routes only. Production company discovery is derived from live published jobs. */
export const companySlugs = localDemo ? [...new Set(publicJobs.map((job) => job.companySlug))] : [];

function postedLabel(publishedAt: string | null) { if (!publishedAt) return "Recently posted"; const elapsedDays = Math.max(0, Math.floor((Date.now() - new Date(publishedAt).getTime()) / 86_400_000)); if (elapsedDays === 0) return "Posted today"; if (elapsedDays === 1) return "Posted yesterday"; return `Posted ${elapsedDays}d ago`; }
function jobTitleSlug(title: string) { return title.toLowerCase().trim().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, ""); }
