"use client";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { apiRequest } from "@/lib/api";
import { jobStatuses,label } from "@/lib/recruiter";
export function JobStatusControl({jobId,status}:{jobId:string;status:string}){const router=useRouter();const [busy,setBusy]=useState(false);return <select aria-label="Job status" value={status} disabled={busy} onChange={async e=>{setBusy(true);try{await apiRequest(`/api/v1/recruiter/jobs/${jobId}/status`,{method:"PATCH",body:JSON.stringify({status:e.target.value})});router.refresh();}finally{setBusy(false)}}} className="rounded-lg border border-line bg-white px-2 py-1.5 text-xs font-bold text-ink focus:outline-none focus:ring-2 focus:ring-indigo">{jobStatuses.map(v=><option value={v} key={v}>{label(v)}</option>)}</select>}
