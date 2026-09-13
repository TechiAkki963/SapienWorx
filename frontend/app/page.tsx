import { HumanSignal } from "@/components/brand/human-signal";
import { OrganicPortrait } from "@/components/brand/organic-portrait";
import { Container } from "@/components/layout/container";
import { Reveal } from "@/components/motion/reveal";
import { FloatingProductCard } from "@/components/product/floating-product-card";
import { PublicFooter } from "@/components/site/public-footer";
import { PublicHeader } from "@/components/site/public-header";
import { Button } from "@/components/ui/button";
import { Surface } from "@/components/ui/surface";

const illustrativeRoles = [
  { title: "Backend Engineer", context: "Product company · Hybrid", detail: "Go · PostgreSQL · APIs", tone: "mint" as const },
  { title: "Product Designer", context: "Growth team · Remote", detail: "Research · Systems · UI", tone: "lavender" as const },
  { title: "Data Engineer", context: "Analytics team · On-site", detail: "Python · SQL · Pipelines", tone: "peach" as const },
];

export default function HomePage() {
  return (
    <main id="main-content" className="min-h-screen overflow-hidden">
      <PublicHeader />
      <Container>
        <section className="grid items-center gap-12 py-10 md:min-h-[46rem] md:grid-cols-[1.04fr_0.96fr] md:py-16">
          <Reveal className="relative z-10">
            <div className="inline-flex items-center gap-2 rounded-full border border-indigo/10 bg-indigo-soft/55 px-3 py-1.5 text-xs font-bold uppercase tracking-[0.14em] text-violet-ink"><span className="h-2 w-2 rounded-full bg-indigo" />Candidate-first job discovery</div>
            <h1 className="mt-6 max-w-3xl text-balance text-[clamp(3rem,7vw,6rem)] font-bold leading-[0.92] tracking-[-0.065em] text-ink">Find work where your human signal matters.</h1>
            <p className="mt-6 max-w-xl text-pretty text-base leading-7 text-ink-muted md:text-lg">Search real published roles, keep applications in one clear tracker, and build a profile that helps recruiters understand the person behind the résumé.</p>
            <form action="/jobs" className="mt-8 grid gap-2 rounded-[1.6rem] border border-white/90 bg-white/88 p-2 shadow-card sm:grid-cols-[1fr_0.8fr_auto]" role="search">
              <label className="sr-only" htmlFor="home-q">Job title or skill</label>
              <input id="home-q" name="q" className="min-h-12 rounded-xl bg-canvas px-4 text-sm text-ink outline-none placeholder:text-ink-muted/70 focus:ring-2 focus:ring-indigo/25" placeholder="Job title or skill" />
              <label className="sr-only" htmlFor="home-location">Location</label>
              <input id="home-location" name="location" className="min-h-12 rounded-xl bg-canvas px-4 text-sm text-ink outline-none placeholder:text-ink-muted/70 focus:ring-2 focus:ring-indigo/25" placeholder="Mumbai, Pune, Remote" />
              <button className="min-h-12 rounded-xl bg-indigo px-6 text-sm font-bold text-white shadow-sm transition hover:bg-violet-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo focus-visible:ring-offset-2" type="submit">Find jobs</button>
            </form>
            <div className="mt-5 flex flex-wrap items-center gap-x-5 gap-y-2 text-sm text-ink-muted"><span>✓ No AI-generated match score</span><span>✓ Transparent application stages</span><span>✓ Candidate-owned profile</span></div>
          </Reveal>

          <Reveal className="relative mx-auto w-full max-w-[35rem]" delay={0.08}>
            <div className="human-grid relative isolate aspect-square rounded-[3rem] bg-white/35 p-7 md:p-10">
              <OrganicPortrait className="mx-auto w-[72%]" />
              <HumanSignal className="absolute -right-20 -top-16 -z-10 w-64 text-indigo/30" />
              <FloatingProductCard className="absolute -left-2 top-[12%] md:-left-12" eyebrow="Your search" title="Roles ordered by location + recency" tone="mint" />
              <FloatingProductCard className="absolute -bottom-3 right-0 md:-right-8" eyebrow="Application tracker" title="One clear stage at a time" tone="peach" />
            </div>
          </Reveal>
        </section>

        <section className="py-12" aria-labelledby="candidate-control-title">
          <Reveal>
            <Surface className="relative overflow-hidden p-7 sm:p-10" tone="lavender">
              <div className="relative z-10 grid gap-8 lg:grid-cols-[1fr_1.15fr] lg:items-center">
                <div><p className="text-xs font-bold uppercase tracking-[0.16em] text-violet-ink">Built around the candidate</p><h2 id="candidate-control-title" className="mt-3 text-3xl font-bold tracking-[-0.04em] sm:text-4xl">Less application fog. More useful context.</h2><p className="mt-4 max-w-xl text-sm leading-7 text-ink-muted">SapienWorx keeps discovery, saved roles, profile progress, notifications and application status together. Recruiter tools stay in a separate workspace so the candidate experience never feels like an ATS screen.</p><div className="mt-6"><Button href="/signup">Create your profile</Button></div></div>
                <div className="grid gap-3 sm:grid-cols-2">
                  {[['Discover','Search published roles by title, company, location and work mode.'],['Track','See every application in a simple stage-based list — no mystery status.'],['Save','Bookmark roles without losing your search flow.'],['Improve','Use profile strength as a practical checklist, not an opaque score.']].map(([title,body]) => <div key={title} className="rounded-[1.3rem] border border-white/80 bg-white/68 p-5"><h3 className="font-bold text-ink">{title}</h3><p className="mt-2 text-sm leading-6 text-ink-muted">{body}</p></div>)}
                </div>
              </div>
              <HumanSignal className="pointer-events-none absolute -bottom-44 -left-28 w-[26rem] text-indigo/10" title="" />
            </Surface>
          </Reveal>
        </section>

        <section id="how-it-works" className="scroll-mt-24 py-16" aria-labelledby="how-title">
          <Reveal><div className="max-w-2xl"><p className="text-xs font-bold uppercase tracking-[0.16em] text-violet-ink">How it works</p><h2 id="how-title" className="mt-3 text-4xl font-bold tracking-[-0.045em]">A calmer path from search to offer.</h2></div></Reveal>
          <div className="mt-8 grid gap-4 md:grid-cols-3">
            {[['01','Find the signal','Search only active roles and filter for how and where you want to work.'],['02','Keep context','Save roles, apply once, and see the application move through a transparent stage.'],['03','Build momentum','Complete your profile and use notifications to follow meaningful changes.']].map(([number,title,body],index) => <Reveal key={number} delay={index*0.05}><Surface className="h-full p-6"><span className="text-3xl font-bold text-indigo/35">{number}</span><h3 className="mt-7 text-xl font-bold text-ink">{title}</h3><p className="mt-3 text-sm leading-6 text-ink-muted">{body}</p></Surface></Reveal>)}
          </div>
        </section>

        <section className="py-14" aria-labelledby="preview-title">
          <Reveal><div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end"><div><p className="text-xs font-bold uppercase tracking-[0.16em] text-violet-ink">Illustrative discovery preview</p><h2 id="preview-title" className="mt-3 text-4xl font-bold tracking-[-0.045em]">The role, not the noise.</h2></div><Button href="/jobs" variant="secondary">Browse live jobs →</Button></div></Reveal>
          <p className="mt-3 max-w-2xl text-sm leading-6 text-ink-muted">These cards demonstrate the interface only; they are not employer listings. The jobs page reads active roles from SapienWorx PostgreSQL.</p>
          <div className="mt-7 grid gap-4 lg:grid-cols-3">
            {illustrativeRoles.map((role,index) => <Reveal key={role.title} delay={index*0.05}><Surface className="h-full p-6" tone={role.tone}><p className="text-xs font-bold uppercase tracking-[0.14em] text-indigo">Example role</p><h3 className="mt-3 text-2xl font-bold tracking-[-0.03em]">{role.title}</h3><p className="mt-2 text-sm text-ink-muted">{role.context}</p><p className="mt-8 rounded-full bg-white/65 px-4 py-2 text-sm font-semibold text-ink">{role.detail}</p></Surface></Reveal>)}
          </div>
        </section>

        <section className="py-14">
          <Reveal><div className="grid overflow-hidden rounded-[2.3rem] border border-white/80 bg-ink text-white shadow-soft lg:grid-cols-[1fr_auto]"><div className="p-8 sm:p-10"><p className="text-xs font-bold uppercase tracking-[0.16em] text-lavender">For candidates first</p><h2 className="mt-3 max-w-2xl text-4xl font-bold tracking-[-0.045em]">Ready to make your next move easier to see?</h2><p className="mt-4 max-w-xl text-sm leading-6 text-white/70">Create a profile, verify your mobile number, then use one workspace for your search and applications.</p><div className="mt-7 flex flex-wrap gap-3"><Button href="/signup" className="bg-white text-ink hover:bg-lavender">Create profile</Button><Button href="/login" variant="secondary">Sign in</Button></div></div><div className="hidden w-72 items-center justify-center bg-indigo-soft lg:flex"><HumanSignal className="w-56 text-indigo" /></div></div></Reveal>
        </section>
      </Container>
      <PublicFooter />
    </main>
  );
}
