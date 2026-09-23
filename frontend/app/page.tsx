import Image from "next/image";
import Link from "next/link";

import { Container } from "@/components/layout/container";
import { Reveal } from "@/components/motion/reveal";
import { LandingFooter } from "@/components/site/landing-footer";
import { LandingGuideCarousel } from "@/components/site/landing-guide-carousel";
import { LandingHeader } from "@/components/site/landing-header";
import { Button } from "@/components/ui/button";
import { guides } from "@/lib/knowledge-hub";

const photo = (name: string) => `/images/people/${encodeURIComponent(name)}`;

const people = {
  hero: photo("ChatGPT Image Sep 23, 2026, 06_05_55 PM (1).png"),
  discover: photo("ChatGPT Image Sep 23, 2026, 06_05_55 PM (2).png"),
  grow: photo("ChatGPT Image Sep 23, 2026, 06_05_56 PM (3).png"),
  belong: photo("ChatGPT Image Sep 23, 2026, 06_05_56 PM (4).png"),
};

const journey = [
  { title:"Discover", body:"Explore roles at amazing companies that value people like you.", cta:"Explore jobs", href:"/jobs", image:people.discover, alt:"Professional exploring career opportunities on a laptop", icon:"◎" },
  { title:"Grow", body:"Build in-demand skills and take the next step in your career.", cta:"Build new skills", href:"/#knowledge-hub", image:people.grow, alt:"Professional smiling during a career conversation", icon:"▥" },
  { title:"Belong", body:"Join a supportive community that’s invested in your success.", cta:"Be part of something", href:"/signup", image:people.belong, alt:"Professional wearing a headset in a collaborative workplace", icon:"♧" },
];

const popular = [
  ["Software Engineer", "/jobs?q=Software+Engineer"],
  ["Product Manager", "/jobs?q=Product+Manager"],
  ["Data Analyst", "/jobs?q=Data+Analyst"],
  ["Remote", "/jobs?work_mode=remote"],
];

const dashboardRows = [
  ["Product Designer", "Bengaluru · Remote", "New"],
  ["Data Analyst", "Gurugram · Remote", "Popular"],
  ["UX Researcher", "Pune · Hybrid", "New"],
];

