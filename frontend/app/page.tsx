import Image from "next/image";
import Link from "next/link";

import { HumanSignal } from "@/components/brand/human-signal";
import { Container } from "@/components/layout/container";
import { Reveal } from "@/components/motion/reveal";
import { HumanJourneyCard } from "@/components/site/human-journey-card";
import { PublicFooter } from "@/components/site/public-footer";
import { PublicHeader } from "@/components/site/public-header";
import { Button } from "@/components/ui/button";
import { guides } from "@/lib/knowledge-hub";

const photo = (name: string) => `/images/people/${encodeURIComponent(name)}`;

// The original 02:48 composite is a design reference, not a photograph.
// The eight 18:05 assets are, in order: hero, three journey cards, four guides.
const people = {
  hero: photo("ChatGPT Image Sep 23, 2026, 06_05_55 PM (1).png"),
  discover: photo("ChatGPT Image Sep 23, 2026, 06_05_55 PM (2).png"),
  grow: photo("ChatGPT Image Sep 23, 2026, 06_05_56 PM (3).png"),
  belong: photo("ChatGPT Image Sep 23, 2026, 06_05_56 PM (4).png"),
};

const journey = [
  {
    title: "Discover",
    eyebrow: "Find your fit",
    body: "Explore opportunities that align with your skills, interests and the life you want to build.",
    image: people.discover,
    alt: "Professional woman typing on a laptop as she explores opportunities",
    tone: "blue" as const,
  },
  {
    title: "Grow",
    eyebrow: "Keep moving forward",
    body: "Make the most of your strengths, plan your next move and learn something new along the way.",
    image: people.grow,
    alt: "Thoughtful professional smiling as he considers his next career move",
    tone: "mint" as const,
  },
  {
    title: "Belong",
    eyebrow: "People first",
    body: "Build a professional future with clearer conversations and meaningful human connections.",
    image: people.belong,
    alt: "Professional wearing a headset and connecting with others",
    tone: "peach" as const,
  },
];

const popular = [
  ["Software Engineer", "/jobs?q=Software+Engineer"],
  ["Product Manager", "/jobs?q=Product+Manager"],
  ["Data Analyst", "/jobs?q=Data+Analyst"],
  ["Remote work", "/jobs?work_mode=remote"],
];

