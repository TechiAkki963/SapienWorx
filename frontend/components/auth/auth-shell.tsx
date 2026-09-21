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
  imageMode?: "cover" | "contain";
  showImageOnMobile?: boolean;
  panelLabel?: string;
  reverseOnDesktop?: boolean;
  tone?: "lavender" | "mint" | "peach";
};

const toneSurface = {
  lavender: "bg-[#f2f5ff]",
  mint: "bg-[#eef9f5]",
  peach: "bg-[#fff5ef]",
};

const toneAccent = {
  lavender: "bg-[#e5eaff] text-[#4251b8]",
  mint: "bg-[#dff4ea] text-[#17684d]",
  peach: "bg-[#ffe7da] text-[#a14c2f]",
};

export function AuthShell({
  eyebrow,
  title,
  description,
  children,
  features = [],
  image,
  imageAlt = "",
  imageMode = "cover",
  showImageOnMobile = false,
  panelLabel = "A more human way to work",
  reverseOnDesktop = false,
  tone = "lavender",
}: AuthShellProps) {
  return (
    <main className="min-h-screen bg-[#f5f8fd] p-3 sm:p-5 lg:p-6">
      <div className="mx-auto grid min-h-[calc(100vh-1.5rem)] max-w-[96rem] overflow-hidden rounded-[2rem] border border-[#dfe8f4] bg-white shadow-[0_28px_90px_rgba(8,43,91,0.11)] sm:min-h-[calc(100vh-2.5rem)] lg:grid-cols-[1.04fr_0.96fr]">
        <section
          className={`${reverseOnDesktop ? "lg:order-2" : ""} ${toneSurface[tone]} relative hidden min-h-[46rem] overflow-hidden lg:grid lg:grid-rows-[minmax(25rem,58vh)_1fr]`}
          aria-label="SapienWorx product benefits"
        >
          <div className="relative min-h-0 overflow-hidden bg-[#eaf2fb]">
            {image ? (
              <Image
                src={image}
                alt={imageAlt}
                fill
                priority
                sizes="(min-width: 1024px) 52vw, 100vw"
                className={imageMode === "contain"
                  ? "object-contain object-bottom px-8 pt-20 [image-rendering:auto] xl:px-12 xl:pt-24"
                  : "object-cover object-center [image-rendering:auto]"}
              />
            ) : (
              <div className="absolute inset-0 bg-gradient-to-br from-[#0b67e8] via-[#0b4ba9] to-[#071d49]" aria-hidden="true" />
            )}

            <div className="pointer-events-none absolute inset-x-0 bottom-0 h-28 bg-gradient-to-t from-[#071d49]/18 to-transparent" aria-hidden="true" />

            <div className="absolute inset-x-0 top-0 z-10 flex items-center justify-between gap-4 p-7 xl:p-9">
              <Link href="/" aria-label="SapienWorx home" className="rounded-full border border-white/70 bg-white/95 px-4 py-2 shadow-[0_8px_28px_rgba(7,29,73,0.10)]">
                <Wordmark className="text-lg" />
              </Link>
              <span className="rounded-full border border-white/75 bg-white/95 px-4 py-2 text-[11px] font-extrabold uppercase tracking-[0.16em] text-navy shadow-[0_8px_28px_rgba(7,29,73,0.10)]">
                {eyebrow}
              </span>
            </div>

            <HumanSignal className="pointer-events-none absolute -right-10 bottom-3 z-10 w-40 text-white/28" title="" />
          </div>

          <div className="relative flex min-h-0 flex-col justify-center px-8 py-8 xl:px-11 xl:py-10">
            <div className="max-w-[42rem]">
              <span className={`inline-flex rounded-full px-3 py-1.5 text-[11px] font-extrabold uppercase tracking-[0.16em] ${toneAccent[tone]}`}>
                {panelLabel}
              </span>
              <h1 className="mt-4 max-w-[40rem] text-balance font-serif text-[clamp(2.35rem,3.4vw,4rem)] font-semibold leading-[0.98] tracking-[-0.05em] text-navy">
                {title}
              </h1>
              <p className="mt-4 max-w-[38rem] text-sm leading-6 text-ink-muted xl:text-[15px] xl:leading-7">{description}</p>

              {features.length > 0 && (
                <div className="mt-6 grid gap-x-6 gap-y-4 sm:grid-cols-2">
                  {features.map((feature) => (
                    <div key={feature.title} className="grid grid-cols-[auto_1fr] gap-3 border-t border-[#d8e3f0] pt-4">
                      <div className="mt-0.5 flex h-6 w-6 items-center justify-center rounded-full bg-white text-[10px] font-black text-indigo shadow-sm">✓</div>
                      <div>
                        <h2 className="text-[13px] font-extrabold text-navy">{feature.title}</h2>
                        <p className="mt-1 text-[12px] leading-5 text-ink-muted">{feature.body}</p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </section>

        <section className={`${reverseOnDesktop ? "lg:order-1" : ""} flex min-h-[42rem] items-center justify-center bg-white p-6 sm:p-10 lg:p-12 xl:p-16`}>
          <div className="w-full max-w-[31rem]">
            <div className="mb-10 flex items-center justify-between gap-4 lg:hidden">
              <Link href="/" aria-label="SapienWorx home"><Wordmark /></Link>
              <span className="rounded-full bg-indigo-soft px-3 py-1.5 text-[0.68rem] font-bold uppercase tracking-[0.14em] text-indigo">{eyebrow}</span>
            </div>
            {showImageOnMobile && image && (
              <div className={`${toneSurface[tone]} relative mb-7 h-32 overflow-hidden rounded-3xl lg:hidden`}>
                <Image src={image} alt={imageAlt} fill sizes="(max-width: 1023px) 28rem, 0px" loading="eager" className="object-contain object-center" />
              </div>
            )}
            {children}
          </div>
        </section>
      </div>
    </main>
  );
}
