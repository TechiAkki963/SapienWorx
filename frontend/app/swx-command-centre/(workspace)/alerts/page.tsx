import { AlertActions, EvaluateAlertsButton } from "@/components/admin/alert-actions";
import { requireAdminWorkspace } from "@/lib/admin-access-server";
import { adminAPI } from "@/lib/admin-server";

type Alert={id:string;severity:string;status:string;title:string;summary:string;observed_value?:number;threshold?:number;owner:string;first_seen_at:string;last_seen_at:string};
type Rule={id:string;rule_key:string;name:string;category:string;metric:string;threshold:number;window_minutes:number;severity:string;owner:string;enabled:boolean};

export default async function AlertsPage(){
  await requireAdminWorkspace("control_plane.read");
  const data=await adminAPI<{items:Alert[];rules:Rule[]}>("/api/v1/admin/alerts");
  const open=data.items.filter(item=>item.status!=="resolved");
  return <section className="space-y-5">
    <header className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm sm:p-8"><p className="text-xs font-bold uppercase tracking-widest text-indigo-600">Operations</p><h1 className="mt-3 text-3xl font-bold text-slate-950">Alerts & incident ownership</h1><p className="mt-3 max-w-3xl text-sm leading-7 text-slate-500">Rules evaluate privacy-safe telemetry. Every alert has severity, ownership, acknowledgement and resolution state.</p><div className="mt-5"><EvaluateAlertsButton/></div></header>
    <div className="grid gap-3 sm:grid-cols-3">{[["Open",open.filter(v=>v.status==="open").length],["Acknowledged",open.filter(v=>v.status==="acknowledged").length],["Critical",open.filter(v=>v.severity==="critical").length]].map(([label,value])=><div key={String(label)} className="rounded-2xl border border-slate-200 bg-white p-4"><p className="text-xs font-bold text-slate-500">{label}</p><p className="mt-2 text-3xl font-black text-slate-950">{value}</p></div>)}</div>
    <section className="rounded-2xl border border-slate-200 bg-white p-5"><h2 className="font-bold text-slate-950">Active alert queue</h2><div className="mt-4 grid gap-3 xl:grid-cols-2">{open.length===0?<p className="text-sm text-slate-500">No active alerts.</p>:open.map(item=><article key={item.id} className="rounded-xl border border-slate-100 p-4"><div className="flex flex-wrap items-center justify-between gap-2"><p className="font-semibold text-slate-900">{item.title}</p><span className={item.severity==="critical"?"rounded-full bg-red-50 px-2 py-1 text-xs font-bold text-red-700":"rounded-full bg-amber-50 px-2 py-1 text-xs font-bold text-amber-800"}>{item.severity}</span></div><p className="mt-2 text-sm leading-6 text-slate-600">{item.summary}</p><p className="mt-2 text-xs text-slate-500">Owner {item.owner||"unassigned"} · {item.status} · last seen {new Date(item.last_seen_at).toLocaleString("en-IN",{timeZone:"UTC"})} UTC</p><AlertActions id={item.id} status={item.status} owner={item.owner}/></article>)}</div></section>
    <section className="rounded-2xl border border-slate-200 bg-white p-5"><h2 className="font-bold text-slate-950">Rule catalogue</h2><div className="mt-4 overflow-x-auto"><table className="w-full min-w-[760px] text-left text-sm"><thead className="text-xs text-slate-500"><tr><th className="py-2">Rule</th><th>Source</th><th>Metric</th><th>Threshold</th><th>Window</th><th>Owner</th></tr></thead><tbody>{data.rules.map(rule=><tr key={rule.id} className="border-t border-slate-100"><td className="py-3 font-semibold">{rule.name}</td><td>{rule.category}</td><td>{rule.metric}</td><td>{rule.threshold}</td><td>{rule.window_minutes} min</td><td>{rule.owner||"—"}</td></tr>)}</tbody></table></div></section>
  </section>;
}
