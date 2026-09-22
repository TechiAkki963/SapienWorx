import Image from "next/image";
import Link from "next/link";

import type { KnowledgeArticle } from "@/lib/knowledge";

export function KnowledgeCard({ article }: { article: KnowledgeArticle }) {
  return (
    <article className="group flex h-full flex-col overflow-hidden rounded-[1.6rem] border border-line/80 bg-white shadow-soft transition duration-200 hover:-translate-y-1 hover:shadow-card">
      <Link href={`/knowledge-hub/${article.slug}`} className="block focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-indigo">
        <div className="relative aspect-[1.5/1] overflow-hidden bg-indigo-soft">
          <Image src={article.image_path} alt={article.image_alt} fill sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw" className="object-cover transition duration-300 group-hover:scale-[1.025]" />
        </div>
        <div className="p-6">
          <span className="text-[11px] font-extrabold uppercase tracking-[0.1em] text-indigo">{article.category}</span>
          <h3 className="mt-3 font-serif text-[1.55rem] font-semibold leading-tight text-navy">{article.title}</h3>
          <p className="mt-3 text-sm leading-6 text-ink-muted">{article.excerpt}</p>
          <span className="mt-5 inline-flex text-sm font-bold text-indigo">Read article <span aria-hidden="true" className="ml-1">→</span></span>
        </div>
      </Link>
    </article>
  );
}
