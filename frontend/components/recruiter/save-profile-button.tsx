"use client";

import { useState } from "react";
import { apiRequest } from "@/lib/api";

export function SaveProfileButton({ candidateID, initialSaved }: { candidateID: string; initialSaved: boolean }) {
  const [saved, setSaved] = useState(initialSaved);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  async function toggle() {
    setBusy(true); setError("");
    try { await apiRequest(`/api/v1/recruiter/talent-pool/${candidateID}`, saved ? { method: "DELETE" } : { method: "PUT", body: JSON.stringify({ tags: [] }) }); setSaved(!saved); }
    catch { setError("Could not update saved profiles."); }
    finally { setBusy(false); }
  }
  return <div><button type="button" aria-pressed={saved} disabled={busy} onClick={() => void toggle()} className={`min-h-10 rounded-lg border px-3 text-sm font-bold ${saved ? "border-emerald-300 bg-emerald-50 text-emerald-800" : "border-line text-navy"}`}>{saved ? "Saved · Unsave" : "Save Profile"}</button>{error && <p role="alert" className="text-xs text-rose-700">{error}</p>}</div>;
}
