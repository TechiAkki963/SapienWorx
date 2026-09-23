import Image from "next/image";
import Link from "next/link";

import { PublicHeader } from "@/components/site/public-header";
import { PublicFooter } from "@/components/site/public-footer";
import { KnowledgeCards } from "@/components/site/knowledge-cards";
import { guides } from "@/lib/knowledge-hub";

const image = (filename: string) => `/images/people/${encodeURIComponent(filename)}`;

const portraits = {
  hero: image("ChatGPT Image Sep 23, 2026, 06_05_55 PM (1).png"),
  discover: image("ChatGPT Image Sep 23, 2026, 06_05_55 PM (2).png"),
  grow: image("ChatGPT Image Sep 23, 2026, 06_05_56 PM (3).png"),
  belong: image("ChatGPT Image Sep 23, 2026, 06_05_56 PM (4).png"),
};

const features = [
  { title: "Discover", body: "Find roles that match your skills, goals and values.", action: "Explore jobs", href: "/jobs", image: portraits.discover, alt: "Woman exploring career opportunities on her laptop", symbol: "◎" },
  { title: "Grow", body: "Access resources, insights and a community that helps you move forward.", action: "Build new skills", href: "/#knowledge-hub", image: portraits.grow, alt: "Professional smiling as he plans his next career move", symbol: "▥" },
  { title: "Belong", body: "Join a more human professional network built around people, not profiles.", action: "Be part of something", href: "/signup", image: portraits.belong, alt: "Professional wearing a headset while connecting with people", symbol: "♡" },
];

const terms = [
  { label: "Software Engineer", href: "/jobs?q=Software+Engineer" },
  { label: "Product Manager", href: "/jobs?q=Product+Manager" },
  { label: "Data Analyst", href: "/jobs?q=Data+Analyst" },
  { label: "Remote", href: "/jobs?work_mode=remote" },
];

function JobSearch() {
  return (
    <div className="swx-search-block">
      <form action="/jobs" role="search" className="swx-search-form">
        <label htmlFor="home-q" className="swx-search-field swx-search-role">
          <span className="swx-field-title"><span aria-hidden="true">⌕ </span>Role or skill</span>
          <input name="q" id="home-q" type="search" placeholder="e.g. Software Engineer" autoComplete="off" />
        </label>
        <label htmlFor="home-experience" className="swx-search-field">
          <span className="swx-field-title"><span aria-hidden="true">▣ </span>Experience</span>
          <select name="experience" id="home-experience" defaultValue="">
            <option value="">Any experience</option>
            <option value="0">Fresher / 0 years</option>
            <option value="1">1 year</option>
            <option value="2">2 years</option>
            <option value="3">3 years</option>
            <option value="5">5 years</option>
            <option value="8">8 years</option>
            <option value="10">10+ years</option>
          </select>
        </label>
        <label htmlFor="home-location" className="swx-search-field">
          <span className="swx-field-title"><span aria-hidden="true">⌖ </span>Location</span>
          <input name="location" id="home-location" placeholder="City, country or remote" autoComplete="address-level2" />
        </label>
        <button type="submit" className="swx-search-submit">Search jobs <span aria-hidden="true">→</span></button>
      </form>
      <div className="swx-popular"><span>Popular searches:</span>{terms.map((term) => <Link href={term.href} key={term.label}>{term.label}</Link>)}</div>
    </div>
  );
}

function HeroPhoto() {
  return (
    <div className="swx-hero-photo">
      <div className="hero-orbit swx-hero-orbit" aria-hidden="true" />
      <div className="swx-photo-frame">
        <Image src={portraits.hero} alt="Smiling professional with round glasses and a light blue sweater" className="hero-human" priority fill sizes="(max-width: 699px) 95vw, (max-width: 1100px) 55vw, 45vw" />
      </div>
      <div className="swx-hero-note swx-handwriting" aria-hidden="true">A more<br />human way<br />to work.<span className="swx-underline" /></div>
      <div className="swx-hero-promise">
        <span className="swx-promise-icon" aria-hidden="true">☀</span>
        <span><strong>Real opportunities.<br />A brighter you.</strong><small>Find roles, grow your skills, and build the career you want.</small></span>
      </div>
    </div>
  );
}

function DashboardPreview() {
  return (
    <div className="swx-dashboard" aria-label="Illustrative preview of a candidate dashboard. Example values, not real user data">
      <div className="swx-dashboard-top">
        <span className="swx-dashboard-logo"><span aria-hidden="true">S</span> SapienWorx</span>
        <span className="swx-dashboard-top-tools" aria-hidden="true">⌕ &nbsp; ☰ &nbsp; ◉</span>
      </div>
      <div className="swx-dashboard-body">
        <aside className="swx-dashboard-sidebar" aria-hidden="true">
          <span className="selected">⌂ &nbsp; Overview</span><span>⌕ &nbsp; My Jobs</span><span>▤ &nbsp; Applications</span><span>♡ &nbsp; Saved Jobs</span><span>✧ &nbsp; Learning</span><span>♙ &nbsp; Profile</span>
        </aside>
        <div className="swx-dashboard-main">
          <h3>Good morning, Alex 👋</h3>
          <p>Keep going. You’re making great progress.</p>
          <div className="swx-dashboard-stats">
            {[["12","Applications"],["5","Saved jobs"],["3","Interviews"],["2","New opportunities"]].map(([value,label]) => (
              <div key={label}><strong>{value}</strong><span>{label}</span></div>
            ))}
          </div>
          <div className="swx-dashboard-jobs"><strong>Recommended for you</strong>
            {[["Product Designer","Acme · Remote","New"],["UX Designer","Northstar · Hybrid","Featured"],["Data Analyst","BrightHire · Remote","Explore"]].map(([title,details,tag])=>(
              <div className="swx-dashboard-job" key={title}><span className="swx-job-avatar">♙</span><span className="swx-dashboard-job-text"><b>{title}</b><small>{details}</small></span><span className="swx-job-tag">{tag}</span></div>
            ))}
          </div>
        </div>
      </div>
      <span className="swx-dashboard-caption">Illustrative product preview · not live account data</span>
    </div>
  );
}

