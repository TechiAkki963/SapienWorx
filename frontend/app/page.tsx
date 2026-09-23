import Image from "next/image";
import Link from "next/link";

import { Container } from "@/components/layout/container";
import { KnowledgeCard } from "@/components/site/knowledge-card";
import { CareerPreview } from "@/components/site/career-preview";
import { HumanJourneyCard } from "@/components/site/human-journey-card";
import { HumanAnnotation } from "@/components/site/human-annotation";
import { PublicFooter } from "@/components/site/public-footer";
import { PublicHeader } from "@/components/site/public-header";
import { Button } from "@/components/ui/button";
import { publicAPI } from "@/lib/candidate-server";
import type { KnowledgeList } from "@/lib/knowledge";

const images = {
  hero: "/images/people/sapien-hero-candidate.webp",
  discover: "/images/people/sapien-recruiter.webp",
  grow: "/images/people/candidate-dashboard.webp",
  belong: "/images/people/recruiter-team.webp",
};

const journey = [
  {
    title: "Discover", eyebrow: "Find your fit",
    body: "Find roles that match your skills, goals and values.",
    image: images.discover, alt: "Professional exploring career opportunities",
    href: "/jobs", action: "Explore jobs", tone: "blue" as const,
  },
  {
    title: "Grow", eyebrow: "Build new skills",
    body: "Access resources, insights and guidance that help you move forward.",
    image: images.grow, alt: "Professional working on career skills",
    href: "/knowledge-hub", action: "Build new skills", tone: "mint" as const,
  },
  {
    title: "Belong", eyebrow: "Be part of something",
    body: "Join a more human professional network built around people, not profiles.",
    image: images.belong, alt: "Professional team collaborating in a bright office",
    href: "/signup", action: "Be part of something", tone: "peach" as const,
  },
];

const capabilities = [
  { icon: "⌕", title: "Find relevant jobs", body: "Explore opportunities that match your ambitions." },
  { icon: "♙", title: "Build your profile", body: "Showcase your experience, skills and projects." },
  { icon: "◷", title: "Track applications", body: "Stay informed as your journey progresses." },
  { icon: "▤", title: "Keep learning", body: "Explore practical guides in the Knowledge Hub." },
];

export const dynamic = "force-dynamic";

