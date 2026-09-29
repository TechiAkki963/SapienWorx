import { ReleaseCreateForm, ReleaseTransitionForm } from "@/components/admin/control-plane-actions";
import { requireAdminWorkspace } from "@/lib/admin-access-server";
import { adminAPI } from "@/lib/admin-server";

type Release={id:string;release_reference:string;environment:string;commit_sha:string;migration_reference:string;status:string;approval_id?:string;backup_evidence_id?:string;restore_test_evidence_id?:string;requested_by:string;accepted_by?:string;notes:string;created_at:string;updated_at:string;accepted_at?:string};
type Evidence={id:string;evidence_type:string;environment:string;component:string;status:string;reference:string;observed_at:string};
type ControlPlane={releases:Release[];operations:Evidence[]};

function Status({value}:{value:string}){const good=["accepted","deployed","approved_for_rollout","passed"].includes(value);const bad=["rejected","rolled_back","failed"].includes(value);return <span className={`rounded-full px-2.5 py-1 text-[11px] font-bold ${good?"bg-emerald-50 text-emerald-700":bad?"bg-red-50 text-red-700":"bg-amber-50 text-amber-800"}`}>{value.replaceAll("_"," ")}</span>}

export default async function ReleasesPage(){
  await requireAdminWorkspace("release.manage");
  const data=await adminAPI<ControlPlane>("/api/v1/admin/control-plane");
  const backup=data.operations.filter(v=>v.evidence_type==="backup").slice(0,10);
  const restores=data.operations.filter(v=>v.evidence_type==="restore_test").slice(0,10);
  return <section className="space-y-5">
    <header className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm sm:p-8">
      <p className="text-xs font-bold uppercase tracking-widest text-indigo-600">Release governance</p>
      <h1 className="mt-3 text-3xl font-bold text-slate-950">Production release control centre</h1>
      <p className="mt-3 max-w-4xl text-sm leading-7 text-slate-600">A release cannot be accepted until its rollout approval is complete and passing backup plus restore-test evidence has been recorded.</p>
    </header>
    <ReleaseCreateForm/>
    <section className="rounded-2xl border border-slate-200 bg-white p-5"><h2 className="font-bold text-slate-950">Release checkpoints</h2><div className="mt-4 space-y-4">{data.releases.length===0?<p className="text-sm text-slate-500">No release checkpoints recorded.</p>:data.releases.map(item=><article key={item.id} className="rounded-2xl border border-slate-100 p-4"><div className="flex flex-wrap items-center justify-between gap-2"><div><h3 className="font-bold text-slate-950">{item.release_reference}</h3><p className="mt-1 text-xs text-slate-500">{item.environment} · {new Date(item.updated_at).toLocaleString("en-IN",{timeZone:"UTC"})} UTC</p></div><Status value={item.status}/></div><dl className="mt-4 grid gap-3 text-xs sm:grid-cols-2 xl:grid-cols-4"><div><dt className="text-slate-400">Commit</dt><dd className="mt-1 break-all font-mono text-slate-700">{item.commit_sha}</dd></div><div><dt className="text-slate-400">Migration</dt><dd className="mt-1 text-slate-700">{item.migration_reference||"not recorded"}</dd></div><div><dt className="text-slate-400">Approval</dt><dd className="mt-1 break-all font-mono text-slate-700">{item.approval_id||"missing"}</dd></div><div><dt className="text-slate-400">Recovery evidence</dt><dd className="mt-1 text-slate-700">backup {item.backup_evidence_id?"✓":"—"} · restore {item.restore_test_evidence_id?"✓":"—"}</dd></div></dl><ReleaseTransitionForm releaseID={item.id} status={item.status}/></article>)}</div></section>
    <div className="grid gap-5 xl:grid-cols-2">
      <section className="rounded-2xl border border-slate-200 bg-white p-5"><h2 className="font-bold text-slate-950">Latest backup evidence</h2><div className="mt-3 space-y-2">{backup.length===0?<p className="text-sm text-slate-500">No backup evidence ingested.</p>:backup.map(v=><div key={v.id} className="rounded-xl border border-slate-100 p-3"><div className="flex justify-between gap-2"><p className="font-semibold text-slate-800">{v.component}</p><Status value={v.status}/></div><p className="mt-1 break-all font-mono text-[11px] text-slate-500">{v.id}</p></div>)}</div></section>
      <section className="rounded-2xl border border-slate-200 bg-white p-5"><h2 className="font-bold text-slate-950">Latest restore-test evidence</h2><div className="mt-3 space-y-2">{restores.length===0?<p className="text-sm text-slate-500">No restore-test evidence ingested.</p>:restores.map(v=><div key={v.id} className="rounded-xl border border-slate-100 p-3"><div className="flex justify-between gap-2"><p className="font-semibold text-slate-800">{v.component}</p><Status value={v.status}/></div><p className="mt-1 break-all font-mono text-[11px] text-slate-500">{v.id}</p></div>)}</div></section>
    </div>
  </section>
}
