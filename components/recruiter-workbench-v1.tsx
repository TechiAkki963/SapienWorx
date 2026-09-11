"use client";
import dynamic from "next/dynamic";
import { useState } from "react";
import { WorkspaceShell } from "./ui";
const SavedSearches=dynamic(()=>import("./recruiter-workbench/saved-searches-panel"),{loading:()=> <p role="status">Loading saved searches…</p>});
const Pools=dynamic(()=>import("./recruiter-workbench/pools-panel"),{loading:()=> <p role="status">Loading talent pools…</p>});
const Campaigns=dynamic(()=>import("./recruiter-workbench/campaigns-panel"),{loading:()=> <p role="status">Loading campaigns…</p>});
const Interviews=dynamic(()=>import("./recruiter-workbench/interviews-panel"),{loading:()=> <p role="status">Loading interviews…</p>});
const Controls=dynamic(()=>import("./recruiter-workbench/controls-panel"),{loading:()=> <p role="status">Loading organisation controls…</p>});
type Tab="searches"|"pools"|"campaigns"|"interviews"|"controls";
export function RecruiterWorkbenchV1(){const[tab,setTab]=useState<Tab>("searches");return <WorkspaceShell workspace="recruiter" active="workbench" title="Recruitment workspace" description="Needs-attention work first, with saved searches, talent pools, campaigns, interviews and organisation controls loaded as separate modules."><main className="workbench-v1"><section className="panel workbench-priority"><span className="eyebrow">Needs attention</span><h2>Keep the next hiring decision moving.</h2><p className="muted">Open only the module you need. Each panel loads independently so one slow workflow does not block the rest of the workspace.</p></section><nav className="workflow-tabs" aria-label="Recruitment workspace modules">{([["searches","Saved searches"],["pools","Talent pools"],["campaigns","Campaigns"],["interviews","Interviews"],["controls","Organisation controls"]] as const).map(([id,label])=><button type="button" key={id} className={tab===id?"active":""} aria-selected={tab===id} onClick={()=>setTab(id)}>{label}</button>)}</nav>{tab==="searches"&&<SavedSearches/>}{tab==="pools"&&<Pools/>}{tab==="campaigns"&&<Campaigns/>}{tab==="interviews"&&<Interviews/>}{tab==="controls"&&<Controls/>}</main></WorkspaceShell>}
