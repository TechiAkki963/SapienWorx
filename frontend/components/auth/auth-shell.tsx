import { OrganicPortrait } from "@/components/brand/organic-portrait";
import { HumanSignal } from "@/components/brand/human-signal";
import { Wordmark } from "@/components/brand/wordmark";
import { FloatingQuoteCard, FloatingStatCard } from "@/components/product/floating-product-card";

export function AuthShell({ eyebrow, title, description, children, tone = "lavender" }: { eyebrow: string; title: string; description: string; children: React.ReactNode; tone?: "lavender" | "mint" | "peach" }) {
  const toneClass = tone === "mint" ? "bg-mint/45" : tone === "peach" ? "bg-peach/45" : "bg-lavender/55";
  const shape = tone === "mint" ? "blob-b" as const : tone === "peach" ? "blob-c" as const : "blob-a" as const;
  const recruiter = eyebrow.toLowerCase().includes("recruit");

  return (
    <main className="min-h-screen px-3 py-3 sm:px-6 sm:py-6 lg:px-8">
      <div className="mx-auto grid min-h-[calc(100vh-1.5rem)] max-w-6xl overflow-hidden rounded-[1.7rem] border border-white/80 bg-white/82 shadow-float sm:min-h-[calc(100vh-3rem)] sm:rounded-[2rem] lg:grid-cols-[0.98fr_1.02fr]">
        <section className={`${toneClass} relative hidden overflow-hidden p-8 lg:flex lg:flex-col`}>
          <Wordmark />
          <div className="relative mx-auto mt-8 w-full max-w-[23rem]">
            <OrganicPortrait alt={recruiter ? "Recruiter reviewing candidate work" : "Candidate working on their next opportunity"} frame={tone === "peach" ? "clay" : "indigo"} shape={shape} src={recruiter ? "/brand/portrait-recruiter.svg" : "/brand/portrait-candidate.svg"} />
            {recruiter ? <FloatingStatCard className="absolute -bottom-3 -right-5" label="Hiring rhythm" value="3 day shortlist" tone="peach" rotate="right" /> : <FloatingQuoteCard className="absolute -bottom-3 -right-5" quote="I could finally see where my application stood." tone="mint" rotate="right" />}
          </div>
          <div className="relative z-10 mt-auto pt-10">
            <p className="mb-3 text-xs font-bold uppercase tracking-[0.18em] text-indigo">{eyebrow}</p>
            <h1 className="font-display max-w-lg text-4xl font-bold leading-[1.02] tracking-[-0.035em] text-ink">{title}</h1>
            <p className="mt-4 max-w-md text-sm leading-6 text-ink-muted">{description}</p>
          </div>
          <HumanSignal className="pointer-events-none absolute -bottom-44 -left-36 h-[28rem] w-[28rem] text-indigo opacity-[0.06]" title="" />
        </section>
        <section className="flex items-center justify-center p-5 sm:p-10 lg:p-14">
          <div className="w-full max-w-md">
            <div className="mb-7 lg:hidden"><Wordmark /></div>
            {children}
          </div>
        </section>
      </div>
    </main>
  );
}
