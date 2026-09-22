export const KNOWLEDGE_CATEGORIES = [
  "Resume & Profile",
  "Interview Preparation",
  "Skills & Career Growth",
  "Humans & AI at Work",
] as const;

export type KnowledgeArticle = {
  id: string;
  slug: string;
  title: string;
  category: string;
  excerpt: string;
  body: string;
  image_path: string;
  image_alt: string;
  author_name: string;
  status: "draft" | "published";
  featured_order: number;
  revision: number;
  published_at: string | null;
  created_at: string;
  updated_at: string;
};

export type KnowledgeList = { items: KnowledgeArticle[]; total: number };