export default function HomePage() {
  return (
    <main id="main-content" className="swx-landing min-h-screen overflow-x-clip bg-white">
      <LandingHeader />

      <section className="swx-hero" aria-labelledby="home-title">
        <Container className="relative">
          <div className="swx-hero-grid">
            <Reveal className="swx-hero-copy">
              <p className="swx-eyebrow">Opportunities for a brighter tomorrow</p>
              <h1 id="home-title" className="swx-display swx-hero-title">Find work that feels <em>right for you.</em></h1>
              <p className="swx-lead">Search meaningful opportunities, connect with incredible companies, and move through your career journey with confidence.</p>
            </Reveal>

            <Reveal className="swx-hero-visual" delay={0.06}>
              <div className="hero-orbit swx-hero-orbit" aria-hidden="true" />
              <div className="swx-hero-photo">
                <Image src={people.hero} alt="Smiling professional in a light blue turtleneck and round glasses" fill priority sizes="(max-width: 767px) 94vw, (max-width: 1199px) 52vw, 580px" className="hero-human object-cover object-center" />
              </div>
              <p className="swx-hand swx-hero-note">A more human way<br />to work.</p>
              <div className="swx-opportunity-card">
                <span className="swx-opportunity-icon" aria-hidden="true">☼</span>
                <div><strong>Real opportunities.<br />A brighter you.</strong><p>Find roles, grow your skills, and build the career you want.</p></div>
              </div>
            </Reveal>

            <Reveal className="swx-search-wrap" delay={0.1}>
              <form action="/jobs" role="search" className="swx-search">
                <label><span>Role or skill</span><span className="swx-field"><b aria-hidden="true">⌕</b><input id="home-q" name="q" type="search" autoComplete="off" placeholder="e.g. Software Engineer" /></span></label>
                <label><span>Experience</span><span className="swx-field"><b aria-hidden="true">▣</b><select id="home-experience" name="experience" defaultValue=""><option value="">Any experience</option><option value="0">Fresher / 0 years</option><option value="1">1 year</option><option value="2">2 years</option><option value="3">3 years</option><option value="5">5 years</option><option value="8">8 years</option><option value="10">10+ years</option></select></span></label>
                <label><span>Location</span><span className="swx-field"><b aria-hidden="true">⌖</b><input id="home-location" name="location" autoComplete="address-level2" placeholder="Any location" /></span></label>
                <button type="submit">Search jobs <span aria-hidden="true">→</span></button>
              </form>
              <div className="swx-popular" aria-label="Popular searches"><span>Popular searches:</span>{popular.map(([label, href]) => <Link key={label} href={href}>{label}</Link>)}</div>
            </Reveal>
          </div>
        </Container>
      </section>

      <section id="about" className="swx-section swx-journey" aria-labelledby="journey-title">
        <Container><span id="how-it-works" className="sr-only">How it works</span>
          <Reveal className="swx-section-heading">
            <p className="swx-eyebrow">More than a job board</p>
            <h2 id="journey-title" className="swx-display">A career partner for what’s next.</h2>
            <p>Whether you’re exploring, upskilling, or looking for your next role, SapienWorx is here to support you at every step.</p>
          </Reveal>
          <div className="swx-journey-grid">
            {journey.map((item, index) => (
              <Reveal key={item.title} className="h-full" delay={index * 0.06}>
                <article className="swx-journey-card">
                  <div className="swx-journey-image"><Image src={item.image} alt={item.alt} fill sizes="(max-width: 640px) 31vw, (max-width: 900px) 31vw, 360px" className="object-cover object-center" /></div>
                  <div className="swx-journey-body"><span className="swx-round-icon" aria-hidden="true">{item.icon}</span><h3 className="swx-display">{item.title}</h3><p>{item.body}</p><Link href={item.href}>{item.cta} <span aria-hidden="true">→</span></Link></div>
                </article>
              </Reveal>
            ))}
          </div>
        </Container>
      </section>

      <section id="knowledge-hub" className="swx-section swx-knowledge" aria-labelledby="knowledge-title">
        <Container>
          <Reveal className="swx-knowledge-head">
            <div><p className="swx-eyebrow">Knowledge Hub</p><h2 id="knowledge-title" className="swx-display">Practical advice for a brighter career.</h2><p>Expert insights, actionable tips, and real stories to help you grow with confidence.</p></div>
            <Link href="/#knowledge-hub" className="swx-outline-link">Explore Knowledge Hub <span aria-hidden="true">→</span></Link>
          </Reveal>
          <LandingGuideCarousel guides={guides} />
        </Container>
      </section>

      <section className="swx-section swx-product" aria-labelledby="product-title">
        <Container>
          <div className="swx-product-grid">
            <Reveal className="swx-product-copy">
              <p className="swx-eyebrow">Your journey, simplified</p>
              <h2 id="product-title" className="swx-display">Your career journey,<br />all in one place.</h2>
              <p>Track your applications, save jobs, build new skills, and discover suggested opportunities — everything you need to create the career you want.</p>
              <div className="swx-actions"><Button href="/signup">Create Account <span aria-hidden="true">→</span></Button><Button href="/jobs" variant="secondary">Explore Jobs</Button></div>
            </Reveal>
            <Reveal className="swx-dashboard-wrap" delay={0.06}>
              <div className="swx-dashboard" aria-label="Illustrative candidate workspace with sample data">
                <div className="swx-dashboard-top"><strong><span>S</span> SapienWorx</strong><small>Good morning, Alex 👋</small></div>
                <div className="swx-dashboard-grid">
                  <aside aria-hidden="true"><b>Overview</b><span>My Jobs</span><span>Applications</span><span>Saved</span><span>Learning</span><span>Profile</span></aside>
                  <div className="swx-dashboard-main">
                    <p>Keep going. You’re making great progress.</p>
                    <div className="swx-dashboard-stats">{[["12","Applications"],["5","Saved jobs"],["3","Interviews"],["2","New opportunities"]].map(([n,l])=><div key={l}><b>{n}</b><span>{l}</span></div>)}</div>
                    <h3>Recommended for you</h3>
                    <div className="swx-dashboard-rows">{dashboardRows.map(([role,meta,badge],i)=><div key={role}><span className="swx-avatar" aria-hidden="true">{["◉","◌","●"][i]}</span><p><b>{role}</b><small>{meta}</small></p><em>{badge}</em></div>)}</div>
                  </div>
                </div>
              </div>
              <p className="swx-hand swx-progress-note">Progress<br />looks good<br />on you.</p>
            </Reveal>
          </div>
        </Container>
      </section>

      <section className="swx-cta-section" aria-labelledby="final-title">
        <Container>
          <Reveal>
            <div className="swx-final-cta">
              <div className="swx-cta-copy"><p className="swx-eyebrow">Ready for what’s next?</p><h2 id="final-title" className="swx-display">Your next chapter starts here.</h2><p>A more human, more meaningful future of work is possible — and it starts with you.</p></div>
              <div className="swx-cta-actions"><Button href="/signup" className="swx-white-button">Create Account <span aria-hidden="true">→</span></Button><Button href="/jobs" className="swx-ghost-button">Explore Jobs</Button></div>
              <div className="swx-cta-person" style={{ backgroundImage: `linear-gradient(90deg,rgba(7,29,73,.25),transparent),url("${people.hero}")` }} aria-hidden="true"><span className="swx-hand">Brighter<br />together.</span></div>
            </div>
          </Reveal>
        </Container>
      </section>
      <LandingFooter />
    </main>
  );
}
