import Link from "next/link";

import { HumanSignal } from "@/components/brand/human-signal";
import { Wordmark } from "@/components/brand/wordmark";

type Feature = {
  title: string;
  body: string;
};

type AuthShellProps = {
  eyebrow: string;
  title: string;
  description: string;
  children: React.ReactNode;
  features: Feature[];
  image: string;
  imageAlt: string;
  panelLabel?: string;
  reverseOnDesktop?: boolean;
};

export function AuthShell({
  eyebrow,
  title,
  description,
  children,
  features,
  image,
  imageAlt,
  panelLabel = "A more human way to work",
  reverseOnDesktop = false,
}: AuthShellProps) {
  return (
    <main className="min-h-screen bg-[#f6f9fe] p-3 sm:p-5 lg:p-6">
      <div className="mx-auto grid min-h-[calc(100vh-1.5rem)] max-w-[96rem] overflow-hidden rounded-[2rem] border border-[#e3edf8] bg-white shadow-[0_24px_80px_rgba(8,43,91,0.10)] sm:min-h-[calc(100vh-2.5rem)] lg:grid-cols-2">
        <section
          className={`${reverseOnDesktop ? "lg:order-2" : ""} relative hidden min-h-[46rem] overflow-hidden bg-[#edf5ff] lg:flex lg:flex-col lg:justify-between`}
          aria-label="SapienWorx product benefits"
        >
          <div className="absolute inset-0">
            <img src={image} alt={imageAlt} className="h-full w-full object-cover" />
            <div className="absolute inset-0 bg-gradient-to-b from-[#071d49]/10 via-transparent to-[#071d49]/78" aria-hidden="true" />
            <div className="absolute inset-0 bg-gradient-to-r from-[#071d49]/22 via-transparent to-transparent" aria-hidden="true" />
          </div>

          <div className="relative z-10 flex items-center justify-between p-8 xl:p-10">
            <Link href="/" aria-label="SapienWorx home" className="rounded-full bg-white/92 px-4 py-2 shadow-sm backdrop-blur">
              <Wordmark className="text-lg" />
            </Link>
            <span className="rounded-full border border-white/40 bg-white/16 px-4 py-2 text-xs font-bold uppercase tracking-[0.16em] text-white backdrop-blur-md">
              {eyebrow}
            </span>
          </div>

          <HumanSignal className="pointer-events-none absolute -right-12 top-24 z-10 w-48 text-white/16" title="" />

          <div className="relative z-10 p-8 text-white xl:p-10">
            <p className="text-xs font-extrabold uppercase tracking-[0.18em] text-[#a9d0ff]">{panelLabel}</p>
            <h1 className="mt-4 max-w-xl text-balance text-[clamp(2.75rem,4vw,4.8rem)] font-bold leading-[0.98] tracking-[-0.055em]">
              {title}
            </h1>
            <p className="mt-5 max-w-lg text-sm leading-7 text-white/76 xl:text-base">{description}</p>

            <div className="mt-8 grid gap-3 sm:grid-cols-2">
              {features.map((feature) => (
                <div key={feature.title} className="rounded-[1.25rem] border border-white/16 bg-[#061b3a]/38 p-4 backdrop-blur-md">
                  <div className="mb-3 flex h-7 w-7 items-center justify-center rounded-full bg-[#0866ff] text-xs font-black text-white">✓</div>
                  <h2 className="text-sm font-bold text-white">{feature.title}</h2>
                  <p className="mt-1.5 text-xs leading-5 text-white/68">{feature.body}</p>
                </div>
              ))}
            </div>

            <p className="mt-8 text-xs font-medium text-white/58">People. Work. Forward.</p>
          </div>
        </section>

        <section className={`${reverseOnDesktop ? "lg:order-1" : ""} flex min-h-[42rem] items-center justify-center bg-white p-6 sm:p-10 lg:p-12 xl:p-16`}>
          <div className="w-full max-w-[31rem]">
            <div className="mb-10 flex items-center justify-between gap-4 lg:hidden">
              <Link href="/" aria-label="SapienWorx home"><Wordmark /></Link>
              <span className="rounded-full bg-indigo-soft px-3 py-1.5 text-[0.68rem] font-bold uppercase tracking-[0.14em] text-indigo">{eyebrow}</span>
            </div>
            {children}
          </div>
        </section>
      </div>
    </main>
  );
}
