import { HumanSignal } from "@/components/brand/human-signal";
import { Container } from "@/components/layout/container";
import { Reveal } from "@/components/motion/reveal";
import { HumanJourneyCard } from "@/components/site/human-journey-card";
import { PublicFooter } from "@/components/site/public-footer";
import { PublicHeader } from "@/components/site/public-header";
import { Button } from "@/components/ui/button";

const journey = [
  {
    title: "Discover",
    eyebrow: "Find your fit",
    body: "Explore real opportunities by role, location and experience — with less noise around the work that matters to you.",
    image: "https://images.unsplash.com/photo-1500648767791-00dcc994a43e?auto=format&fit=crop&w=1000&q=85",
    alt: "Professional smiling in a bright workspace",
    tone: "blue" as const,
  },
  {
    title: "Grow",
    eyebrow: "Build your story",
    body: "Keep your profile, applications and career context together so every next step can build on the last one.",
    image: "https://images.unsplash.com/photo-1494790108377-be9c29b29330?auto=format&fit=crop&w=1000&q=85",
    alt: "Professional woman smiling in a natural portrait",
    tone: "mint" as const,
  },
  {
    title: "Belong",
    eyebrow: "People, not profiles",
    body: "Connect with a more human hiring experience where candidates and recruiters can understand each other clearly.",
    image: "https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=1000&q=85",
    alt: "Professional woman in a warm candid portrait",
    tone: "peach" as const,
  },
];