export default function HomePage() {
  return (
    <main id="main-content" className="landing-home min-h-screen overflow-x-clip">
      <PublicHeader />

      <section className="landing-hero relative isolate overflow-hidden" aria-labelledby="home-title">
        <div className="pointer-events-none absolute -left-24 top-24 size-80 rounded-full bg-[#dfeaff]/80 blur-3xl" aria-hidden="true" />
        <div className="pointer-events-none absolute -right-20 bottom-8 size-80 rounded-full bg-[#ffdfce]/70 blur-3xl" aria-hidden="true" />
        <Container>
          <div className="grid items-center gap-10 pb-14 pt-10 sm:pt-14 lg:min-h-[47rem] lg:grid-cols-[minmax(0,0.96fr)_minmax(0,1.04fr)] lg:gap-12 lg:pb-20 lg:pt-12">
            <Reveal className="relative z-20 min-w-0">
              <p className="inline-flex items-center gap-2 rounded-full border border-[#d9e5f5] bg-white/80 px-4 py-2 text-[11px] font-extrabold uppercase tracking-[0.15em] text-[#1b4b91]">
                <span aria-hidden="true" className="size-2 rounded-full bg-indigo" />
                A more human way to work
              </p>
              <h1 id="home-title" className="mt-6 max-w-[37rem] text-balance font-serif text-[clamp(3.15rem,6.3vw,6.35rem)] font-semibold leading-[0.98] tracking-[-0.058em] text-navy">
                Find work that feels <em className="font-normal text-indigo">right</em> for you.
              </h1>
              <p className="mt-6 max-w-[32rem] text-[16px] leading-7 text-ink-muted sm:text-[18px] sm:leading-8">
                Discover roles that fit who you are, grow with confidence and find people who see your potential. Your next chapter starts with you.
              </p>

              <form action="/jobs" role="search" className="landing-search mt-7 grid w-full max-w-[28rem] border border-[#dce6f2] bg-white shadow-[0_22px_58px_rgb(11_48_101_/_0.13)]">
                <label className="sr-only" htmlFor="home-q">Role or skill</label>
                <input id="home-q" name="q" type="search" autoComplete="off" placeholder="Role or skill" className="w-full px-4 text-sm text-navy placeholder:text-ink-muted" />
                <label className="sr-only" htmlFor="home-experience">Experience</label>
                <select id="home-experience" name="experience" defaultValue="" className="w-full px-4 text-sm text-navy">
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
                <input id="home-location" name="location" autoComplete="address-level2" placeholder="Location" className="w-full px-4 text-sm text-navy placeholder:text-ink-muted" />
                <button type="submit" className="min-h-11 w-full rounded-xl bg-indigo px-5 text-sm font-bold text-white transition-colors hover:bg-navy focus-visible:outline-offset-2">
                  Search jobs <span aria-hidden="true">↗</span>
                </button>
              </form>

              <div className="mt-4 flex max-w-[31rem] flex-wrap items-center gap-2 text-xs text-ink-muted">
                <span className="mr-1">Popular:</span>
                {popular.map(([label, href]) => (
                  <Link key={label} href={href} className="rounded-full border border-[#dde8f5] bg-white/90 px-3 py-1.5 text-navy/80 transition-colors hover:border-indigo/40 hover:text-indigo">{label}</Link>
                ))}
              </div>
            </Reveal>

            <Reveal className="relative mx-auto w-full max-w-[41rem]" delay={0.08}>
              <div className="relative isolate mx-auto h-[25rem] w-full max-w-[34rem] sm:h-[36rem] lg:h-[40rem] lg:max-w-none">
                <div className="hero-orbit absolute -left-8 top-6 size-56 rounded-full bg-[#bfd8ff]/65 blur-3xl" aria-hidden="true" />
                <div className="absolute bottom-4 right-0 size-60 rounded-full bg-[#ffd9c7]/75 blur-3xl" aria-hidden="true" />
                <div className="absolute inset-x-[7%] bottom-[3%] top-[2%] overflow-hidden rounded-[48%_52%_49%_51%/45%_47%_53%_55%] border-[9px] border-white/90 bg-[#e2ecff] shadow-[0_24px_80px_rgb(26_69_125_/_0.14)] sm:inset-x-[8%] sm:border-[13px]">
                  <Image src={people.hero} alt="Smiling professional in a light blue turtleneck and round glasses" fill priority sizes="(max-width: 640px) 88vw, (max-width: 1024px) 75vw, 42vw" className="hero-human object-cover object-center" />
                </div>
                <HumanSignal className="pointer-events-none absolute right-[10%] top-1 z-10 w-[5.5rem] text-indigo/20 sm:w-28" title="" />
                <span className="landing-handwriting pointer-events-none absolute left-0 top-[11%] z-20 hidden -rotate-12 text-xl text-navy/65 sm:block">A little more human ↘</span>

                <div className="landing-glass absolute -right-1 top-[20%] z-20 w-[11.25rem] rounded-[1.25rem] p-3.5 sm:right-0 sm:w-[13.5rem] sm:p-5">
                  <p className="text-[10px] font-extrabold uppercase tracking-[0.12em] text-indigo">Discover your next move</p>
                  <p className="mt-2 font-serif text-lg font-semibold text-navy sm:text-xl">Find your fit</p>
                  <p className="mt-1 text-xs leading-5 text-ink-muted">Explore real published opportunities.</p>
                  <Link href="/jobs" className="mt-3 inline-flex min-h-9 items-center rounded-full bg-indigo px-4 text-xs font-bold text-white transition-colors hover:bg-navy">Find jobs ↗</Link>
                </div>

                <div className="landing-glass absolute bottom-[4%] left-0 z-20 flex max-w-[11.5rem] items-center gap-2 rounded-[1.25rem] p-3 sm:bottom-[9%] sm:left-[1%] sm:max-w-[14rem] sm:p-4">
                  <span className="grid size-9 shrink-0 place-items-center rounded-full bg-[#e4f5ed] text-lg text-[#258764]" aria-hidden="true">✓</span>
                  <span className="text-xs font-bold leading-5 text-navy">More clarity.<br />More possibility.</span>
                </div>
              </div>
            </Reveal>
          </div>
        </Container>
      </section>

      <section id="how-it-works" className="scroll-mt-24 bg-[#fffcf8] py-16 sm:py-24" aria-labelledby="journey-title">
        <Container>
          <Reveal className="mx-auto max-w-[47rem] text-center">
            <p className="landing-handwriting text-lg text-indigo">Every path starts somewhere</p>
            <h2 id="journey-title" className="mt-3 text-balance font-serif text-[clamp(2.65rem,5vw,4.65rem)] font-semibold leading-[1.05] tracking-[-0.048em] text-navy">
              Your career is more than a job title.
            </h2>
            <p className="mx-auto mt-5 max-w-[37rem] text-base leading-7 text-ink-muted">Whether you are starting out or starting again, find the space to discover, grow and belong.</p>
          </Reveal>
          <div className="mt-11 grid gap-8 md:grid-cols-3">
            {journey.map((item, index) => <HumanJourneyCard key={item.title} {...item} delay={index * 0.08} />)}
          </div>
        </Container>
      </section>

      <section id="knowledge-hub" className="scroll-mt-24 bg-[#f2f7ff] py-16 sm:py-24" aria-labelledby="knowledge-title">
        <Container>
          <Reveal className="flex flex-col justify-between gap-5 sm:flex-row sm:items-end">
            <div className="max-w-[42rem]">
              <p className="landing-handwriting text-lg text-indigo">Made for your next step</p>
              <h2 id="knowledge-title" className="mt-2 font-serif text-[clamp(2.7rem,5vw,4.5rem)] font-semibold leading-tight tracking-[-0.045em] text-navy">Knowledge Hub</h2>
              <p className="mt-3 max-w-[36rem] text-base leading-7 text-ink-muted">Practical advice for the moments that matter in your career. Written to help you take the next step, not guess your way through it.</p>
            </div>
            <Link href="/jobs" className="inline-flex min-h-11 shrink-0 items-center self-start rounded-full border border-indigo/25 bg-white px-5 text-sm font-bold text-indigo transition-colors hover:bg-indigo-soft sm:self-end">Explore opportunities ↗</Link>
          </Reveal>

          <div className="mt-10 grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
            {guides.map((guide, index) => (
              <Reveal key={guide.slug} delay={index * 0.055} className="h-full">
                <article className="group flex h-full flex-col overflow-hidden rounded-[1.55rem] border border-[#e0e9f5] bg-white shadow-[0_12px_35px_rgb(10_44_92_/_0.055)]">
                  <Link href={`/resources/${guide.slug}`} className="relative block aspect-[1.25/1] overflow-hidden bg-[#e5effc]" aria-label={`Read ${guide.title}`}>
                    <Image src={photo(guide.image)} alt={guide.alt} fill sizes="(max-width: 640px) 90vw, (max-width: 1024px) 45vw, 22vw" className="object-cover transition-transform duration-500 group-hover:scale-[1.035]" />
                  </Link>
                  <div className="flex flex-1 flex-col p-5">
                    <p className="text-[10px] font-extrabold uppercase tracking-[0.17em] text-indigo">{guide.category}</p>
                    <h3 className="mt-3 font-serif text-[1.45rem] font-semibold leading-[1.1] tracking-[-0.025em] text-navy">
                      <Link href={`/resources/${guide.slug}`} className="hover:text-indigo">{guide.title}</Link>
                    </h3>
                    <p className="mt-3 flex-1 text-sm leading-6 text-ink-muted">{guide.dek}</p>
                    <Link href={`/resources/${guide.slug}`} className="mt-5 inline-flex min-h-9 items-center self-start text-sm font-bold text-indigo underline-offset-4 hover:underline">Read guide <span aria-hidden="true" className="ml-1">↗</span></Link>
                  </div>
                </article>
              </Reveal>
            ))}
          </div>
        </Container>
      </section>

      <section id="about" className="scroll-mt-24 overflow-hidden bg-[#fffcf8] py-16 sm:py-24" aria-labelledby="preview-title">
        <Container>
          <div className="grid items-center gap-10 lg:grid-cols-[0.72fr_1.28fr] lg:gap-16">
            <Reveal className="max-w-[29rem]">
              <p className="landing-handwriting text-lg text-indigo">A little less guesswork</p>
              <h2 id="preview-title" className="mt-3 font-serif text-[clamp(2.65rem,4.8vw,4.65rem)] font-semibold leading-[1.04] tracking-[-0.05em] text-navy">See your journey clearly.</h2>
              <p className="mt-5 text-base leading-7 text-ink-muted">Keep track of your applications, return to roles you have saved and build a profile that tells your story. One place for the work ahead.</p>
              <Button href="/signup" className="mt-7">Create your profile ↗</Button>
            </Reveal>
            <Reveal delay={0.08} className="min-w-0">
              <div className="landing-dashboard overflow-hidden rounded-[1.75rem] border border-[#d9e5f5] bg-white shadow-[0_24px_70px_rgb(9_40_91_/_0.11)]" aria-label="Illustrative preview of the SapienWorx candidate dashboard">
                <div className="flex items-center justify-between gap-3 border-b border-[#e5ebf4] px-5 py-4 sm:px-7">
                  <span className="text-sm font-extrabold text-navy">SapienWorx <span className="ml-1 text-[10px] font-medium text-ink-muted">/ Candidate workspace</span></span>
                  <span className="rounded-full bg-[#ecf6f0] px-3 py-1 text-[10px] font-semibold text-[#237956]">Your space</span>
                </div>
                <div className="grid min-w-0 sm:grid-cols-[9.5rem_minmax(0,1fr)]">
                  <div className="hidden border-r border-[#e6edf7] bg-[#f7faff] p-4 sm:block" aria-hidden="true">
                    <div className="rounded-lg bg-[#e7f0ff] px-3 py-3 text-xs font-bold text-indigo">⌂ &nbsp; Overview</div>
                    <div className="mt-2 px-3 py-3 text-xs text-ink-muted">⌕ &nbsp; Find jobs</div>
                    <div className="mt-2 px-3 py-3 text-xs text-ink-muted">▤ &nbsp; Applications</div>
                    <div className="mt-2 px-3 py-3 text-xs text-ink-muted">♡ &nbsp; Saved jobs</div>
                  </div>
                  <div className="min-w-0 p-5 sm:p-6">
                    <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-indigo">Your journey, at a glance</p>
                    <h3 className="mt-1 font-serif text-2xl font-semibold text-navy">Make room for what is next.</h3>
                    <div className="mt-5 grid gap-3 sm:grid-cols-3">
                      {[["01", "Discover roles"], ["02", "Save favourites"], ["03", "Track progress"]].map(([number, label]) => (
                        <div key={number} className="rounded-xl border border-[#e2eaf5] bg-[#f7faff] p-3">
                          <p className="font-serif text-2xl text-indigo">{number}</p>
                          <p className="mt-1 text-xs font-bold leading-5 text-navy">{label}</p>
                        </div>
                      ))}
                    </div>
                    <div className="mt-4 rounded-xl border border-[#e2eaf5] p-4">
                      <div className="flex items-center justify-between gap-3"><span className="text-sm font-bold text-navy">Build your profile</span><span className="text-[10px] font-bold text-[#258764]">At your pace</span></div>
                      <p className="mt-2 text-xs leading-5 text-ink-muted">Skills, experience and the kind of work you want.</p>
                      <div className="mt-4 h-2 rounded-full bg-[#edf1f6]"><div className="h-full w-2/3 rounded-full bg-indigo" /></div>
                    </div>
                  </div>
                </div>
                <p className="border-t border-[#e6edf7] px-5 py-2 text-[10px] text-ink-muted sm:px-7">Illustrative product preview · Not live account data</p>
              </div>
            </Reveal>
          </div>
        </Container>
      </section>

      <section className="bg-[#fffcf8] pb-14 pt-2 sm:pb-20" aria-labelledby="final-title">
        <Container>
          <Reveal>
            <div className="relative isolate overflow-hidden rounded-[2rem] bg-[#071d49] px-6 py-14 text-center text-white sm:px-12 sm:py-20">
              <div className="pointer-events-none absolute -left-20 top-0 size-72 rounded-full bg-indigo/30 blur-3xl" aria-hidden="true" />
              <div className="pointer-events-none absolute -right-20 -bottom-20 size-80 rounded-full bg-[#aa8098]/25 blur-3xl" aria-hidden="true" />
              <div className="relative z-10">
                <p className="landing-handwriting text-xl text-[#c2d9ff]">A more human way to work</p>
                <h2 id="final-title" className="mx-auto mt-4 max-w-[46rem] text-balance font-serif text-[clamp(2.7rem,5.5vw,5rem)] font-semibold leading-[1.04] tracking-[-0.048em]">Your next chapter starts here.</h2>
                <p className="mx-auto mt-5 max-w-xl text-base leading-7 text-white/75">You bring the potential. We will help you find the possibilities.</p>
                <div className="mt-8 flex flex-wrap justify-center gap-3">
                  <Button href="/signup" className="landing-final-cta min-h-12 px-7">Create account ↗</Button>
                  <Button href="/jobs" className="min-h-12 border border-white/45 bg-transparent px-7 text-white shadow-none hover:bg-white/10">Explore jobs</Button>
                </div>
              </div>
            </div>
          </Reveal>
        </Container>
      </section>
      <PublicFooter />
    </main>
  );
}
