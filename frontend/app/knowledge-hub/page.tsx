import Link from "next/link";

import { KnowledgeCard } from "@/components/site/knowledge-card";
import { Container } from "@/components/layout/container";
import { PublicHeader } from "@/components/site/public-header";
import { PublicFooter } from "@/components/site/public-footer";
import { publicAPI } from "@/lib/candidate-server";
import { KNOWLEDGE_CATEGORIES, type KnowledgeList } from "@/lib/knowledge";

export const dynamic = "force-dynamic";
export const metadata = {
  title: "Knowledge Hub",
  description: "Career guidance, interview preparation, skills and practical insight into humans and AI at work.",
};

type Props = { searchParams: Promise<{ category?: string | string[] }> };

export default async function KnowledgeHubPage({ searchParams }: Props) {
  const params = await searchParams;
  const category = typeof params.category === "string" && KNOWLEDGE_CATEGORIES.some(value => value === params.category) ? params.category : "";
  const query = category ? `?category=${encodeURIComponent(category)}` : "";
  let data: KnowledgeList | null = null;
  try { data = await publicAPI<KnowledgeList>(`/api/v1/knowledge${query}`); } catch {}

  return <main id="main-content" className="min-h-screen bg-[#f8fbff]">
    <PublicHeader />
    <section className="bg-[linear-gradient(130deg,#eaf3ff_0%,#fff_65%,#e9f8f2_100%)] py-16 sm:py-20">
      <Container>
        <p className="text-xs font-extrabold uppercase tracking-[0.2em] text-indigo">SapienWorx Knowledge Hub</p>
        <h1 className="mt-4 max-w-4xl text-balance font-serif text-[clamp(3rem,6vw,5rem)] font-semibold leading-[0.98] tracking-[-0.05em] text-navy">Grow into what comes next.</h1>
        <p className="mt-5 max-w-2xl text-lg leading-8 text-ink-muted">Practical guidance for building your profile, preparing for interviews, growing your skills and working alongside AI.</p>
        <Link href="/jobs" className="mt-6 inline-flex min-h-11 items-center rounded-full border border-indigo/30 bg-white px-5 text-sm font-bold text-indigo transition hover:bg-indigo-soft">Explore opportunities →</Link>
      </Container>
    </section>
    <Container className="py-12 sm:py-16">
      <nav aria-label="Knowledge Hub categories" className="mb-9 flex flex-wrap gap-2">
        {[["","All articles"], ...KNOWLEDGE_CATEGORIES.map(value => [value,value])].map(([value,label]) => <Link key={label} href={value ? `/knowledge-hub?category=${encodeURIComponent(value)}` : "/knowledge-hub"} aria-current={category === value ? "page" : undefined} className={`inline-flex min-h-11 items-center rounded-full border px-4 text-sm font-bold transition ${category === value ? "border-indigo bg-indigo text-white" : "border-line bg-white text-navy hover:border-indigo/35 hover:bg-indigo-soft"}`}>{label}</Link>)}
      </nav>
      {!data ? <div role="status" className="rounded-2xl border border-line bg-white p-8 text-ink-muted">The Knowledge Hub is temporarily unavailable. Please try again shortly.</div> : data.items.length === 0 ? <div className="rounded-2xl border border-line bg-white p-8 text-ink-muted">No published articles in this category yet.</div> : <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-4">{data.items.map(article => <KnowledgeCard key={article.id} article={article} />)}</div>}
    </Container>
    <PublicFooter />
  </main>;
}
