import Image from "next/image";
import Link from "next/link";

import type { KnowledgeArticle } from "@/lib/knowledge";

export function KnowledgeCard({ article, featured = false }: { article: KnowledgeArticle; featured?: boolean }) {
  return (
    <article className="group flex h-full min-w-0 flex-col overflow-hidden rounded-[1.35rem] border border-line/80 bg-white shadow-[0_12px_35px_rgb(10_44_92_/_0.07)] transition duration-200 hover:-translate-y-1 hover:shadow-card">
      <Link href={`/knowledge-hub/${article.slug}`} className="flex h-full min-w-0 flex-col focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-indigo">
        <div className={`relative overflow-hidden bg-indigo-soft ${featured ? "aspect-[1.6/1]" : "aspect-[1.5/1]"}`}>
          <Image src={article.image_path} alt={article.image_alt} fill sizes={featured ? "(max-width: 767px) 100vw, (max-width: 1279px) 50vw, 36vw" : "(max-width: 767px) 100vw, (max-width: 1279px) 50vw, 22vw"} className="object-cover transition duration-300 group-hover:scale-[1.025]" />
          {featured && <span className="absolute left-3 top-3 rounded-full bg-white/95 px-3 py-1 text-[10px] font-extrabold uppercase tracking-wider text-indigo shadow-sm">Featured article</span>}
        </div>
        <div className="flex flex-1 flex-col p-5 sm:p-6">
          <span className="text-[10px] font-extrabold uppercase tracking-[0.11em] text-indigo">{article.category}</span>
          <h3 className={`mt-3 font-serif font-semibold leading-[1.1] tracking-[-0.03em] text-navy ${featured ? "text-[clamp(1.6rem,2.6vw,2.25rem)]" : "text-[1.4rem]"}`}>{article.title}</h3>
          <p className="mt-3 text-sm leading-6 text-ink-muted">{article.excerpt}</p>
          <span className="mt-auto inline-flex items-center pt-5 text-sm font-bold text-indigo">Read article <span aria-hidden="true" className="ml-1.5">→</span></span>
        </div>
      </Link>
    </article>
  );
}
