import Link from "next/link";
import { CaseManagementForm } from "@/components/admin/control-plane-actions";
import { requireAdminWorkspace } from "@/lib/admin-access-server";
import { adminAPI } from "@/lib/admin-server";

type Event = { id:string; actor_id:string; event_type:string; note:string; from_status?:string; to_status?:string; created_at:string };
type Props = { params: Promise<{ id: string }> };

export default async function CaseHistoryPage({ params }: Props) {
  await requireAdminWorkspace("control_plane.read");
  const { id } = await params;
  const data = await adminAPI<{items:Event[]}>("/api/v1/admin/control-plane/cases/" + encodeURIComponent(id) + "/history");
  return <section className="space-y-5">
    <header className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
      <Link href="/swx-command-centre/control-plane" className="text-xs font-bold text-indigo-600">← Control plane</Link>
      <p className="mt-4 text-xs font-bold uppercase tracking-widest text-indigo-600">Investigation case</p>
      <h1 className="mt-2 text-3xl font-bold text-slate-950">Case history</h1>
      <p className="mt-2 break-all font-mono text-xs text-slate-500">{id}</p>
    </header>
    <CaseManagementForm caseID={id}/>
    <div className="rounded-2xl border border-slate-200 bg-white p-5">
      <h2 className="font-bold text-slate-950">Immutable event trail</h2>
      <div className="mt-4 space-y-3">{data.items.length===0?<p className="text-sm text-slate-500">No events recorded.</p>:data.items.map(event=><article key={event.id} className="rounded-xl border border-slate-100 p-4"><div className="flex flex-wrap justify-between gap-2"><p className="font-semibold text-slate-900">{event.event_type.replaceAll("_"," ")}</p><time className="text-xs text-slate-400">{new Date(event.created_at).toLocaleString("en-IN",{timeZone:"UTC"})} UTC</time></div><p className="mt-1 text-xs text-slate-500">Actor {event.actor_id}{event.from_status||event.to_status ? " · "+(event.from_status||"—")+" → "+(event.to_status||"—") : ""}</p>{event.note&&<p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-slate-700">{event.note}</p>}</article>)}</div>
    </div>
  </section>;
}
