"use client";

import { useState } from "react";
import { apiRequest } from "@/lib/api";

function normalizeTags(value: string) {
  const seen = new Set<string>();
  return value.split(",").map(tag => tag.trim()).filter(tag => {
    const key = tag.toLowerCase();
    if (!tag || tag.length > 80 || seen.has(key)) return false;
    seen.add(key);
    return true;
  }).slice(0, 20);
}

export function SaveProfileButton({ candidateID, initialSaved, initialTags = [] }: { candidateID: string; initialSaved: boolean; initialTags?: string[] }) {
  const [saved, setSaved] = useState(initialSaved);
  const [tags, setTags] = useState(initialTags);
  const [editingTags, setEditingTags] = useState(false);
  const [tagDraft, setTagDraft] = useState(initialTags.join(", "));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function save(nextTags = tags) {
    const item = await apiRequest<{ tags: string[] }>(`/api/v1/recruiter/talent-pool/${candidateID}`, { method: "PUT", body: JSON.stringify({ tags: nextTags }) });
    setSaved(true);
    setTags(item.tags ?? nextTags);
    setTagDraft((item.tags ?? nextTags).join(", "));
  }

  async function toggle() {
    setBusy(true); setError("");
    try {
      if (saved) {
        await apiRequest(`/api/v1/recruiter/talent-pool/${candidateID}`, { method: "DELETE" });
        setSaved(false); setTags([]); setTagDraft(""); setEditingTags(false);
      } else {
        await save([]);
      }
    } catch { setError("Could not update saved profiles."); }
    finally { setBusy(false); }
  }

  async function updateTags() {
    const next = normalizeTags(tagDraft);
    setBusy(true); setError("");
    try { await save(next); setEditingTags(false); }
    catch { setError("Could not update talent pool tags."); }
    finally { setBusy(false); }
  }

  return <div className="grid gap-2">
    <div className="flex flex-wrap items-center gap-2">
      <button type="button" aria-pressed={saved} disabled={busy} onClick={() => void toggle()} className={`min-h-10 rounded-lg border px-3 text-sm font-bold ${saved ? "border-emerald-300 bg-emerald-50 text-emerald-800" : "border-line text-navy"}`}>{saved ? "Saved · Unsave" : "Save Profile"}</button>
      {saved && <button type="button" disabled={busy} onClick={() => setEditingTags(value => !value)} className="min-h-10 rounded-lg border border-line px-3 text-xs font-bold text-navy hover:bg-slate-50">Manage tags</button>}
    </div>
    {saved && tags.length > 0 && <div className="flex flex-wrap gap-1.5" aria-label="Talent pool tags">{tags.map(tag => <span key={tag} className="rounded-full border border-line bg-slate-50 px-2.5 py-1 text-[11px] font-bold text-ink-muted">{tag}</span>)}</div>}
    {editingTags && <div className="grid gap-2 rounded-xl border border-line bg-slate-50/70 p-3">
      <label className="text-xs font-bold text-navy">Talent pool tags
        <input value={tagDraft} onChange={event => setTagDraft(event.target.value)} maxLength={600} placeholder="e.g. Go, Mumbai, Senior" className="mt-1 h-10 w-full rounded-lg border border-line bg-white px-3 text-sm font-normal text-ink" />
      </label>
      <p className="text-[11px] leading-4 text-ink-muted">Comma-separated. Up to 20 tags, 80 characters each.</p>
      <div className="flex gap-2">
        <button type="button" disabled={busy} onClick={() => void updateTags()} className="min-h-9 rounded-lg bg-indigo px-3 text-xs font-bold text-white disabled:opacity-50">{busy ? "Saving…" : "Save tags"}</button>
        <button type="button" disabled={busy} onClick={() => { setTagDraft(tags.join(", ")); setEditingTags(false); }} className="min-h-9 rounded-lg border border-line px-3 text-xs font-bold text-ink-muted">Cancel</button>
      </div>
    </div>}
    {error && <p role="alert" className="text-xs text-rose-700">{error}</p>}
  </div>;
}