export default function HomePage() {
  return (
    <main id="main-content" className="min-h-screen overflow-hidden bg-white/45">
      <PublicHeader />

      <Container>
        <section className="grid items-center gap-12 pb-16 pt-10 lg:min-h-[44rem] lg:grid-cols-[1.02fr_0.98fr] lg:gap-16 lg:py-16">
          <Reveal className="relative z-10">
            <p className="text-xs font-extrabold uppercase tracking-[0.2em] text-indigo">Real people. Brighter tomorrows.</p>
            <h1 className="mt-5 max-w-3xl text-balance text-[clamp(3.2rem,7vw,6.3rem)] font-bold leading-[0.91] tracking-[-0.068em] text-navy">
              Your next opportunity <span className="text-indigo">feels human here.</span>
            </h1>
            <p className="mt-6 max-w-xl text-pretty text-base leading-7 text-ink-muted md:text-lg">
              Discover meaningful work, connect with great companies and build a career that fits your life — with SapienWorx.
            </p>

            <form action="/jobs" className="mt-8 grid overflow-hidden rounded-[1.4rem] border border-line/80 bg-white p-1.5 shadow-card sm:grid-cols-2 lg:grid-cols-[1.25fr_0.85fr_0.85fr_auto]" role="search">
              <label className="sr-only" htmlFor="home-q">Job title, skill or company</label>
              <input id="home-q" name="q" className="min-h-14 rounded-xl bg-transparent px-4 text-sm text-ink outline-none placeholder:text-ink-muted/70 focus:bg-indigo-soft/35" placeholder="Job title, skill or company" />

              <label className="sr-only" htmlFor="home-experience">Experience</label>
              <select id="home-experience" name="experience" defaultValue="" className="min-h-14 rounded-xl bg-transparent px-4 text-sm text-ink outline-none focus:bg-indigo-soft/35">
                <option value="">Experience</option>
                <option value="0">Fresher / 0 years</option>
                <option value="1">1 year</option>
                <option value="2">2 years</option>
                <option value="3">3 years</option>
                <option value="5">5 years</option>
                <option value="8">8 years</option>
                <option value="10">10+ years</option>
              </select>

              <label className="sr-only" htmlFor="home-location">Location</label>
              <input id="home-location" name="location" className="min-h-14 rounded-xl bg-transparent px-4 text-sm text-ink outline-none placeholder:text-ink-muted/70 focus:bg-indigo-soft/35" placeholder="Location" />

              <button className="min-h-14 rounded-xl bg-indigo px-6 text-sm font-bold text-white shadow-sm transition duration-200 hover:-translate-y-0.5 hover:bg-navy focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo focus-visible:ring-offset-2" type="submit">
                Search jobs →
              </button>
            </form>

            <div className="mt-4 flex flex-wrap items-center gap-2 text-xs text-ink-muted">
              <span className="font-semibold text-navy">Popular:</span>
              <a className="rounded-full bg-indigo-soft px-3 py-1.5 transition hover:bg-[#dceaff]" href="/jobs?q=Software+Engineer">Software Engineer</a>
              <a className="rounded-full bg-indigo-soft px-3 py-1.5 transition hover:bg-[#dceaff]" href="/jobs?q=Product+Manager">Product Manager</a>
              <a className="rounded-full bg-indigo-soft px-3 py-1.5 transition hover:bg-[#dceaff]" href="/jobs?q=Data+Analyst">Data Analyst</a>
              <a className="rounded-full bg-indigo-soft px-3 py-1.5 transition hover:bg-[#dceaff]" href="/jobs?work_mode=remote">Remote</a>
            </div>
          </Reveal>

          <Reveal className="relative mx-auto w-full max-w-[37rem]" delay={0.08}>
            <div className="relative isolate min-h-[34rem] lg:min-h-[39rem]">
              <div className="hero-orbit absolute -left-10 top-10 h-60 w-60 rounded-full bg-indigo-soft/80 blur-2xl" aria-hidden="true" />
              <div className="absolute -right-16 bottom-10 h-56 w-56 rounded-full bg-[#dff4ff] blur-2xl" aria-hidden="true" />
              <HumanSignal className="pointer-events-none absolute -left-8 top-4 z-10 w-40 text-indigo/20" title="" />

              <div className="hero-human organic-mask absolute inset-x-0 bottom-0 top-4 overflow-hidden bg-[#edf5ff] shadow-soft">
                <img
                  src="https://images.unsplash.com/photo-1494790108377-be9c29b29330?auto=format&fit=crop&w=1200&q=88"
                  alt="Professional woman smiling in a bright workspace"
                  className="h-full w-full object-cover object-center"
                  fetchPriority="high"
                />
              </div>

              <div className="absolute right-0 top-[24%] z-20 max-w-[13rem] rounded-[1.35rem] border border-white/80 bg-white/92 p-4 shadow-card backdrop-blur md:-right-5">
                <p className="text-lg font-bold tracking-[-0.025em] text-navy">A more human way to work</p>
                <div className="mt-4 grid gap-2 text-xs leading-5 text-ink-muted">
                  <span>✓ Clear opportunities</span>
                  <span>✓ Transparent applications</span>
                  <span>✓ Tools to grow</span>
                </div>
              </div>

              <div className="absolute bottom-8 left-0 z-20 rounded-full border border-white/80 bg-white/92 px-4 py-2 text-xs font-bold text-navy shadow-card backdrop-blur md:-left-5">
                People first. Always.
              </div>
            </div>
          </Reveal>
        </section>
      </Container>

      <section id="how-it-works" className="border-y border-line/70 bg-white py-20 sm:py-24" aria-labelledby="journey-title">
        <Container>
          <Reveal className="mx-auto max-w-3xl text-center">
            <p className="text-xs font-extrabold uppercase tracking-[0.19em] text-indigo">Your career, in motion</p>
            <h2 id="journey-title" className="mt-4 text-balance text-[clamp(2.8rem,5vw,4.6rem)] font-bold leading-[0.98] tracking-[-0.055em] text-navy">
              More than a job board. A career partner.
            </h2>
            <p className="mx-auto mt-5 max-w-2xl text-base leading-7 text-ink-muted">
              From your first job to your next big move, SapienWorx is designed to support the human journey behind every application.
            </p>
          </Reveal>

          <div className="mt-12 grid gap-8 md:grid-cols-3">
            {journey.map((item, index) => (
              <HumanJourneyCard key={item.title} {...item} delay={index * 0.1} />
            ))}
          </div>
        </Container>
      </section>

      <section className="py-20 sm:py-24" aria-labelledby="people-title">
        <Container>
          <div className="grid items-center gap-10 lg:grid-cols-[0.9fr_1.1fr] lg:gap-16">
            <Reveal className="relative">
              <div className="overflow-hidden rounded-[2.2rem] bg-indigo-soft shadow-soft">
                <img
                  src="https://images.unsplash.com/photo-1506794778202-cad84cf45f1d?auto=format&fit=crop&w=1100&q=86"
                  alt="Professional smiling in a candid portrait"
                  className="aspect-[4/4.5] h-full w-full object-cover"
                  loading="lazy"
                />
              </div>
              <HumanSignal className="pointer-events-none absolute -bottom-12 -right-10 w-44 text-indigo/18" title="" />
            </Reveal>

            <Reveal delay={0.08}>
              <p className="text-xs font-extrabold uppercase tracking-[0.19em] text-indigo">People moving forward</p>
              <h2 id="people-title" className="mt-4 max-w-xl text-balance text-4xl font-bold leading-tight tracking-[-0.045em] text-navy sm:text-5xl">
                Hiring works better when the person is visible behind the résumé.
              </h2>
              <p className="mt-5 max-w-xl text-base leading-7 text-ink-muted">
                That is the experience we are building: useful job discovery for candidates, clear application progress, and recruiter tools that keep context without turning people into rows of data.
              </p>
              <div className="mt-7 flex flex-wrap gap-3">
                <Button href="/signup">Create your profile</Button>
                <Button href="/jobs" variant="secondary">Explore jobs →</Button>
              </div>
            </Reveal>
          </div>
        </Container>
      </section>

      <Container>
        <section className="pb-16 sm:pb-20">
          <Reveal>
            <div className="relative grid overflow-hidden rounded-[2.3rem] bg-navy text-white shadow-soft lg:grid-cols-[1fr_0.72fr]">
              <div className="relative z-10 p-8 sm:p-12">
                <p className="text-xs font-bold uppercase tracking-[0.18em] text-[#79b8ff]">Your next chapter starts here</p>
                <h2 className="mt-3 max-w-2xl text-4xl font-bold tracking-[-0.045em] sm:text-5xl">Find work that fits the person you are becoming.</h2>
                <p className="mt-4 max-w-xl text-sm leading-6 text-white/70">Create a free candidate profile, search by your experience and location, and keep your opportunities together in one place.</p>
                <div className="mt-7 flex flex-wrap gap-3"><Button href="/signup" className="bg-white text-navy hover:bg-indigo-soft">Create account →</Button><Button href="/jobs" variant="secondary">Explore jobs</Button></div>
              </div>
              <div className="relative hidden min-h-80 overflow-hidden lg:block">
                <img src="https://images.unsplash.com/photo-1500648767791-00dcc994a43e?auto=format&fit=crop&w=900&q=86" alt="Professional looking ahead" className="absolute inset-0 h-full w-full object-cover opacity-90" loading="lazy" />
                <div className="absolute inset-0 bg-gradient-to-r from-navy via-navy/35 to-transparent" aria-hidden="true" />
              </div>
            </div>
          </Reveal>
        </section>
      </Container>

      <PublicFooter />
    </main>
  );
}
