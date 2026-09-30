"use client";

import { useState } from "react";
import { apiRequest } from "@/lib/api";

export function SaveDiscoverySearch({filters}:{filters:Record<string,string|undefined>}){
 const [name,setName]=useState(""); const [status,setStatus]=useState("");
 async function save(){if(!name.trim())return;setStatus("Saving…");const clean=Object.fromEntries(Object.entries(filters).filter(([,v])=>v));try{await apiRequest("/api/v1/recruiter/saved-searches",{method:"POST",body:JSON.stringify({name:name.trim(),filters:clean})});setStatus("Saved");setName("")}catch{setStatus("Could not save")}}
 return <div className="grid gap-2 rounded-xl border border-line/70 bg-slate-50/70 p-3"><label className="text-xs font-bold text-navy">Save this search<input value={name} onChange={e=>setName(e.target.value)} maxLength={120} placeholder="e.g. Mumbai sales leaders" className="mt-1 min-h-10 w-full rounded-lg border border-line bg-white px-3 text-sm"/></label><button type="button" onClick={save} className="min-h-10 rounded-lg border border-indigo/25 bg-white px-3 text-xs font-extrabold text-indigo">Save search</button>{status&&<p role="status" className="text-[11px] text-ink-muted">{status}</p>}</div>
}
export function DiscoveryCandidateActions({candidateID}:{candidateID:string}){
 const [saved,setSaved]=useState(false);const [status,setStatus]=useState("");
 async function add(){setStatus("Saving…");try{await apiRequest(`/api/v1/recruiter/talent-pool/${candidateID}`,{method:"PUT",body:JSON.stringify({tags:[]})});setSaved(true);setStatus("Added to Talent Pool")}catch{setStatus("Could not add")}}
 return <div className="flex flex-wrap items-center gap-2"><button type="button" disabled={saved} onClick={add} className="inline-flex min-h-10 items-center justify-center rounded-lg border border-line px-3 text-xs font-bold text-navy hover:bg-slate-50 disabled:bg-mint/30 disabled:text-emerald-800">{saved?"In Talent Pool":"Add to Talent Pool"}</button>{status&&<span role="status" className="text-[11px] text-ink-muted">{status}</span>}</div>
}