export default async function HomePage() {
  let knowledge: KnowledgeList | null = null;
  try {
    knowledge = await publicAPI<KnowledgeList>("/api/v1/knowledge");
  } catch {
    // Do not fabricate articles when the live publishing service is unavailable.
  }
  const articles = knowledge?.items ?? [];
  const featured = articles[0];
  const remaining = articles.slice(1, 4);

  return (
    <main id="main-content" className="min-h-screen overflow-x-clip bg-white">
      <PublicHeader />

      <section className="landing-hero relative" aria-labelledby="home-title">
        <Container>
          <div className="grid min-w-0 gap-x-8 pb-12 pt-9 sm:pt-12 lg:grid-cols-[minmax(0,0.92fr)_minmax(0,1.08fr)] lg:items-center lg:gap-x-12 lg:pb-14 lg:pt-16">
            <div className="order-1 relative z-20 min-w-0 lg:self-start lg:pt-9">
              <p className="text-[10px] font-extrabold uppercase tracking-[0.22em] text-indigo">People. Work. Forward.</p>
              <h1 id="home-title" className="mt-4 max-w-[38rem] text-balance font-serif text-[clamp(3rem,5vw,4.7rem)] font-semibold leading-[0.98] tracking-[-0.055em] text-navy">
                Find work that feels <span className="italic text-indigo">right for you.</span>
              </h1>
              <p className="mt-5 max-w-[33rem] text-[15px] leading-7 text-ink-muted sm:text-[17px]">
                Search meaningful opportunities, understand the role clearly and move through your career journey with more confidence.
              </p>
            </div>

            <div className="order-3 relative mt-6 min-w-0 lg:order-2 lg:col-start-2 lg:row-start-1 lg:mt-0">
              <div className="relative h-[21rem] w-full overflow-hidden rounded-[2rem] bg-[#e5f1ff] shadow-soft sm:h-[24rem] sm:rounded-[2.5rem] lg:h-[29rem] xl:h-[32rem]">
                <Image
                  src={images.hero}
                  alt="Smiling professional in a softly lit workplace"
                  fill priority sizes="(max-width: 1023px) 100vw, 52vw"
                  className="hero-human object-cover object-[50%_38%] brightness-[1.06] saturate-[0.96]"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-[#071d49]/[0.07] via-transparent to-transparent" aria-hidden="true" />
              </div>
              <HumanAnnotation variant="human" className="pointer-events-none absolute right-2 top-12 hidden w-28 -rotate-6 xl:block" />
              <div className="absolute bottom-3 left-3 z-20 max-w-[12rem] rounded-2xl border border-white/90 bg-white/95 px-3 py-2.5 shadow-card backdrop-blur sm:bottom-6 sm:left-6 sm:max-w-[13.5rem] sm:px-4 sm:py-3 lg:bottom-32 lg:left-4 lg:right-auto xl:bottom-8 xl:left-auto xl:right-4">
                <span className="mb-2 inline-flex h-8 w-8 items-center justify-center rounded-full bg-indigo-soft text-indigo" aria-hidden="true"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="h-4 w-4"><rect x="3.5" y="7" width="17" height="13" rx="2"/><path d="M8 7V5a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2M3.5 12h17M10 12v2h4v-2"/></svg></span>
                <p className="font-serif text-base font-semibold leading-tight text-navy sm:text-lg">Real opportunities.<br />A brighter you.</p>
                <p className="mt-1.5 hidden text-xs leading-[1.45] text-ink-muted sm:block">Find roles, grow your skills and build the career you want.</p>
              </div>
            </div>

            <div className="order-2 relative z-30 mt-6 min-w-0 lg:order-3 lg:col-span-2 lg:-mt-20 lg:max-w-[60rem]">
              <form action="/jobs" className="landing-search-panel grid min-w-0 gap-3 rounded-2xl border border-line/80 bg-white p-3 shadow-[0_17px_48px_rgb(18_54_104_/_0.13)] sm:grid-cols-2 lg:grid-cols-[minmax(0,1.4fr)_minmax(0,0.9fr)_minmax(0,1fr)_auto] lg:items-end" role="search">
                <div className="min-w-0">
                  <label className="mb-1.5 block px-1 text-[11px] font-extrabold text-navy/70" htmlFor="home-q">Role or skill</label>
                  <input id="home-q" name="q" className="min-h-12 w-full min-w-0 rounded-xl border border-line bg-[#f8fbff] px-3 text-sm text-ink outline-none placeholder:text-ink-muted/70 focus:border-indigo/45 focus:bg-white focus:ring-4 focus:ring-indigo/10" placeholder="e.g. Software Engineer" />
                </div>
                <div className="min-w-0">
                  <label className="mb-1.5 block px-1 text-[11px] font-extrabold text-navy/70" htmlFor="home-experience">Experience</label>
                  <select id="home-experience" name="experience" defaultValue="" className="min-h-12 w-full min-w-0 rounded-xl border border-line bg-[#f8fbff] px-3 text-sm text-ink outline-none focus:border-indigo/45 focus:bg-white focus:ring-4 focus:ring-indigo/10">
                    <option value="">Any experience</option>
                    {Array.from({ length: 10 }, (_, year) => <option key={year} value={year}>{year === 0 ? "Fresher / 0 years" : year === 1 ? "1 year" : year + " years"}</option>)}
                    <option value="10">10+ years</option>
                  </select>
                </div>
                <div className="min-w-0">
                  <label className="mb-1.5 block px-1 text-[11px] font-extrabold text-navy/70" htmlFor="home-location">Location</label>
                  <input id="home-location" name="location" className="min-h-12 w-full min-w-0 rounded-xl border border-line bg-[#f8fbff] px-3 text-sm text-ink outline-none placeholder:text-ink-muted/70 focus:border-indigo/45 focus:bg-white focus:ring-4 focus:ring-indigo/10" placeholder="City or country" />
                </div>
                <button className="min-h-12 w-full rounded-xl bg-indigo px-6 text-sm font-bold text-white shadow-sm transition hover:bg-navy focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo focus-visible:ring-offset-2 sm:col-span-2 lg:col-span-1 lg:w-auto" type="submit">
                  Search jobs <span aria-hidden="true">→</span>
                </button>
              </form>
              <nav className="mt-3 flex flex-wrap items-center gap-2 text-[12px] text-ink-muted" aria-label="Popular job searches">
                <span>Popular:</span>
                <Link className="rounded-full border border-line bg-white px-3 py-1.5 hover:border-indigo/40 hover:bg-indigo-soft" href="/jobs?q=Software+Engineer">Software Engineer</Link>
                <Link className="rounded-full border border-line bg-white px-3 py-1.5 hover:border-indigo/40 hover:bg-indigo-soft" href="/jobs?q=Product+Manager">Product Manager</Link>
                <Link className="rounded-full border border-line bg-white px-3 py-1.5 hover:border-indigo/40 hover:bg-indigo-soft" href="/jobs?q=Data+Analyst">Data Analyst</Link>
                <Link className="rounded-full border border-line bg-white px-3 py-1.5 hover:border-indigo/40 hover:bg-indigo-soft" href="/jobs?work_mode=remote">Remote</Link>
              </nav>
            </div>
          </div>
        </Container>
      </section>

      <section id="how-it-works" className="bg-white py-14 sm:py-20" aria-labelledby="journey-title">
        <Container>
          <div className="mx-auto max-w-3xl text-center">
            <p className="text-[10px] font-extrabold uppercase tracking-[0.2em] text-indigo">More than a job board</p>
            <h2 id="journey-title" className="mt-3 text-balance font-serif text-[clamp(2.45rem,4.6vw,4rem)] font-semibold leading-[1.05] tracking-[-0.05em] text-navy">A career partner for what&apos;s next.</h2>
            <p className="mx-auto mt-3 max-w-2xl text-sm leading-6 text-ink-muted sm:text-base">From your first job to your next big move, SapienWorx is built to support your journey at every step.</p>
          </div>
          <div className="mt-8 grid gap-5 md:grid-cols-3 lg:mt-10">
            {journey.map((item, index) => <HumanJourneyCard key={item.title} {...item} delay={index * 0.06} />)}
          </div>
        </Container>
      </section>

      <section id="knowledge-hub" className="border-y border-line/60 bg-[linear-gradient(135deg,#f0f7ff_0%,#f6fbff_55%,#edf8f5_100%)] py-14 sm:py-20" aria-labelledby="knowledge-title">
        <Container>
          <div className="flex flex-col justify-between gap-4 md:flex-row md:items-end">
            <div className="min-w-0">
              <p className="text-[10px] font-extrabold uppercase tracking-[0.2em] text-indigo">SapienWorx Knowledge Hub</p>
              <h2 id="knowledge-title" className="mt-3 max-w-3xl text-balance font-serif text-[clamp(2.3rem,4.5vw,4rem)] font-semibold leading-[1.06] tracking-[-0.05em] text-navy">Practical advice for a brighter career.</h2>
              <p className="mt-3 max-w-2xl text-sm leading-6 text-ink-muted sm:text-base">Guidance on résumés, interviews, building skills and working alongside AI.</p>
            </div>
            <Link href="/knowledge-hub" className="inline-flex min-h-11 shrink-0 items-center justify-center self-start rounded-full border border-indigo/30 bg-white px-5 text-sm font-bold text-indigo transition hover:bg-indigo-soft md:self-auto">Explore Knowledge Hub <span className="ml-1.5" aria-hidden="true">→</span></Link>
          </div>
          {featured && (
            <div className="mt-8 grid gap-4 md:grid-cols-2 xl:grid-cols-[1.55fr_1fr_1fr_1fr]" aria-label="Featured career guides">
              <KnowledgeCard article={featured} featured />
              {remaining.map(article => <div key={article.id} className="hidden md:block"><KnowledgeCard article={article} /></div>)}
            </div>
          )}
          {!featured && <div role="status" className="mt-8 rounded-xl border border-line bg-white p-6 text-sm text-ink-muted">Career guides are temporarily unavailable. Please check back shortly.</div>}
        </Container>
      </section>

      <section id="about" className="overflow-hidden bg-[linear-gradient(120deg,#eff7ff_0%,#ffffff_55%,#eaf4ff_100%)] py-14 sm:py-20" aria-labelledby="product-title">
        <Container>
          <div className="grid min-w-0 items-center gap-10 lg:grid-cols-[minmax(0,0.85fr)_minmax(0,1.15fr)] lg:gap-12">
            <div className="min-w-0">
              <p className="text-[10px] font-extrabold uppercase tracking-[0.2em] text-indigo">Built for your next chapter</p>
              <h2 id="product-title" className="mt-3 max-w-[35rem] text-balance font-serif text-[clamp(2.5rem,4.6vw,4.4rem)] font-semibold leading-[1.04] tracking-[-0.05em] text-navy">Your career journey, all in one place.</h2>
              <p className="mt-4 max-w-xl text-sm leading-7 text-ink-muted sm:text-base">More than job search. Discover opportunities, build your profile, follow your progress and keep learning — all with SapienWorx.</p>
              <div className="mt-6 flex flex-wrap gap-3">
                <Button href="/signup">Create Account <span aria-hidden="true">→</span></Button>
                <Button href="/jobs" variant="secondary">Explore Jobs</Button>
              </div>
            </div>
            <div className="relative min-w-0">
              <CareerPreview />
              <HumanAnnotation variant="progress" className="pointer-events-none absolute -right-1 -top-12 hidden w-28 -rotate-6 xl:block" />
            </div>
          </div>
          <div className="mt-7 grid gap-2 lg:hidden">
            {capabilities.map(item => (
              <div key={item.title} className="flex items-start gap-3 rounded-xl border border-line/70 bg-white/90 p-3.5">
                <span className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-indigo-soft text-base text-indigo" aria-hidden="true">{item.icon}</span>
                <div>
                  <h3 className="text-sm font-bold text-navy">{item.title}</h3>
                  <p className="mt-0.5 text-xs leading-5 text-ink-muted">{item.body}</p>
                </div>
              </div>
            ))}
          </div>
        </Container>
      </section>

      <Container>
        <section className="py-10 sm:py-14" aria-labelledby="final-cta-title">
          <div className="relative overflow-hidden rounded-[1.8rem] bg-[linear-gradient(110deg,#0a5fe8_0%,#073a8f_100%)] px-6 py-9 text-white shadow-soft sm:px-10 lg:min-h-[13rem] lg:px-12 lg:py-10">
            <div className="relative z-10 grid items-center gap-6 lg:grid-cols-[minmax(0,1.3fr)_auto_minmax(10rem,0.55fr)]">
              <div className="max-w-[40rem]">
                <p className="text-[10px] font-extrabold uppercase tracking-[0.18em] text-white/80">Ready for what&apos;s next?</p>
                <h2 id="final-cta-title" className="mt-3 font-serif text-[clamp(2.1rem,4vw,3.5rem)] font-semibold leading-[1.02] tracking-[-0.045em]">Your next chapter starts here.</h2>
                <p className="mt-3 max-w-xl text-sm leading-6 text-white/85">Create your free account and get one step closer to a more meaningful career.</p>
              </div>
              <div className="flex flex-wrap gap-3 lg:justify-center">
                <Button href="/signup" className="landing-cta-inverse">Create Account <span aria-hidden="true">→</span></Button>
                <Button href="/jobs" className="border border-white/60 bg-transparent text-white shadow-none hover:bg-white/10">Explore Jobs</Button>
              </div>
              <div className="relative hidden h-[10rem] min-w-[11rem] lg:block">
                <div className="absolute -bottom-10 right-0 h-[15rem] w-[12rem] overflow-hidden rounded-t-[6rem] opacity-85" aria-hidden="true">
                  <Image src={images.hero} alt="" fill sizes="192px" className="object-cover object-[55%_30%]" />
                </div>
                <p className="absolute bottom-2 right-0 z-10 -rotate-6 text-right font-serif text-base italic leading-tight text-white/90">Same people.<br />Bigger possibilities.</p>
              </div>
            </div>
          </div>
        </section>
      </Container>

      <PublicFooter />
    </main>
  );
}
