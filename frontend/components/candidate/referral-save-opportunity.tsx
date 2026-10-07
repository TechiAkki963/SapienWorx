"use client";
import {useEffect,useState} from "react";
import {apiRequest} from "@/lib/api";
import {useJobSave} from "./use-job-save";
export function ReferralSaveOpportunity({jobID}:{jobID:string}){
 const [initial,setInitial]=useState(false),[ready,setReady]=useState(false),[loadError,setLoadError]=useState("");
 const{saved,busy,error,toggle}=useJobSave(jobID,initial);
 useEffect(()=>{let active=true;setReady(false);setLoadError("");apiRequest<{items:{id:string}[]|null}>("/api/v1/candidate/saved-jobs").then(x=>{if(active){setInitial((x.items||[]).some(item=>item.id===jobID));setReady(true)}}).catch(()=>{if(active)setLoadError("Saved-job status is unavailable. Refresh to try again.")});return()=>{active=false}},[jobID]);
 return <div><button type="button" disabled={!ready||busy} aria-pressed={saved} onClick={()=>void toggle()} className="min-h-11 rounded-xl border border-line bg-white px-4 text-sm font-semibold text-ink disabled:opacity-50">{busy?"Updating…":saved?"Remove from saved jobs":"Save opportunity"}</button>{(loadError||error)&&<p role="alert" className="mt-2 text-sm text-ink">{loadError||error}</p>}</div>
}
