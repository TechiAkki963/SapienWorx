import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { KnowledgeArticlePage } from "../../../components/public-site";
import { getPublicKnowledgePost } from "../../../lib/backend";

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const article = await getPublicKnowledgePost(slug);
  return article ? { title: `${article.title} | Sapienworx`, description: article.excerpt } : {};
}

export default async function KnowledgeArticleRoute({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const article = await getPublicKnowledgePost(slug);
  if (!article) notFound();
  return <KnowledgeArticlePage article={article} />;
}
