import { CostSnapshotForm, KnowledgeArticleForm, OperationalSettingForm } from "@/components/admin/control-plane-actions";
import { requireAdminWorkspace } from "@/lib/admin-access-server";
import { adminAPI } from "@/lib/admin-server";

type Article={id:string;slug:string;title:string;status:string;current_revision:number;updated_by:string;published_at?:string;updated_at:string};
type Setting={key:string;description:string;high_risk:boolean;approval_id?:string;updated_by:string;updated_at:string};
type Cost={id:string;provider:string;currency:string;period_start:string;period_end:string;actual_cost:number;forecast_cost?:number;budget_amount?:number;source_reference:string;observed_at:string};
type Data={knowledge:Article[];settings:Setting[];costs:Cost[]};

export default async function ContentSettingsPage(){
  await requireAdminWorkspace("control_plane.read");
  const data=await adminAPI<Data>("/api/v1/admin/control-plane");
  return <section className="space-y-5">
    <header className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm sm:p-8"><p className="text-xs font-bold uppercase tracking-widest text-indigo-600">Controlled administration</p><h1 className="mt-3 text-3xl font-bold text-slate-950">Content, settings & cloud costs</h1><p className="mt-3 max-w-4xl text-sm leading-7 text-slate-600">Version Knowledge Hub content, apply governed non-secret operational settings, and record verified cloud-cost evidence.</p></header>
    <div className="grid gap-5 xl:grid-cols-2"><KnowledgeArticleForm/><OperationalSettingForm/></div>
    <CostSnapshotForm/>
    <div className="grid gap-5 xl:grid-cols-3">
      <section className="rounded-2xl border border-slate-200 bg-white p-5"><h2 className="font-bold text-slate-950">Knowledge Hub</h2><div className="mt-3 space-y-2">{data.knowledge.length===0?<p className="text-sm text-slate-500">No articles yet.</p>:data.knowledge.map(v=><article key={v.id} className="rounded-xl border border-slate-100 p-3"><p className="font-semibold text-slate-800">{v.title}</p><p className="mt-1 text-xs text-slate-500">/{v.slug} · revision {v.current_revision} · {v.status}</p><p className="mt-1 break-all font-mono text-[10px] text-slate-400">{v.id}</p></article>)}</div></section>
      <section className="rounded-2xl border border-slate-200 bg-white p-5"><h2 className="font-bold text-slate-950">Operational settings</h2><div className="mt-3 space-y-2">{data.settings.length===0?<p className="text-sm text-slate-500">No controlled settings.</p>:data.settings.map(v=><article key={v.key} className="rounded-xl border border-slate-100 p-3"><p className="break-all font-mono text-xs text-slate-800">{v.key}</p><p className="mt-1 text-xs text-slate-500">{v.high_risk?"High-risk · dual approval":"Standard controlled setting"}</p></article>)}</div></section>
      <section className="rounded-2xl border border-slate-200 bg-white p-5"><h2 className="font-bold text-slate-950">AWS cost evidence</h2><div className="mt-3 space-y-2">{data.costs.length===0?<p className="text-sm text-slate-500">No actual cost snapshots ingested.</p>:data.costs.map(v=><article key={v.id} className="rounded-xl border border-slate-100 p-3"><p className="text-xl font-black text-slate-950">{v.currency} {v.actual_cost.toLocaleString("en-IN",{maximumFractionDigits:2})}</p><p className="mt-1 text-xs text-slate-500">{new Date(v.period_start).toLocaleDateString("en-IN")} – {new Date(v.period_end).toLocaleDateString("en-IN")}</p><p className="mt-1 text-xs text-slate-500">Budget {v.budget_amount==null?"not supplied":v.currency+" "+v.budget_amount.toLocaleString("en-IN")}</p></article>)}</div></section>
    </div>
  </section>
}
