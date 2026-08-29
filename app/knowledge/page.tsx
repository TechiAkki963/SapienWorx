import { KnowledgePage } from "../../components/public-site";
import { getPublicKnowledgePosts } from "../../lib/backend";

export default async function KnowledgeHubPage() {
  const articles = await getPublicKnowledgePosts();
  return <KnowledgePage articles={articles ?? undefined} />;
}