export default function HomePage() {
  return (
    <main id="main-content" className="swx-landing">
      <div className="swx-page-shell">
        <PublicHeader />
        <section className="swx-hero" aria-labelledby="home-title">
          <div className="swx-wrap swx-hero-layout">
            <div className="swx-hero-copy">
              <p className="swx-eyebrow">Opportunities for a brighter tomorrow</p>
              <h1 id="home-title">Find work that feels <em>right for you.</em></h1>
              <p className="swx-hero-description">Search meaningful opportunities, connect with incredible companies, and move through your career journey with confidence.</p>
            </div>
            <HeroPhoto />
            <JobSearch />
          </div>
        </section>

        <section className="swx-journey swx-section" id="how-it-works" aria-labelledby="swx-journey-title">
          <div className="swx-wrap">
            <div className="swx-section-heading swx-journey-heading">
              <h2 id="swx-journey-title">A career partner for what’s next.</h2>
              <p>Whether you’re exploring, upskilling, or looking for your next role, SapienWorx is here to support you at every step.</p>
            </div>
            <div className="swx-feature-grid">
              {features.map((feature) => (
                <article className="swx-feature-card" key={feature.title}>
                  <div className="swx-feature-image"><Image src={feature.image} alt={feature.alt} fill sizes="(max-width: 699px) 31vw, (max-width: 1100px) 30vw, 29vw" /></div>
                  <div className="swx-feature-body">
                    <span className="swx-feature-icon" aria-hidden="true">{feature.symbol}</span>
                    <h3>{feature.title}</h3><p>{feature.body}</p>
                    <Link href={feature.href}>{feature.action} <span aria-hidden="true">→</span></Link>
                  </div>
                </article>
              ))}
            </div>
          </div>
        </section>

        <section className="swx-knowledge swx-section" id="knowledge-hub" aria-labelledby="swx-knowledge-title">
          <div className="swx-wrap">
            <div className="swx-knowledge-header">
              <div className="swx-section-heading"><p className="swx-eyebrow">Knowledge Hub</p><h2 id="swx-knowledge-title">Practical advice for a brighter career.</h2><p>Expert insights, actionable tips, and real stories to help you grow with confidence.</p></div>
              <Link href="/resources/build-a-resume" className="swx-pill swx-pill-outline">Explore Knowledge Hub <span aria-hidden="true">→</span></Link>
            </div>
            <KnowledgeCards guides={guides} />
          </div>
        </section>

        <section className="swx-product swx-section" id="about" aria-labelledby="swx-product-title">
          <div className="swx-wrap swx-product-layout">
            <div className="swx-product-copy">
              <p className="swx-eyebrow">Your journey, simplified</p>
              <h2 id="swx-product-title">Your career journey, all in one place.</h2>
              <p>Track your applications, save jobs, build new skills, and get personalized recommendations — everything you need to create the career you want.</p>
              <div className="swx-button-row"><Link href="/signup" className="swx-pill swx-pill-primary">Create Account <span aria-hidden="true">→</span></Link><Link href="/jobs" className="swx-pill swx-pill-outline">Explore Jobs</Link></div>
            </div>
            <div className="swx-product-art">
              <DashboardPreview />
              <span className="swx-product-note swx-handwriting" aria-hidden="true">Progress<br />looks good<br />on you.<span className="swx-underline" /></span>
            </div>
          </div>
        </section>

        <section className="swx-cta-section" aria-labelledby="swx-final-title">
          <div className="swx-wrap">
            <div className="swx-cta">
              <div className="swx-cta-copy"><p className="swx-eyebrow">Ready for what’s next?</p><h2 id="swx-final-title">Your next chapter starts here.</h2><p>A more human, more meaningful future of work is possible — and it starts with you.</p></div>
              <div className="swx-button-row"><Link href="/signup" className="swx-pill swx-pill-white">Create Account <span aria-hidden="true">→</span></Link><Link href="/jobs" className="swx-pill swx-pill-on-dark">Explore Jobs</Link></div>
              <div className="swx-cta-portrait" aria-hidden="true"><Image src={portraits.hero} alt="" fill sizes="(max-width: 699px) 45vw, 20vw" /></div>
            </div>
          </div>
        </section>
        <PublicFooter />
      </div>
    </main>
  );
}
