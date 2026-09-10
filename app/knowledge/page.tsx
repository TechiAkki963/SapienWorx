import { KnowledgeIndexV1 } from "../../components/knowledge-index-v1";
import { getPublicKnowledgePosts } from "../../lib/backend";

type Search = { category?: string | string[] };
export default async function KnowledgeHubPage({ searchParams }: { searchParams: Promise<Search> }) {
  const search = await searchParams;
  const category = Array.isArray(search.category) ? search.category[0] : search.category;
  const articles = await getPublicKnowledgePosts();
  return <KnowledgeIndexV1 articles={articles ?? []} category={category}/>;
}
