import Image from "next/image";

import { Container } from "@/components/layout/container";
import { Reveal } from "@/components/motion/reveal";
import { HumanJourneyCard } from "@/components/site/human-journey-card";
import { PublicFooter } from "@/components/site/public-footer";
import { PublicHeader } from "@/components/site/public-header";
import { Button } from "@/components/ui/button";

const people = {
  hero: "/images/people/sapien-hero-candidate.webp",
  recruiter: "/images/people/sapien-recruiter.webp",
  talent: "/images/people/sapien-talent.webp",
  workplace: "/images/people/sapien-workplace.webp",
  employer: "/images/people/sapien-employer.webp",
};

const journey = [
  {
    title: "Discover",
    eyebrow: "Find your fit",
    body: "Find roles that match your skills, goals and values.",
    image: people.recruiter,
    alt: "Approachable professional in a softly lit modern workplace",
    tone: "blue" as const,
  },
  {
    title: "Grow",
    eyebrow: "Build new skills",
    body: "Access resources, insights and a community that helps you move forward.",
    image: people.talent,
    alt: "Professional smiling in a pastel modern office",
    tone: "mint" as const,
  },
  {
    title: "Belong",
    eyebrow: "Be part of something",
    body: "Join a more human professional network built around people, not profiles.",
    image: people.workplace,
    alt: "Warm professional portrait in a collaborative workplace",
    tone: "peach" as const,
  },
];

const proof = [
  ["Clear", "application stages"],
  ["Real", "published opportunities"],
  ["Human", "candidate profiles"],
  ["Useful", "recruiter context"],
];

const communityPeople = [people.hero, people.recruiter, people.talent, people.employer];

