import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";

import { Container } from "@/components/layout/container";
import { PublicHeader } from "@/components/site/public-header";
import { PublicFooter } from "@/components/site/public-footer";
import { publicAPI } from "@/lib/candidate-server";
import type { KnowledgeArticle } from "@/lib/knowledge";

export const dynamic = "force-dynamic";
type Props = { params: Promise<{ slug: string }> };

export default async function KnowledgeArticlePage({ params }: Props) {
  const { slug } = await params;
  if (!/^[a-z0-9]+(-[a-z0-9]+)*$/.test(slug)) notFound();
  let article: KnowledgeArticle;
  try {
    article = await publicAPI<KnowledgeArticle>(`/api/v1/knowledge/${encodeURIComponent(slug)}`);
  } catch { notFound(); }

  return <main id="main-content" className="min-h-screen bg-white">
    <PublicHeader />
    <article>
      <Container className="max-w-[72rem] py-10 sm:py-16">
        <nav className="text-sm font-semibold text-ink-muted"><Link href="/knowledge-hub" className="text-indigo hover:underline">Knowledge Hub</Link> <span aria-hidden="true">/</span> {article.category}</nav>
        <div className="mx-auto mt-8 max-w-3xl">
          <p className="text-xs font-extrabold uppercase tracking-[0.18em] text-indigo">{article.category}</p>
          <h1 className="mt-4 text-balance font-serif text-[clamp(2.5rem,5vw,4.5rem)] font-semibold leading-[1.02] tracking-[-0.05em] text-navy">{article.title}</h1>
          <p className="mt-5 text-lg leading-8 text-ink-muted">{article.excerpt}</p>
          <p className="mt-4 text-xs font-semibold text-ink-muted">By {article.author_name}</p>
        </div>
        <div className="relative mx-auto mt-9 aspect-[1.8/1] max-w-5xl overflow-hidden rounded-[2rem] bg-indigo-soft">
          <Image src={article.image_path} alt={article.image_alt} fill priority sizes="(max-width: 768px) 100vw, 80vw" className="object-cover" />
        </div>
        <div className="mx-auto mt-10 max-w-3xl space-y-6 text-[17px] leading-8 text-ink">
          {article.body.split(/\n\s*\n/).filter(Boolean).map((paragraph,index) => <p key={index}>{paragraph}</p>)}
        </div>
        <div className="mx-auto mt-12 max-w-3xl border-t border-line pt-7"><Link href="/knowledge-hub" className="inline-flex min-h-11 items-center text-sm font-bold text-indigo hover:underline">← More career resources</Link></div>
      </Container>
    </article>
    <PublicFooter />
  </main>;
}
