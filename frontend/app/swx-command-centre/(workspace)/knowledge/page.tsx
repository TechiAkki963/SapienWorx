import { adminAPI } from "@/lib/admin-server";
import type { KnowledgeList } from "@/lib/knowledge";
import { KnowledgeEditor } from "@/components/admin/knowledge-editor";

export default async function AdminKnowledgePage() {
  const data = await adminAPI<KnowledgeList>("/api/v1/admin/knowledge");
  return <section className="space-y-5">
    <div className="rounded-[1.5rem] border border-[#dfe4f0] bg-white p-6 shadow-[0_14px_45px_rgba(23,37,84,0.05)] sm:p-8">
      <p className="text-[11px] font-extrabold uppercase tracking-[0.18em] text-[#5262c9]">Editorial control</p>
      <h1 className="mt-3 text-3xl font-bold tracking-[-0.04em] text-slate-950">Knowledge Hub</h1>
      <p className="mt-2 max-w-3xl text-sm leading-7 text-slate-500">Write, review and publish career resources. Drafts are private; only published articles appear on the homepage and the public Knowledge Hub. Every change is audited.</p>
    </div>
    <KnowledgeEditor items={data.items} />
  </section>;
}