export default function HomePage() {
  return (
    <main id="main-content" className="min-h-screen overflow-hidden bg-white">
      <PublicHeader />

      <section className="relative overflow-hidden bg-[linear-gradient(180deg,#f7fbff_0%,#ffffff_78%,#ffffff_100%)]">
        <Container>
          <div className="grid items-center gap-10 pb-6 pt-10 lg:grid-cols-[0.98fr_1.02fr] lg:gap-16 lg:pt-14">
            <Reveal className="relative z-20 max-w-[42rem]">
              <p className="text-[11px] font-extrabold uppercase tracking-[0.24em] text-indigo">People. Work. Forward.</p>
              <h1 className="mt-5 text-balance font-serif text-[clamp(3.25rem,6vw,5.9rem)] font-semibold leading-[0.92] tracking-[-0.055em] text-navy">
                Find work that feels <span className="italic text-indigo">right for you.</span>
              </h1>
              <p className="mt-6 max-w-[36rem] text-[17px] leading-7 text-ink-muted">
                Search meaningful opportunities, understand the role clearly and move through your career journey with more confidence.
              </p>
              <div className="mt-7 flex flex-wrap items-center gap-3">
                <Button href="/jobs" size="lg">Explore jobs <span aria-hidden="true">→</span></Button>
                <Button href="/signup" size="lg" variant="secondary">Create your profile</Button>
              </div>
              <p className="mt-5 text-sm text-ink-muted">
                Recruiter or hiring team? <a className="font-bold text-navy underline decoration-indigo/30 underline-offset-4 hover:text-indigo" href="/recruiter/login">Go to Recruiter Workspace →</a>
              </p>
            </Reveal>

            <Reveal className="relative mx-auto w-full max-w-[39rem]" delay={0.08}>
              <div className="relative min-h-[28rem] sm:min-h-[34rem] lg:min-h-[37rem]">
                <div className="absolute inset-x-[7%] bottom-0 top-0 overflow-hidden rounded-[2.75rem] bg-[#eaf3ff] shadow-soft">
                  <Image
                    src={people.hero}
                    alt="Professional smiling in a softly lit modern office"
                    fill
                    priority
                    sizes="(max-width: 768px) 100vw, 48vw"
                    className="hero-human object-cover object-center"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-[#071d49]/12 via-transparent to-white/8" aria-hidden="true" />
                </div>
                <div className="absolute bottom-5 left-0 z-20 max-w-[14rem] rounded-2xl border border-white/90 bg-white/95 p-4 shadow-card backdrop-blur">
                  <p className="text-[10px] font-extrabold uppercase tracking-[0.16em] text-indigo">Candidate-first</p>
                  <p className="mt-2 font-serif text-xl font-semibold leading-tight text-navy">Clear opportunities. Less noise.</p>
                  <p className="mt-2 text-xs leading-5 text-ink-muted">Search, apply and track your progress in one place.</p>
                </div>
              </div>
            </Reveal>
          </div>

          <Reveal className="relative z-30 pb-12 lg:pb-14" delay={0.12}>
            <form action="/jobs" className="landing-search-panel grid gap-3 rounded-[1.6rem] border border-line/80 bg-white p-3 shadow-[0_18px_50px_rgb(18_54_104_/_0.11)] md:grid-cols-2 xl:grid-cols-[minmax(0,1.45fr)_minmax(0,0.85fr)_minmax(0,0.95fr)_auto]" role="search">
              <div className="min-w-0">
                <label className="mb-1.5 block px-1 text-[11px] font-extrabold uppercase tracking-[0.12em] text-navy/60" htmlFor="home-q">Role or skill</label>
                <input id="home-q" name="q" className="min-h-12 w-full rounded-xl border border-line bg-[#f8fbff] px-4 text-sm text-ink outline-none placeholder:text-ink-muted/70 focus:border-indigo/45 focus:bg-white focus:ring-4 focus:ring-indigo/10" placeholder="e.g. Software Engineer" />
              </div>

              <div className="min-w-0">
                <label className="mb-1.5 block px-1 text-[11px] font-extrabold uppercase tracking-[0.12em] text-navy/60" htmlFor="home-experience">Experience</label>
                <select id="home-experience" name="experience" defaultValue="" className="min-h-12 w-full rounded-xl border border-line bg-[#f8fbff] px-4 text-sm text-ink outline-none focus:border-indigo/45 focus:bg-white focus:ring-4 focus:ring-indigo/10">
                  <option value="">Any experience</option>
                  <option value="0">Fresher / 0 years</option>
                  <option value="1">1 year</option>
                  <option value="2">2 years</option>
                  <option value="3">3 years</option>
                  <option value="5">5 years</option>
                  <option value="8">8 years</option>
                  <option value="10">10+ years</option>
                </select>
              </div>

              <div className="min-w-0">
                <label className="mb-1.5 block px-1 text-[11px] font-extrabold uppercase tracking-[0.12em] text-navy/60" htmlFor="home-location">Location</label>
                <input id="home-location" name="location" className="min-h-12 w-full rounded-xl border border-line bg-[#f8fbff] px-4 text-sm text-ink outline-none placeholder:text-ink-muted/70 focus:border-indigo/45 focus:bg-white focus:ring-4 focus:ring-indigo/10" placeholder="City, country or remote" />
              </div>

              <div className="flex items-end">
                <button className="min-h-12 w-full rounded-xl bg-indigo px-6 text-sm font-bold text-white shadow-sm transition hover:-translate-y-0.5 hover:bg-navy focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo focus-visible:ring-offset-2 xl:w-auto" type="submit">
                  Search jobs <span aria-hidden="true">→</span>
                </button>
              </div>
            </form>

            <div className="mt-3 flex flex-wrap items-center gap-2 text-[12px] text-ink-muted">
              <span>Popular:</span>
              <a className="rounded-full border border-line bg-white px-3 py-1.5 transition hover:border-indigo/30 hover:bg-indigo-soft/55" href="/jobs?q=Software+Engineer">Software Engineer</a>
              <a className="rounded-full border border-line bg-white px-3 py-1.5 transition hover:border-indigo/30 hover:bg-indigo-soft/55" href="/jobs?q=Product+Manager">Product Manager</a>
              <a className="rounded-full border border-line bg-white px-3 py-1.5 transition hover:border-indigo/30 hover:bg-indigo-soft/55" href="/jobs?q=Data+Analyst">Data Analyst</a>
              <a className="rounded-full border border-line bg-white px-3 py-1.5 transition hover:border-indigo/30 hover:bg-indigo-soft/55" href="/jobs?work_mode=remote">Remote</a>
            </div>
          </Reveal>
        </Container>
      </section>

      <section className="border-y border-line/70 bg-white py-7" aria-label="Platform principles">
        <Container>
          <p className="text-center text-[10px] font-extrabold uppercase tracking-[0.22em] text-navy/55">Built for people building extraordinary careers</p>
          <div className="mt-5 grid grid-cols-2 gap-3 text-center sm:grid-cols-4 lg:grid-cols-8">
            {["Discover", "Profile", "Applications", "Saved Jobs", "Recruiters", "Interviews", "Offers", "Growth"].map((label) => (
              <div key={label} className="rounded-xl px-2 py-2 text-xs font-bold text-navy/55">{label}</div>
            ))}
          </div>
        </Container>
      </section>

      <section id="how-it-works" className="relative bg-[linear-gradient(180deg,#ffffff_0%,#f9fcff_100%)] py-20 sm:py-24" aria-labelledby="journey-title">
        <Container>
          <Reveal className="mx-auto max-w-4xl text-center">
            <h2 id="journey-title" className="text-balance font-serif text-[clamp(3rem,5vw,5rem)] font-semibold leading-[0.95] tracking-[-0.055em] text-navy">
              More than a job board.<br />A career partner.
            </h2>
            <p className="mx-auto mt-5 max-w-2xl text-base leading-7 text-ink-muted">From your first job to your next big move, SapienWorx is built to support your journey at every step.</p>
            <a href="#about" className="mt-3 inline-flex text-sm font-bold text-indigo underline-offset-4 hover:underline">See how it works →</a>
          </Reveal>

          <div className="mt-12 grid gap-8 md:grid-cols-3">
            {journey.map((item, index) => <HumanJourneyCard key={item.title} {...item} delay={index * 0.1} />)}
          </div>
        </Container>
      </section>

      <section id="about" className="relative overflow-hidden bg-[#f8fbff] py-20 sm:py-24" aria-labelledby="people-title">
        <div className="pointer-events-none absolute -left-16 top-24 h-48 w-48 rounded-full bg-[#deedff] blur-2xl" aria-hidden="true" />
        <div className="pointer-events-none absolute -right-12 bottom-14 h-56 w-56 rounded-full bg-[#e9f5ff] blur-2xl" aria-hidden="true" />
        <Container>
          <Reveal className="mx-auto max-w-4xl text-center">
            <p className="font-serif text-lg italic text-indigo">Real stories. Real progress.</p>
            <h2 id="people-title" className="mt-4 text-balance font-serif text-[clamp(2.9rem,5vw,4.8rem)] font-semibold leading-[0.96] tracking-[-0.052em] text-navy">People moving forward<br />with SapienWorx</h2>
          </Reveal>

          <Reveal className="mx-auto mt-10 max-w-4xl" delay={0.08}>
            <div className="rounded-[2rem] border border-line/80 bg-white px-6 py-7 shadow-soft sm:px-9 sm:py-8">
              <div className="grid gap-6 sm:grid-cols-[auto_1fr] sm:items-center">
                <Image
                  src={people.employer}
                  alt="Professional portrait representing the SapienWorx candidate-first experience"
                  width={80}
                  height={80}
                  sizes="80px"
                  className="h-20 w-20 object-cover shadow-sm"
                  style={{ borderRadius: "44% 56% 51% 49% / 47% 42% 58% 53%" }}
                />
                <div>
                  <p className="font-serif text-xl italic leading-8 text-navy">“The best hiring experiences feel clear, respectful and human from the first search to the final conversation.”</p>
                  <p className="mt-4 text-sm font-bold text-navy">The SapienWorx product principle</p>
                  <p className="text-sm text-ink-muted">Candidate-first by design</p>
                </div>
              </div>
            </div>
          </Reveal>

          <div className="mt-6 flex justify-center gap-1.5" aria-hidden="true"><span className="h-2 w-5 rounded-full bg-indigo" /><span className="h-2 w-2 rounded-full bg-line" /><span className="h-2 w-2 rounded-full bg-line" /></div>
        </Container>
      </section>

      <section className="bg-white py-12 sm:py-14" aria-label="SapienWorx product principles">
        <Container>
          <div className="grid gap-7 sm:grid-cols-2 lg:grid-cols-4">
            {proof.map(([value, label]) => (
              <Reveal key={value}>
                <div className="text-center lg:text-left">
                  <div className="mx-auto mb-3 flex h-10 w-10 items-center justify-center rounded-full bg-indigo-soft text-sm font-bold text-indigo lg:mx-0">✓</div>
                  <p className="text-3xl font-extrabold tracking-[-0.04em] text-navy">{value}</p>
                  <p className="mt-1 text-sm text-ink-muted">{label}</p>
                </div>
              </Reveal>
            ))}
          </div>
        </Container>
      </section>

      <Container>
        <section className="pb-14 pt-5 sm:pb-16">
          <Reveal>
            <div className="relative grid min-h-[21rem] overflow-hidden rounded-[2.1rem] bg-[linear-gradient(110deg,#0a5fe8_0%,#073a8f_100%)] text-white shadow-soft lg:grid-cols-[0.78fr_1.22fr]">
              <div className="relative min-h-[18rem] overflow-hidden lg:min-h-full">
                <Image
                  src={people.recruiter}
                  alt="Professional looking confidently ahead"
                  fill
                  sizes="(max-width: 1024px) 100vw, 40vw"
                  className="object-cover object-center"
                />
                <div className="absolute inset-0 bg-gradient-to-r from-[#0a5fe8]/10 via-transparent to-[#073a8f]/75" aria-hidden="true" />
              </div>
              <div className="relative z-10 flex flex-col justify-center p-8 sm:p-12">
                <p className="text-xs font-bold uppercase tracking-[0.18em] text-white/70">Ready for what’s next?</p>
                <h2 className="mt-3 max-w-xl font-serif text-4xl font-semibold tracking-[-0.045em] sm:text-5xl">Your next chapter starts here.</h2>
                <p className="mt-4 max-w-lg text-sm leading-6 text-white/78">Create your free account and get one step closer to a more meaningful career.</p>
                <div className="mt-7 flex flex-wrap gap-3"><Button href="/signup">Create Account →</Button><Button href="/jobs" className="border border-white/45 bg-transparent text-white shadow-none hover:bg-white/10">Explore Jobs</Button></div>
                <p className="absolute bottom-6 right-7 hidden -rotate-5 font-serif text-xl italic leading-tight text-white/75 sm:block">Same people.<br />Bigger possibilities.</p>
              </div>
            </div>
          </Reveal>
        </section>
      </Container>

      <PublicFooter />
    </main>
  );
}
