"use client";
import { useState } from "react";
import Link from "next/link";
import { apiRequest } from "@/lib/api";
import { discoverySummary } from "@/lib/discovery";
import { RecruiterDataTable, RecruiterDrawer, WorkspaceState, recruiterInput, recruiterPrimary, recruiterSecondary } from "./workspace-ui";
export type SavedSearchItem = { id: string; name: string; filters: Record<string, string>; alert_enabled: boolean; alert_frequency: string; last_alerted_at?: string; updated_at: string };
export function SavedSearchAlerts({ initialItems }: { initialItems: SavedSearchItem[] }) {
  const [items, setItems] = useState(initialItems);
  const [counts,setCounts] = useState<Record<string,{current:number;updated_since:number;since:string;checked_at:string}>>({});
  const [busy, setBusy] = useState("");
  const [error, setError] = useState("");
  const [editing, setEditing] = useState<SavedSearchItem | null>(null);
  const [deleting, setDeleting] = useState<SavedSearchItem | null>(null);
  const [name, setName] = useState("");
  const href = (item: SavedSearchItem) => "/recruiter/discover?search_id=" + encodeURIComponent(item.id);
  async function update(item: SavedSearchItem, changes: Record<string, unknown>) {
    setBusy(item.id); setError("");
    try {
      const next = await apiRequest<SavedSearchItem>("/api/v1/recruiter/saved-searches/" + item.id, { method: "PATCH", body: JSON.stringify(changes) });
      setItems(current => current.map(saved => saved.id === item.id ? next : saved)); setEditing(null);
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Could not update search. Its saved criteria are retained."); }
    finally { setBusy(""); }
  }
  async function duplicate(item: SavedSearchItem) {
    setBusy(item.id); setError("");
    try {
      const next = await apiRequest<SavedSearchItem>("/api/v1/recruiter/saved-searches", { method: "POST", body: JSON.stringify({ name: (item.name + " copy").slice(0, 120), filters: item.filters }) });
      setItems(current => [next, ...current]);
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Could not duplicate search."); }
    finally { setBusy(""); }
  }
  async function remove(item: SavedSearchItem) {
    setBusy(item.id); setError("");
    try { await apiRequest("/api/v1/recruiter/saved-searches/" + item.id, { method: "DELETE" }); setItems(current => current.filter(saved => saved.id !== item.id)); setDeleting(null); }
    catch (cause) { setError(cause instanceof Error ? cause.message : "Could not delete search."); }
    finally { setBusy(""); }
  }
  async function checkMatches(item:SavedSearchItem) {
    if(busy)return;setBusy(item.id);setError("");
    try {const result=await apiRequest<{current:number;updated_since:number;since:string;checked_at:string}>(`/api/v1/recruiter/saved-searches/${encodeURIComponent(item.id)}/matches`);setCounts(current=>({...current,[item.id]:result}));}
    catch(cause){setError(cause instanceof Error?cause.message:"Could not check matches. No saved criteria have changed.");}
    finally{setBusy("");}
  }
  const actions = (item: SavedSearchItem) => <div className="flex flex-wrap gap-2"><Link href={href(item)} className={recruiterPrimary}>Run search</Link><details><summary className={recruiterSecondary} aria-label={`More actions for ${item.name}`}>More</summary><div className="grid border border-line p-2"><Link href={href(item)} className={recruiterSecondary}>Edit criteria</Link><button className={recruiterSecondary} onClick={() => { setEditing(item); setName(item.name); }}>Rename</button><button disabled={!!busy} className={recruiterSecondary} onClick={() => void duplicate(item)}>Duplicate</button><button className={recruiterSecondary} onClick={() => setDeleting(item)}>Delete</button></div></details></div>;
  const alert = (item: SavedSearchItem) => <label className="grid gap-1 text-xs text-ink-muted">Alert frequency<select aria-label={`Alert frequency for ${item.name}`} value={item.alert_enabled ? item.alert_frequency : "off"} disabled={!!busy} className={recruiterInput} onChange={event => void update(item, { enabled: event.target.value !== "off", frequency: event.target.value === "off" ? item.alert_frequency || "daily" : event.target.value })}><option value="off">Off</option><option value="daily">Daily</option><option value="weekly">Weekly</option></select></label>;
  const description = (item: SavedSearchItem) => <div><Link href={href(item)} className="font-semibold text-navy">{item.name}</Link><p className="mt-2 break-words text-xs leading-6 text-ink-muted">{discoverySummary(item.filters)}</p><p className="mt-2 text-xs text-ink-muted">{item.last_alerted_at ? `Last alert ${new Date(item.last_alerted_at).toLocaleDateString("en-IN", { timeZone: "Asia/Kolkata" })}` : "No alert sent yet"}</p>{counts[item.id] && <p className="mt-2 text-xs leading-6 text-ink-muted">{counts[item.id].current} current matches · {counts[item.id].updated_since} profiles updated since {new Date(counts[item.id].since).toLocaleString("en-IN",{timeZone:"Asia/Kolkata"})} IST</p>}<button type="button" className="mt-2 min-h-11 text-xs font-semibold text-indigo" disabled={!!busy} onClick={()=>void checkMatches(item)}>{busy===item.id?"Checking…":counts[item.id]?"Refresh match counts":"Check match counts"}</button></div>;
  return <div className="grid gap-4">{error && <p role="alert" className="rounded-lg border border-rose-200 p-3 text-sm text-rose-700">{error}</p>}{items.length ? <RecruiterDataTable label="Saved talent searches" rows={items} rowKey={item => item.id} columns={[{ key: "search", title: "Search / criteria", width: "50%", render: description }, { key: "alert", title: "Delivery", width: "24%", render: alert }, { key: "actions", title: "Actions", width: "26%", render: actions }]} mobileRow={item => <div className="grid gap-4">{description(item)}{alert(item)}{actions(item)}</div>} /> : <WorkspaceState title="No saved searches yet" description="Save useful criteria from Discover Talent, then run them or configure an alert here." action={<Link className={recruiterPrimary} href="/recruiter/discover">Discover Talent</Link>} />}
    <RecruiterDrawer open={!!editing} onClose={() => { if (!busy) setEditing(null); }} title="Rename search"><form onSubmit={event => { event.preventDefault(); if (editing) void update(editing, { name }); }} className="grid gap-4"><label className="grid gap-2 text-sm text-ink">Search name<input required maxLength={120} value={name} onChange={event => setName(event.target.value)} className={recruiterInput} /></label><button disabled={!!busy} className={recruiterPrimary}>Save name</button>{error && <p role="alert" className="text-sm text-rose-700">{error}</p>}</form></RecruiterDrawer>
    <RecruiterDrawer open={!!deleting} onClose={() => { if (!busy) setDeleting(null); }} title="Delete saved search"><p className="text-sm leading-6 text-ink">Delete “{deleting?.name}” and stop its alerts? Candidate data is unaffected.</p><div className="mt-5 flex gap-2"><button className={recruiterSecondary} onClick={() => setDeleting(null)}>Cancel</button><button disabled={!!busy} className={recruiterPrimary} onClick={() => deleting && void remove(deleting)}>Delete search</button></div>{error && <p role="alert" className="mt-4 text-sm text-rose-700">{error}</p>}</RecruiterDrawer>
  </div>;
}
