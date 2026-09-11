import { KnowledgeHubV1 } from "../../components/knowledge-hub-v1";
import { getPublicKnowledgePosts } from "../../lib/backend";
export default async function KnowledgeHubPage(){const articles=await getPublicKnowledgePosts();return <KnowledgeHubV1 articles={articles??[]}/>;}
