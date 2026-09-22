import Image from "next/image";

import { Container } from "@/components/layout/container";
import { Reveal } from "@/components/motion/reveal";
import { HumanJourneyCard } from "@/components/site/human-journey-card";
import { LandingJobSearch } from "@/components/site/landing-job-search";
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

      <section className="relative overflow-hidden bg-[linear-gradient(135deg,#f4f9ff_0%,#ffffff_56%,#edf5ff_100%)]">
        <Container>
          <div className="grid min-w-0 items-center gap-9 pb-9 pt-10 sm:gap-12 sm:pb-12 sm:pt-14 lg:grid-cols-[minmax(0,1.05fr)_minmax(0,0.95fr)] lg:gap-16 lg:pb-14 lg:pt-16">
            <Reveal className="relative z-10 min-w-0">
              <p className="text-[11px] font-extrabold uppercase tracking-[0.2em] text-indigo">Real people. Brighter tomorrows.</p>
              <h1 className="mt-5 max-w-[43rem] text-balance font-serif text-[clamp(3rem,5.3vw,5.7rem)] font-semibold leading-[0.98] tracking-[-0.055em] text-navy">
                Your next opportunity <span className="italic text-indigo">feels human here.</span>
              </h1>
              <p className="mt-6 max-w-[32rem] text-base leading-7 text-ink-muted sm:text-lg sm:leading-8">
                Find meaningful work, discover growing teams and take your next career step with confidence.
              </p>
              <div className="mt-7 flex flex-wrap items-center gap-3">
                <Button href="#job-search" size="lg">Find your next role <span aria-hidden="true">→</span></Button>
                <Button href="/signup" variant="secondary" size="lg">Create your profile</Button>
              </div>
              <p className="mt-6 text-sm text-ink-muted">Made for people, not just résumés.</p>
            </Reveal>

            <Reveal className="relative mx-auto w-full min-w-0 max-w-[35rem]" delay={0.08}>
              <div className="relative rounded-[2.25rem] bg-[#e8f3ff] p-3 shadow-[0_22px_65px_rgb(10_44_92_/_0.11)] sm:rounded-[3rem] sm:p-4">
                <div className="relative aspect-[5/4] overflow-hidden rounded-[1.75rem] bg-[#daeafa] sm:aspect-[1/1] sm:rounded-[2.5rem]">
                  <Image
                    src={people.hero}
                    alt="A professional smiling in a softly lit workspace"
                    fill
                    priority
                    sizes="(max-width: 1024px) 100vw, 44vw"
                    className="hero-human object-cover object-center"
                  />
                </div>
                <div className="pointer-events-none absolute -bottom-3 right-4 max-w-[13rem] rounded-2xl border border-white/85 bg-white/95 px-4 py-3 shadow-card sm:-bottom-5 sm:right-6 sm:max-w-[15rem] sm:px-5 sm:py-4">
                  <span className="block text-[11px] font-extrabold uppercase tracking-[0.13em] text-indigo">A better way forward</span>
                  <span className="mt-1 block font-serif text-lg font-semibold leading-6 text-navy sm:text-xl">Your career. Your next chapter.</span>
                </div>
              </div>
            </Reveal>
          </div>
        </Container>
        <LandingJobSearch />
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
                <div className="mt-7 flex flex-wrap gap-3"><Button href="/signup" className="landing-final-cta">Create Account →</Button><Button href="/jobs" className="border border-white/45 bg-transparent text-white shadow-none hover:bg-white/10">Explore Jobs</Button></div>
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
