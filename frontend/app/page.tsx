import { HumanSignal } from "@/components/brand/human-signal";
import { OrganicPortrait } from "@/components/brand/organic-portrait";
import { Wordmark } from "@/components/brand/wordmark";
import { Container } from "@/components/layout/container";
import { Reveal } from "@/components/motion/reveal";
import { FloatingProductCard } from "@/components/product/floating-product-card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Surface } from "@/components/ui/surface";

export default function DesignSystemPreviewPage() {
  return (
    <main id="main-content" className="min-h-screen overflow-hidden pb-24">
      <Container>
        <header className="flex min-h-20 items-center justify-between gap-4 py-4">
          <Wordmark className="text-lg" />
          <div className="flex items-center gap-2">
            <Button href="#components" size="sm" variant="ghost">
              Components
            </Button>
            <Button href="#foundation" size="sm" variant="secondary">
              Design foundation
            </Button>
          </div>
        </header>

        <section className="grid items-center gap-10 py-10 md:min-h-[42rem] md:grid-cols-[1.05fr_0.95fr] md:py-16">
          <Reveal className="relative z-10">
            <div className="mb-5 inline-flex items-center gap-2 rounded-full border border-indigo/10 bg-indigo-soft/55 px-3 py-1.5 text-xs font-bold uppercase tracking-[0.14em] text-violet-ink">
              <span className="h-2 w-2 rounded-full bg-indigo" aria-hidden="true" />
              Phase 3 design system
            </div>
            <h1 className="max-w-3xl text-balance text-[clamp(2.7rem,7vw,5.7rem)] font-bold leading-[0.93] tracking-[-0.065em] text-ink">
              Human-first design, built for serious hiring.
            </h1>
            <p className="mt-6 max-w-xl text-pretty text-base leading-7 text-ink-muted md:text-lg">
              Soft, expressive candidate experiences meet dense recruiter workflows through one responsive visual system.
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <Button href="#components" size="lg">
                Explore components
                <span aria-hidden="true">→</span>
              </Button>
              <Button href="#foundation" size="lg" variant="secondary">
                View tokens
              </Button>
            </div>
          </Reveal>

          <Reveal className="relative mx-auto w-full max-w-[34rem]" delay={0.08}>
            <div className="human-grid relative isolate aspect-square rounded-[3rem] bg-white/35 p-7 md:p-10">
              <OrganicPortrait className="mx-auto w-[72%]" />
              <HumanSignal className="absolute -right-20 -top-16 -z-10 w-64 text-indigo/30" />
              <FloatingProductCard
                className="absolute -left-4 top-[15%] md:-left-14"
                eyebrow="Job match"
                metric="92%"
                title="Senior Product Designer"
                tone="mint"
              />
              <FloatingProductCard
                className="absolute -bottom-4 right-0 md:-right-10"
                eyebrow="Application"
                title="Interview confirmed · Tuesday"
                tone="peach"
              />
            </div>
          </Reveal>
        </section>

        <section id="foundation" className="scroll-mt-8 py-12">
          <Reveal>
            <div className="mb-7 flex flex-col justify-between gap-3 sm:flex-row sm:items-end">
              <div>
                <p className="text-xs font-bold uppercase tracking-[0.16em] text-violet-ink">Foundation</p>
                <h2 className="mt-2 text-3xl font-bold tracking-[-0.04em] md:text-4xl">One palette, different working modes.</h2>
              </div>
              <p className="max-w-md text-sm leading-6 text-ink-muted">
                Candidate surfaces can breathe. Recruiter surfaces can tighten density while reusing the same tokens and interaction rules.
              </p>
            </div>
          </Reveal>

          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {[
              ["Soft indigo", "bg-indigo-soft", "Primary focus & identity"],
              ["Lavender", "bg-lavender", "Calm hierarchy"],
              ["Mint", "bg-mint", "Positive progress"],
              ["Peach", "bg-peach", "Human warmth"],
            ].map(([name, color, purpose], index) => (
              <Reveal delay={index * 0.04} key={name}>
                <Surface className="h-full p-4">
                  <div className={`h-28 rounded-2xl ${color}`} />
                  <p className="mt-4 font-semibold">{name}</p>
                  <p className="mt-1 text-sm text-ink-muted">{purpose}</p>
                </Surface>
              </Reveal>
            ))}
          </div>
        </section>

        <section id="components" className="scroll-mt-8 py-12">
          <Reveal>
            <Surface className="grid gap-8 p-5 md:grid-cols-[0.9fr_1.1fr] md:p-8" tone="white">
              <div>
                <p className="text-xs font-bold uppercase tracking-[0.16em] text-violet-ink">Core controls</p>
                <h2 className="mt-2 text-3xl font-bold tracking-[-0.04em]">Accessible by default.</h2>
                <p className="mt-3 max-w-md text-sm leading-6 text-ink-muted">
                  Controls use large touch targets, visible focus states, restrained motion, semantic labels and reduced-motion support.
                </p>
                <div className="mt-6 flex flex-wrap gap-3">
                  <Button>Primary action</Button>
                  <Button variant="secondary">Secondary</Button>
                  <Button variant="ghost">Quiet action</Button>
                </div>
              </div>
              <div className="grid content-start gap-4 rounded-[1.5rem] bg-canvas p-5">
                <Input label="Job title or skill" placeholder="e.g. Go developer" hint="Search patterns will be wired in the candidate portal phase." />
                <Input label="Preferred location" placeholder="Mumbai, Pune, Remote" />
              </div>
            </Surface>
          </Reveal>
        </section>
      </Container>
    </main>
  );
}
