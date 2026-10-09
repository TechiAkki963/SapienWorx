"use client";

import { FormEvent, useId, useState, useEffect } from "react";
import { RecruiterDataTable, RecruiterDrawer, WorkspaceState, recruiterPrimary, recruiterSecondary } from "./workspace-ui";
import { label } from "@/lib/recruiter";
import { apiRequest } from "@/lib/api";

export type OfferItem = {
  id:string; application_id:string; candidate_name:string; job_title:string; job_reference:string;
  title:string; currency:string; annual_compensation?:number; joining_date?:string; expires_at?:string;
  status:string; notes?:string; updated_at:string;
};
export type OfferApplicationOption = { application_id:string; candidate_name:string; job_title:string; job_reference:string; stage:string };

export function OffersWorkspace({initialItems,applications}:{initialItems:OfferItem[];applications:OfferApplicationOption[]}) {
  const formID = useId();
  const [items,setItems]=useState(initialItems);
  const [busy,setBusy]=useState(false);
  const [notice,setNotice]=useState("");
  const [error,setError]=useState("");
  const [open,setOpen]=useState(false);
  const [status,setFilterStatus]=useState("");
  const [selected,setSelected]=useState<OfferItem|null>(null);
  useEffect(()=>{const id=new URLSearchParams(location.search).get("offer_id");setSelected(initialItems.find(item=>item.id===id)??null);},[initialItems]);

  async function create(event:FormEvent<HTMLFormElement>) {
    event.preventDefault(); if(busy)return;
    const node=event.currentTarget;
    const form=new FormData(node);
    setBusy(true);setError("");setNotice("");
    try{
      const item=await apiRequest<OfferItem>("/api/v1/recruiter/offers",{method:"POST",body:JSON.stringify({
        application_id:String(form.get("application_id")||""),
        title:String(form.get("title")||""),
        currency:String(form.get("currency")||"INR"),
        annual_compensation:form.get("annual_compensation")?Number(form.get("annual_compensation")):undefined,
        joining_date:String(form.get("joining_date")||""),
        expires_at:String(form.get("expires_at")||""),
        notes:String(form.get("notes")||""),
      })});
      setItems(current=>[item,...current]);node.reset();setOpen(false);setNotice("Offer draft created.");
    }catch(cause){setError(cause instanceof Error?cause.message:"Could not create offer.");}
    finally{setBusy(false)}
  }

  async function setStatus(id:string,status:string){
    setBusy(true);setError("");setNotice("");
    try{
      await apiRequest("/api/v1/recruiter/offers/"+id,{method:"PATCH",body:JSON.stringify({status})});
      setItems(current=>current.map(item=>item.id===id?{...item,status}:item));
      setNotice(status==="sent"?"Offer shared with candidate.":"Offer status updated.");
    }catch(cause){setError(cause instanceof Error?cause.message:"Could not update offer.");}
    finally{setBusy(false)}
  }

  const visible=items.filter(item=>!status||item.status===status);
  const date=(value?:string)=>value?new Date(value).toLocaleDateString("en-IN",{timeZone:"UTC"}):"Not set";
  const actions=(item:OfferItem)=><details><summary aria-label={`Actions for ${item.candidate_name}`} className={recruiterSecondary}>Actions</summary><div className="mt-2 grid gap-2 border border-line p-2">{item.status==="draft"&&<button disabled={busy} onClick={()=>void setStatus(item.id,"sent")} className={recruiterPrimary}>Send offer</button>}{item.status==="sent"&&<><button disabled={busy} onClick={()=>void setStatus(item.id,"accepted")} className={recruiterSecondary}>Mark accepted</button><button disabled={busy} onClick={()=>void setStatus(item.id,"declined")} className={recruiterSecondary}>Mark declined</button></>}{["draft","sent"].includes(item.status)&&<button disabled={busy} onClick={()=>void setStatus(item.id,"withdrawn")} className={recruiterSecondary}>Withdraw</button>}{!["draft","sent"].includes(item.status)&&<p className="text-xs text-ink-muted">No open actions for this offer.</p>}</div></details>;
  const summary=(item:OfferItem)=><div><p className="font-semibold text-navy">{item.candidate_name}</p><p className="mt-1 text-xs leading-5 text-ink-muted">{item.job_title} · {item.job_reference}</p></div>;
  return <div className="grid min-w-0 gap-4">
    <div className="flex flex-wrap items-center justify-between gap-3"><nav aria-label="Offer status views" className="flex flex-wrap gap-1">{["","draft","sent","accepted","declined","withdrawn","expired"].map(value=><button key={value} aria-pressed={status===value} onClick={()=>setFilterStatus(value)} className={`min-h-11 border-b-2 px-3 text-sm font-semibold ${status===value?"border-indigo text-indigo":"border-transparent text-ink-muted"}`}>{value?label(value):"All offers"}</button>)}</nav><button className={recruiterPrimary} onClick={()=>setOpen(true)}>Create offer</button></div>
    {notice&&<p role="status" className="text-sm text-ink">{notice}</p>}{error&&!open&&<p role="alert" className="text-sm text-rose-700">{error}</p>}
    {visible.length?<RecruiterDataTable label="Recruiter offers" rows={visible} rowKey={item=>item.id} columns={[{key:"candidate",title:"Candidate / job",width:"33%",render:summary},{key:"status",title:"Status",width:"16%",render:item=>label(item.status)},{key:"compensation",title:"Compensation",width:"19%",secondary:true,render:item=>item.annual_compensation!=null?`${item.currency} ${item.annual_compensation.toLocaleString("en-IN")}`:"Not set"},{key:"dates",title:"Key dates",width:"20%",render:item=><div className="text-xs leading-6 text-ink-muted"><p>Expires {date(item.expires_at)}</p><p>Joining {date(item.joining_date)}</p></div>},{key:"actions",title:"Actions",width:"12%",render:actions}]} mobileRow={item=><div className="grid gap-3">{summary(item)}<p className="text-sm text-ink">{label(item.status)}</p><p className="text-xs text-ink-muted">{item.annual_compensation!=null?`${item.currency} ${item.annual_compensation.toLocaleString("en-IN")}`:"Compensation not set"} · Joining {date(item.joining_date)}</p>{actions(item)}</div>}/>:<WorkspaceState title="No offers in this view" description="Choose another status or create a draft linked to an authorized application." />}
    <RecruiterDrawer open={!!selected} onClose={()=>setSelected(null)} title="Offer details">{selected&&<div className="space-y-4">{summary(selected)}<h3 className="text-lg font-semibold text-navy">{selected.title}</h3><p>{label(selected.status)}</p><p className="text-sm text-ink-muted">Joining {date(selected.joining_date)} · Expires {date(selected.expires_at)}</p><p className="text-sm">{selected.annual_compensation!=null?`${selected.currency} ${selected.annual_compensation.toLocaleString("en-IN")}`:"Compensation not set"}</p>{selected.notes&&<p className="whitespace-pre-wrap text-sm text-ink-muted">{selected.notes}</p>}</div>}</RecruiterDrawer>
    <RecruiterDrawer open={open} onClose={()=>{if(!busy)setOpen(false);}} title="Create offer" footer={<><button type="button" disabled={busy} onClick={()=>setOpen(false)} className={recruiterSecondary}>Cancel</button><button type="submit" form={formID} disabled={busy} className={recruiterPrimary}>{busy?"Saving…":"Create draft"}</button></>}><form id={formID} onSubmit={create} className="min-w-0">
      <p className="text-[13px] font-extrabold uppercase tracking-[0.1em] text-indigo">Create offer</p>
      <h2 className="mt-1 text-xl font-bold text-navy">Draft from an application</h2>
      <p className="mt-1 text-sm leading-6 text-ink-muted">Offer records stay linked to the company application and pipeline.</p>
      <div className="mt-5 grid gap-3">
        <label className="grid min-w-0 gap-1 text-xs font-bold text-ink-muted">Application<select name="application_id" required className="min-h-11 w-full min-w-0 rounded-xl border border-line bg-white px-3 text-sm"><option value="">Choose candidate and role</option>{applications.map(a=><option key={a.application_id} value={a.application_id}>{a.candidate_name} · {a.job_reference} · {a.job_title}</option>)}</select></label>
        <label className="grid min-w-0 gap-1 text-xs font-bold text-ink-muted">Offer title<input name="title" defaultValue="Employment offer" maxLength={200} className="min-h-11 w-full min-w-0 rounded-xl border border-line px-3 text-sm"/></label>
        <div className="grid gap-3 sm:grid-cols-[7rem_1fr]"><label className="grid min-w-0 gap-1 text-xs font-bold text-ink-muted">Currency<input name="currency" defaultValue="INR" maxLength={3} className="min-h-11 w-full min-w-0 rounded-xl border border-line px-3 text-sm uppercase"/></label><label className="grid min-w-0 gap-1 text-xs font-bold text-ink-muted">Annual compensation<input name="annual_compensation" type="number" min="0" step="1000" className="min-h-11 w-full min-w-0 rounded-xl border border-line px-3 text-sm"/></label></div>
        <div className="grid gap-3 sm:grid-cols-2"><label className="grid min-w-0 gap-1 text-xs font-bold text-ink-muted">Expires on<input name="expires_at" type="date" className="min-h-11 w-full min-w-0 rounded-xl border border-line px-3 text-sm"/></label><label className="grid min-w-0 gap-1 text-xs font-bold text-ink-muted">Joining date<input name="joining_date" type="date" className="min-h-11 w-full min-w-0 rounded-xl border border-line px-3 text-sm"/></label></div>
        <label className="grid min-w-0 gap-1 text-xs font-bold text-ink-muted">Internal note<textarea name="notes" rows={4} maxLength={5000} className="w-full min-w-0 rounded-xl border border-line px-3 py-2 text-sm"/></label>
      </div>
      {notice&&<p role="status" className="mt-3 rounded-xl bg-emerald-50 px-3 py-2 text-sm font-semibold text-emerald-800">{notice}</p>}
      {error&&<p role="alert" className="mt-3 rounded-xl bg-rose-50 px-3 py-2 text-sm font-semibold text-rose-800">{error}</p>}
    </form></RecruiterDrawer>
  </div>;
}
