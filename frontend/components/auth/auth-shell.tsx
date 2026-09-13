import { HumanSignal } from "@/components/brand/human-signal";
import { Wordmark } from "@/components/brand/wordmark";

export function AuthShell({ eyebrow, title, description, children, tone = "lavender" }: { eyebrow: string; title: string; description: string; children: React.ReactNode; tone?: "lavender" | "mint" | "peach" }) {
  const toneClass = tone === "mint" ? "bg-mint/45" : tone === "peach" ? "bg-peach/45" : "bg-lavender/55";
  return (
    <main className="min-h-screen px-4 py-6 sm:px-6 lg:px-8">
      <div className="mx-auto grid min-h-[calc(100vh-3rem)] max-w-6xl overflow-hidden rounded-[2rem] border border-white/80 bg-white/80 shadow-soft lg:grid-cols-[0.95fr_1.05fr]">
        <section className={`${toneClass} relative hidden overflow-hidden p-10 lg:flex lg:flex-col lg:justify-between`}>
          <Wordmark />
          <div className="relative z-10 max-w-md">
            <p className="mb-4 text-sm font-bold uppercase tracking-[0.18em] text-indigo">{eyebrow}</p>
            <h1 className="text-5xl font-semibold leading-[1.03] tracking-[-0.04em] text-ink">{title}</h1>
            <p className="mt-5 max-w-sm text-base leading-7 text-ink-muted">{description}</p>
          </div>
          <HumanSignal className="absolute -bottom-24 -right-24 h-[34rem] w-[34rem] opacity-55" />
          <p className="relative z-10 text-xs text-ink-muted">Smarter Hiring. Better Talent. Faster Growth.</p>
        </section>
        <section className="flex items-center justify-center p-6 sm:p-10 lg:p-14">
          <div className="w-full max-w-md">
            <div className="mb-8 lg:hidden"><Wordmark /></div>
            {children}
          </div>
        </section>
      </div>
    </main>
  );
}
