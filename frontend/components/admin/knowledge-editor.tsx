"use client";

import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";

import { apiRequest } from "@/lib/api";
import { KNOWLEDGE_CATEGORIES, type KnowledgeArticle } from "@/lib/knowledge";

const images = [
  ["/images/people/candidate-signup.webp", "Candidate preparing profile"],
  ["/images/people/recruiter-review.webp", "Professional preparing for interview"],
  ["/images/people/candidate-login.webp", "Professional growing career"],
  ["/images/people/recruiter-workspace.webp", "Professionals working together"],
  ["/images/people/candidate-dashboard.webp", "Professional studying"],
  ["/images/people/recruiter-team.webp", "Collaborative team"],
  ["/images/people/sapien-employer.webp", "Professional portrait"],
] as const;

const newArticle: KnowledgeArticle = {
  id: "", published_at: null, created_at: "", updated_at: "",
  slug: "", title: "", category: KNOWLEDGE_CATEGORIES[0],
  excerpt: "", body: "", image_path: images[0][0], image_alt: images[0][1],
  author_name: "SapienWorx Editorial", status: "draft" as const, featured_order: 10, revision: 0,
};

const inputClass = "min-h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm text-slate-900 outline-none focus:border-[#0866ff] focus:ring-3 focus:ring-blue-100";

