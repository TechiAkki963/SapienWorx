"use client";
import {useEffect,useState} from "react";
import {apiRequest} from "@/lib/api";
type Interest={available:boolean;interested:boolean};
export function CandidateOutreachInterest({threadID}:{threadID:string}) {
 const [state,setState]=useState<Interest|null>(null),[busy,setBusy]=useState(false),[error,setError]=useState("");
 useEffect(()=>{let active=true;setState(null);setError("");apiRequest<Interest>(`/api/v1/candidate/outreach/${threadID}/interest`).then(result=>{if(active)setState(result)}).catch(()=>{});return()=>{active=false}},[threadID]);
 if(!state?.available)return null;
 return <div>{state.interested?<p role="status" className="text-sm font-semibold text-emerald-700">Interest shared with your recruiter</p>:<button type="button" disabled={busy} onClick={async()=>{if(busy)return;setBusy(true);setError("");try{setState(await apiRequest<Interest>(`/api/v1/candidate/outreach/${threadID}/interest`,{method:"POST",body:"{}"}))}catch{setError("Could not share your interest. Try again.")}finally{setBusy(false)}}} className="min-h-11 rounded-lg border border-line px-3 text-sm font-semibold text-indigo">{busy?"Sharing…":"Interested in this opportunity"}</button>}{error&&<p role="alert" className="text-sm text-rose-700">{error}</p>}</div>;
}
