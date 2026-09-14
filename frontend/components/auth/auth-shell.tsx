import Image from "next/image";
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
  features?: Feature[];
  image?: string;
  imageAlt?: string;
  panelLabel?: string;
  reverseOnDesktop?: boolean;
  tone?: "lavender" | "mint" | "peach";
};

const toneOverlay = {
  lavender: "from-violet-200/20 via-transparent to-indigo-100/20",
  mint: "from-emerald-100/22 via-transparent to-cyan-100/14",
  peach: "from-orange-100/22 via-transparent to-rose-100/14",
};

export function AuthShell({
  eyebrow,
  title,
  description,
  children,
  features = [],
  image,
  imageAlt = "",
  panelLabel = "A more human way to work",
  reverseOnDesktop = false,
  tone = "lavender",
}: AuthShellProps) {
  return (
    <main className="min-h-screen bg-[#f6f9fe] p-3 sm:p-5 lg:p-6">
      <div className="mx-auto grid min-h-[calc(100vh-1.5rem)] max-w-[96rem] overflow-hidden rounded-[2rem] border border-[#e3edf8] bg-white shadow-[0_24px_80px_rgba(8,43,91,0.10)] sm:min-h-[calc(100vh-2.5rem)] lg:grid-cols-2">
        <section
          className={`${reverseOnDesktop ? "lg:order-2" : ""} relative hidden min-h-[46rem] overflow-hidden bg-[#edf5ff] lg:flex lg:flex-col lg:justify-between`}
          aria-label="SapienWorx product benefits"
        >
          {image ? (
            <div className="absolute inset-0 overflow-hidden bg-[linear-gradient(145deg,#eef5ff_0%,#f3eefc_52%,#edf9f4_100%)]">
              <div className="absolute -left-16 top-8 h-64 w-64 rounded-full bg-[#dff5ea] blur-3xl" aria-hidden="true" />
              <div className="absolute -right-12 bottom-16 h-72 w-72 rounded-full bg-[#e8ddfb] blur-3xl" aria-hidden="true" />
              <div className="absolute inset-5 overflow-hidden rounded-[42%_58%_62%_38%/35%_46%_54%_65%] shadow-[0_28px_70px_rgba(35,52,91,0.18)] xl:inset-7">
                <Image
                  src={image}
                  alt={imageAlt}
                  fill
                  priority
                  sizes="50vw"
                  className="object-cover object-center"
                />
                <div className={`absolute inset-0 bg-gradient-to-br ${toneOverlay[tone]} mix-blend-overlay`} aria-hidden="true" />
                <div className="absolute inset-0 bg-gradient-to-b from-[#071d49]/5 via-transparent to-[#071d49]/76" aria-hidden="true" />
              </div>
            </div>
          ) : (
            <div className="absolute inset-0 bg-gradient-to-br from-[#0b67e8] via-[#0b4ba9] to-[#071d49]" aria-hidden="true" />
          )}

          <div className="relative z-10 flex items-center justify-between p-8 xl:p-10">
            <Link href="/" aria-label="SapienWorx home" className="rounded-full bg-white/92 px-4 py-2 shadow-sm backdrop-blur">
              <Wordmark className="text-lg" />
            </Link>
            <span className="rounded-full border border-white/55 bg-white/22 px-4 py-2 text-xs font-bold uppercase tracking-[0.16em] text-white shadow-sm backdrop-blur-md">
              {eyebrow}
            </span>
          </div>

          <HumanSignal className="pointer-events-none absolute -right-12 top-24 z-10 w-48 text-white/16" title="" />

          <div className="relative z-10 p-8 text-white xl:p-10">
            <div className="max-w-[38rem] rounded-[2rem] border border-white/16 bg-[#071d49]/36 p-6 shadow-[0_18px_44px_rgba(7,29,73,0.18)] backdrop-blur-md xl:p-7">
              <p className="text-xs font-extrabold uppercase tracking-[0.18em] text-[#cfe2ff]">{panelLabel}</p>
              <h1 className="mt-4 max-w-xl text-balance text-[clamp(2.75rem,4vw,4.8rem)] font-bold leading-[0.98] tracking-[-0.055em]">
                {title}
              </h1>
              <p className="mt-5 max-w-lg text-sm leading-7 text-white/78 xl:text-base">{description}</p>

              {features.length > 0 && (
                <div className="mt-8 grid gap-3 sm:grid-cols-2">
                  {features.map((feature) => (
                    <div key={feature.title} className="rounded-[1.25rem] border border-white/16 bg-white/10 p-4 backdrop-blur-md">
                      <div className="mb-3 flex h-7 w-7 items-center justify-center rounded-full bg-white/92 text-xs font-black text-indigo">✓</div>
                      <h2 className="text-sm font-bold text-white">{feature.title}</h2>
                      <p className="mt-1.5 text-xs leading-5 text-white/70">{feature.body}</p>
                    </div>
                  ))}
                </div>
              )}

              <p className="mt-8 text-xs font-medium text-white/64">People. Work. Forward.</p>
            </div>
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