export function KnowledgeEditor({ items }: { items: KnowledgeArticle[] }) {
  const router = useRouter();
  const [selected, setSelected] = useState<KnowledgeArticle | null>(items[0] ?? null);
  const [creating, setCreating] = useState(items.length === 0);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const current = creating ? newArticle : selected ?? items[0] ?? newArticle;
  const [image, setImage] = useState(current.image_path);

  function choose(article: KnowledgeArticle | null) {
    setSelected(article);
    setCreating(article === null);
    setImage(article?.image_path ?? images[0][0]);
    setMessage("");
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy) return;
    const data = new FormData(event.currentTarget);
    const input = {
      slug: String(data.get("slug") ?? "").trim(),
      title: String(data.get("title") ?? "").trim(),
      category: String(data.get("category") ?? ""),
      excerpt: String(data.get("excerpt") ?? "").trim(),
      body: String(data.get("body") ?? "").trim(),
      image_path: String(data.get("image_path") ?? ""),
      image_alt: String(data.get("image_alt") ?? "").trim(),
      author_name: String(data.get("author_name") ?? "").trim(),
      status: String(data.get("status") ?? "draft"),
      featured_order: Number(data.get("featured_order") ?? 0),
      revision: creating ? 0 : current.revision,
    };
    if (!/^[a-z0-9]+(-[a-z0-9]+)*$/.test(input.slug)) {
      setMessage("Slug must be lowercase letters, numbers and single hyphens."); return;
    }
    setBusy(true);
    setMessage("");
    try {
      const article = await apiRequest<KnowledgeArticle>(
        creating ? "/api/v1/admin/knowledge" : `/api/v1/admin/knowledge/${current.id}`,
        { method: creating ? "POST" : "PUT", body: JSON.stringify(input) },
      );
      setSelected(article);
      setCreating(false);
      setImage(article.image_path);
      setMessage(article.status === "published" ? "Saved and published. Public pages now use this article." : "Saved as a private draft.");
      router.refresh();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Could not save. Please retry.");
    } finally { setBusy(false); }
  }

  return <div className="grid items-start gap-5 xl:grid-cols-[minmax(15rem,0.7fr)_minmax(0,1.7fr)]">
    <aside className="rounded-[1.35rem] border border-slate-200 bg-white p-4 shadow-sm">
      <div className="flex items-center justify-between gap-2">
        <h2 className="text-sm font-extrabold text-slate-950">Articles ({items.length})</h2>
        <button type="button" onClick={() => choose(null)} className="rounded-lg bg-[#0866ff] px-3 py-2 text-xs font-bold text-white hover:bg-[#114fba]">+ New article</button>
      </div>
      <div className="mt-4 grid gap-2">
        {items.map(article => <button type="button" key={article.id} onClick={() => choose(article)} aria-pressed={!creating && current.id === article.id} className={`rounded-xl border p-3 text-left transition ${!creating && current.id === article.id ? "border-[#0866ff] bg-blue-50" : "border-slate-100 hover:border-blue-200 hover:bg-slate-50"}`}>
          <span className="text-[10px] font-extrabold uppercase tracking-wider text-slate-500">{article.category}</span>
          <span className="mt-1 block text-sm font-bold text-slate-900">{article.title}</span>
          <span className={`mt-2 inline-flex rounded-full px-2 py-0.5 text-[10px] font-bold ${article.status === "published" ? "bg-emerald-100 text-emerald-800" : "bg-amber-100 text-amber-800"}`}>{article.status}</span>
        </button>)}
        {items.length === 0 && <p className="p-3 text-sm text-slate-500">No articles yet. Create the first draft.</p>}
      </div>
    </aside>
    <div className="rounded-[1.35rem] border border-slate-200 bg-white p-5 shadow-sm sm:p-7">
      <div className="mb-6 flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-xl font-bold text-slate-950">{creating ? "New article" : "Edit article"}</h2>
        {!creating && current.status === "published" && <Link href={`/knowledge-hub/${current.slug}`} target="_blank" rel="noopener noreferrer" className="text-sm font-bold text-[#0866ff] hover:underline">View published article ↗</Link>}
      </div>
      <form key={creating ? "new" : current.id + "-" + current.revision} onSubmit={submit} className="grid gap-5">
        <div className="grid gap-4 sm:grid-cols-2">
          <label className="grid gap-1.5 text-xs font-bold text-slate-600">Title<input name="title" className={inputClass} required minLength={5} maxLength={180} defaultValue={current.title} placeholder="Build a résumé that tells your story" /></label>
          <label className="grid gap-1.5 text-xs font-bold text-slate-600">Slug<input name="slug" className={inputClass} required maxLength={100} pattern="[a-z0-9]+(-[a-z0-9]+)*" defaultValue={current.slug} placeholder="build-a-resume-that-tells-your-story" /></label>
          <label className="grid gap-1.5 text-xs font-bold text-slate-600">Category<select name="category" className={inputClass} defaultValue={current.category}>{KNOWLEDGE_CATEGORIES.map(value => <option key={value} value={value}>{value}</option>)}</select></label>
          <label className="grid gap-1.5 text-xs font-bold text-slate-600">Author<input name="author_name" className={inputClass} required maxLength={120} defaultValue={current.author_name} /></label>
        </div>
        <label className="grid gap-1.5 text-xs font-bold text-slate-600">Article summary<textarea name="excerpt" className={inputClass + " min-h-24 py-3"} required minLength={20} maxLength={350} defaultValue={current.excerpt} placeholder="What will the reader learn?" /></label>
        <label className="grid gap-1.5 text-xs font-bold text-slate-600">Article content (plain text; separate paragraphs with a blank line)<textarea name="body" className={inputClass + " min-h-80 py-3 leading-7"} required minLength={100} maxLength={30000} defaultValue={current.body} placeholder="Write a practical, helpful article…" /></label>
        <div className="grid gap-5 md:grid-cols-[minmax(0,1fr)_12rem]">
          <div className="grid gap-4">
            <label className="grid gap-1.5 text-xs font-bold text-slate-600">Approved cover image<select name="image_path" className={inputClass} value={image} onChange={event => setImage(event.target.value)}>{images.map(([path,label]) => <option key={path} value={path}>{label}</option>)}</select></label>
            <label className="grid gap-1.5 text-xs font-bold text-slate-600">Image description<input name="image_alt" className={inputClass} required minLength={5} maxLength={220} defaultValue={current.image_alt} /></label>
          </div>
          <div className="relative min-h-32 overflow-hidden rounded-xl bg-indigo-soft"><Image src={image} alt="Selected cover preview" fill sizes="192px" className="object-cover" /></div>
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <label className="grid gap-1.5 text-xs font-bold text-slate-600">Display order<input type="number" name="featured_order" min={0} max={1000} className={inputClass} defaultValue={current.featured_order} /></label>
          <label className="grid gap-1.5 text-xs font-bold text-slate-600">Visibility<select name="status" className={inputClass} defaultValue={current.status}><option value="draft">Draft — private</option><option value="published">Published — public</option></select></label>
        </div>
        <p className="text-xs leading-5 text-slate-500">Publishing updates the public Knowledge Hub and landing page. Drafts are visible only in this Master Admin workspace. If another admin updates an article before you save, you must reload rather than overwrite their work.</p>
        <div className="flex flex-wrap items-center gap-3"><button type="submit" disabled={busy} className="min-h-11 rounded-xl bg-[#0866ff] px-6 text-sm font-bold text-white hover:bg-[#114fba] disabled:cursor-wait disabled:opacity-50">{busy ? "Saving…" : creating ? "Create article" : "Save changes"}</button><Link href="/knowledge-hub" className="text-sm font-bold text-[#0866ff] hover:underline">Open public Knowledge Hub →</Link></div>
        {message && <p role="status" className="rounded-xl bg-blue-50 p-3 text-sm font-semibold text-slate-800">{message}</p>}
      </form>
    </div>
  </div>;
}
