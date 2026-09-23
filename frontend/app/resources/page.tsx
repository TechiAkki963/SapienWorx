import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";

import { Container } from "@/components/layout/container";
import { LandingFooter } from "@/components/site/landing-footer";
import { LandingHeader } from "@/components/site/landing-header";
import { guides } from "@/lib/knowledge-hub";

export const metadata: Metadata = {
  title: "Knowledge Hub",
  description: "Practical career guides on résumés, interviews, growing your skills and working thoughtfully with AI.",
};

export default function KnowledgeHubPage() {
  return (
    <main id="main-content" className="swx-landing min-h-screen bg-[#f4f9ff]">
      <LandingHeader />
      <Container className="py-12 sm:py-20">
        <Link href="/" className="text-sm font-semibold text-indigo hover:underline">← Back to SapienWorx</Link>
        <div className="mt-8 max-w-[44rem]">
          <p className="swx-eyebrow">Knowledge Hub</p>
          <h1 className="swx-display mt-3 text-[clamp(2.7rem,5vw,4.7rem)] leading-[1.03]">Practical advice for a brighter career.</h1>
          <p className="mt-4 text-base leading-7 text-ink-muted">Explore practical guides to help you tell your story, prepare for conversations and grow with confidence.</p>
        </div>
        <div className="mt-10 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
          {guides.map((guide) => (
            <article className="flex flex-col overflow-hidden rounded-[1.2rem] border border-line bg-white shadow-soft" key={guide.slug}>
              <Link href={`/resources/${guide.slug}`} aria-label={`Read ${guide.title}`} className="relative block aspect-[1.4] overflow-hidden bg-indigo-soft">
                <Image src={`/images/people/${encodeURIComponent(guide.image)}`} alt={guide.alt} fill sizes="(max-width:640px) 90vw,(max-width:1024px) 45vw,22vw" className="object-cover" />
              </Link>
              <div className="flex flex-1 flex-col p-5">
                <p className="swx-eyebrow">{guide.category}</p>
                <h2 className="swx-display mt-3 text-2xl leading-tight"><Link href={`/resources/${guide.slug}`}>{guide.title}</Link></h2>
                <p className="mt-3 flex-1 text-sm leading-6 text-ink-muted">{guide.dek}</p>
                <Link className="mt-5 text-sm font-bold text-indigo hover:underline" href={`/resources/${guide.slug}`}>Read article →</Link>
              </div>
            </article>
          ))}
        </div>
      </Container>
      <LandingFooter />
    </main>
  );
}
