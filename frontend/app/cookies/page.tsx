import type { Metadata } from "next";

import { Container } from "@/components/layout/container";
import { PublicFooter } from "@/components/site/public-footer";
import { PublicHeader } from "@/components/site/public-header";

export const metadata: Metadata = {
  title: "Cookie information",
  alternates: { canonical: "/cookies" },
};

const cookies = [
  {
    name: "Authentication cookies",
    purpose: "Keep signed-in sessions secure and distinguish authenticated browser requests.",
    optional: false,
  },
  {
    name: "CSRF security cookie",
    purpose: "Helps verify authenticated state-changing requests and reduce cross-site request forgery risk.",
    optional: false,
  },
];

export default function CookieInformationPage() {
  return (
    <main className="min-h-screen bg-[#f8fbff] text-ink">
      <PublicHeader />
      <Container>
        <article className="mx-auto max-w-4xl py-14 sm:py-20">
          <p className="text-xs font-extrabold uppercase tracking-[0.2em] text-indigo">Cookie information</p>
          <h1 className="mt-4 font-serif text-5xl font-semibold tracking-[-0.05em] text-navy sm:text-6xl">Only essential cookies are used in the current product.</h1>
          <p className="mt-6 max-w-3xl text-base leading-8 text-ink-muted">
            SapienWorx currently uses cookies required for authentication and security. No advertising, behavioral profiling, or non-essential analytics cookies are enabled in this codebase.
          </p>

          <div className="mt-10 grid gap-4">
            {cookies.map((item) => (
              <section key={item.name} className="rounded-2xl border border-line/80 bg-white p-6 shadow-sm">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <h2 className="text-lg font-bold text-navy">{item.name}</h2>
                  <span className="rounded-full bg-indigo-soft px-3 py-1 text-xs font-bold text-indigo">Essential</span>
                </div>
                <p className="mt-2 text-sm leading-7 text-ink-muted">{item.purpose}</p>
              </section>
            ))}
          </div>

          <section className="mt-8 rounded-2xl border border-indigo/15 bg-indigo-soft/35 p-6">
            <h2 className="text-lg font-bold text-navy">Why there is no consent banner</h2>
            <p className="mt-2 text-sm leading-7 text-ink-muted">
              There are currently no optional cookies to accept or reject. If SapienWorx later introduces non-essential analytics, advertising, or similar tracking, those technologies must remain off until the required preference controls and consent records are available.
            </p>
          </section>
        </article>
      </Container>
      <PublicFooter />
    </main>
  );
}
