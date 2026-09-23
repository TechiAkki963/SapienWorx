import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";

import { Container } from "@/components/layout/container";
import { PublicFooter } from "@/components/site/public-footer";
import { PublicHeader } from "@/components/site/public-header";
import { guides } from "@/lib/knowledge-hub";

type Props = { params: Promise<{ slug: string }> };

export function generateStaticParams() {
  return guides.map(({ slug }) => ({ slug }));
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const guide = guides.find((item) => item.slug === slug);
  if (!guide) return { title: "Guide not found" };
  return { title: guide.title, description: guide.dek };
}

export default async function ResourcePage({ params }: Props) {
  const { slug } = await params;
  const guide = guides.find((item) => item.slug === slug);
  if (!guide) notFound();

  return (
    <main id="main-content" className="min-h-screen bg-[#fffcf8]">
      <PublicHeader />
      <article className="py-10 sm:py-16">
        <Container>
          <nav aria-label="Breadcrumb" className="flex flex-wrap gap-2 text-sm text-ink-muted">
            <Link href="/" className="hover:text-indigo">Home</Link><span aria-hidden="true">/</span>
            <Link href="/#knowledge-hub" className="hover:text-indigo">Knowledge Hub</Link><span aria-hidden="true">/</span>
            <span aria-current="page" className="text-navy">{guide.category}</span>
          </nav>
          <div className="mx-auto mt-8 max-w-[49rem]">
            <p className="text-xs font-extrabold uppercase tracking-[0.17em] text-indigo">{guide.category}</p>
            <h1 className="mt-4 text-balance font-serif text-[clamp(2.9rem,6vw,5rem)] font-semibold leading-[1.02] tracking-[-0.05em] text-navy">{guide.title}</h1>
            <p className="mt-5 max-w-[42rem] text-lg leading-8 text-ink-muted">{guide.intro}</p>
            <div className="relative mt-9 aspect-[1.65/1] overflow-hidden rounded-[1.75rem] bg-indigo-soft">
              <Image src={`/images/people/${encodeURIComponent(guide.image)}`} alt={guide.alt} fill priority sizes="(max-width: 850px) 92vw, 784px" className="object-cover" />
            </div>
            <div className="mt-10 space-y-8">
              {guide.steps.map((step, index) => (
                <section key={step.title} className="grid gap-3 border-b border-line pb-7 sm:grid-cols-[3rem_1fr]">
                  <span className="font-serif text-2xl text-indigo" aria-hidden="true">{String(index + 1).padStart(2, "0")}</span>
                  <div><h2 className="font-serif text-2xl font-semibold text-navy">{step.title}</h2><p className="mt-3 text-base leading-8 text-ink-muted">{step.body}</p></div>
                </section>
              ))}
            </div>
            <div className="mt-12 flex flex-wrap items-center gap-4 rounded-[1.5rem] bg-[#edf4ff] p-6 sm:p-8">
              <div className="flex-1"><h2 className="font-serif text-2xl font-semibold text-navy">Ready for your next step?</h2><p className="mt-2 text-sm text-ink-muted">Discover opportunities that match your direction.</p></div>
              <Link href="/jobs" className="inline-flex min-h-11 items-center rounded-full bg-indigo px-5 text-sm font-bold text-white hover:bg-navy">Find jobs ↗</Link>
            </div>
          </div>
        </Container>
      </article>
      <PublicFooter />
    </main>
  );
}
