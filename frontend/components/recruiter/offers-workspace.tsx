"use client";

import { FormEvent, useState } from "react";
import { apiRequest } from "@/lib/api";

export type OfferItem = {
  id:string; application_id:string; candidate_name:string; job_title:string; job_reference:string;
  title:string; currency:string; annual_compensation?:number; joining_date?:string; expires_at?:string;
  status:string; notes?:string; updated_at:string;
};
export type OfferApplicationOption = { application_id:string; candidate_name:string; job_title:string; job_reference:string; stage:string };

export function OffersWorkspace({initialItems,applications}:{initialItems:OfferItem[];applications:OfferApplicationOption[]}) {
  const [items,setItems]=useState(initialItems);
  const [busy,setBusy]=useState(false);
  const [notice,setNotice]=useState("");
  const [error,setError]=useState("");

  async function create(event:FormEvent<HTMLFormElement>) {
    event.preventDefault(); if(busy)return;
    const form=new FormData(event.currentTarget);
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
      setItems(current=>[item,...current]);event.currentTarget.reset();setNotice("Offer draft created.");
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

  return <div className="grid min-w-0 max-w-full gap-5 xl:grid-cols-[minmax(20rem,.78fr)_minmax(0,1.22fr)]">
    <form onSubmit={create} className="min-w-0 rounded-2xl border border-line/70 bg-white p-5 shadow-sm">
      <p className="text-[10px] font-extrabold uppercase tracking-[.14em] text-indigo">Create offer</p>
      <h2 className="mt-1 text-xl font-bold text-navy">Draft from an application</h2>
      <p className="mt-1 text-sm leading-6 text-ink-muted">Offer records stay linked to the company application and pipeline.</p>
      <div className="mt-5 grid gap-3">
        <label className="grid min-w-0 gap-1 text-xs font-bold text-ink-muted">Application<select name="application_id" required className="min-h-11 w-full min-w-0 rounded-xl border border-line bg-white px-3 text-sm"><option value="">Choose candidate and role</option>{applications.map(a=><option key={a.application_id} value={a.application_id}>{a.candidate_name} · {a.job_reference} · {a.job_title}</option>)}</select></label>
        <label className="grid min-w-0 gap-1 text-xs font-bold text-ink-muted">Offer title<input name="title" defaultValue="Employment offer" maxLength={200} className="min-h-11 w-full min-w-0 rounded-xl border border-line px-3 text-sm"/></label>
        <div className="grid gap-3 sm:grid-cols-[7rem_1fr]"><label className="grid min-w-0 gap-1 text-xs font-bold text-ink-muted">Currency<input name="currency" defaultValue="INR" maxLength={3} className="min-h-11 w-full min-w-0 rounded-xl border border-line px-3 text-sm uppercase"/></label><label className="grid min-w-0 gap-1 text-xs font-bold text-ink-muted">Annual compensation<input name="annual_compensation" type="number" min="0" step="1000" className="min-h-11 w-full min-w-0 rounded-xl border border-line px-3 text-sm"/></label></div>
        <div className="grid gap-3 sm:grid-cols-2"><label className="grid min-w-0 gap-1 text-xs font-bold text-ink-muted">Expires on<input name="expires_at" type="date" className="min-h-11 w-full min-w-0 rounded-xl border border-line px-3 text-sm"/></label><label className="grid min-w-0 gap-1 text-xs font-bold text-ink-muted">Joining date<input name="joining_date" type="date" className="min-h-11 w-full min-w-0 rounded-xl border border-line px-3 text-sm"/></label></div>
        <label className="grid min-w-0 gap-1 text-xs font-bold text-ink-muted">Internal note<textarea name="notes" rows={4} maxLength={5000} className="w-full min-w-0 rounded-xl border border-line px-3 py-2 text-sm"/></label>
        <button disabled={busy} className="min-h-11 rounded-xl bg-indigo px-4 text-sm font-extrabold text-white disabled:opacity-50">{busy?"Saving…":"Create draft"}</button>
      </div>
      {notice&&<p role="status" className="mt-3 rounded-xl bg-emerald-50 px-3 py-2 text-sm font-semibold text-emerald-800">{notice}</p>}
      {error&&<p role="alert" className="mt-3 rounded-xl bg-rose-50 px-3 py-2 text-sm font-semibold text-rose-800">{error}</p>}
    </form>

    <section className="min-w-0 rounded-2xl border border-line/70 bg-white p-5 shadow-sm">
      <div className="flex flex-wrap items-end justify-between gap-3"><div><p className="text-[10px] font-extrabold uppercase tracking-[.14em] text-indigo">Offer pipeline</p><h2 className="mt-1 text-xl font-bold text-navy">Offers in progress</h2></div><span className="rounded-full bg-indigo-soft px-3 py-1 text-xs font-bold text-indigo">{items.length} records</span></div>
      <div className="mt-4 grid gap-3">{items.length?items.map(item=><article key={item.id} className="rounded-xl border border-line/70 p-4">
        <div className="flex flex-wrap items-start justify-between gap-3"><div><p className="font-extrabold text-navy">{item.candidate_name}</p><p className="mt-1 text-xs font-semibold text-indigo">{item.job_reference} · {item.job_title}</p></div><span className="rounded-full bg-slate-100 px-2.5 py-1 text-[10px] font-extrabold uppercase tracking-[.06em] text-ink-muted">{item.status}</span></div>
        <div className="mt-3 grid gap-2 text-xs text-ink-muted sm:grid-cols-3"><p><strong className="block text-ink">Compensation</strong>{item.annual_compensation?item.currency+" "+item.annual_compensation.toLocaleString("en-IN"):"Not set"}</p><p><strong className="block text-ink">Expires</strong>{item.expires_at?new Date(item.expires_at).toLocaleDateString("en-IN", { timeZone: "Asia/Kolkata" }):"Not set"}</p><p><strong className="block text-ink">Joining</strong>{item.joining_date?new Date(item.joining_date).toLocaleDateString("en-IN", { timeZone: "UTC" }):"Not set"}</p></div>
        <div className="mt-4 flex flex-wrap gap-2">{item.status==="draft"&&<button disabled={busy} onClick={()=>setStatus(item.id,"sent")} className="rounded-lg bg-indigo px-3 py-2 text-xs font-bold text-white">Send offer</button>}{item.status==="sent"&&<><button disabled={busy} onClick={()=>setStatus(item.id,"accepted")} className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs font-bold text-emerald-800">Mark accepted</button><button disabled={busy} onClick={()=>setStatus(item.id,"declined")} className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-xs font-bold text-rose-800">Mark declined</button></>}{["draft","sent"].includes(item.status)&&<button disabled={busy} onClick={()=>setStatus(item.id,"withdrawn")} className="rounded-lg border border-line px-3 py-2 text-xs font-bold text-ink-muted">Withdraw</button>}</div>
      </article>):<div className="rounded-xl border border-dashed border-line p-6 text-center text-sm text-ink-muted">No offers yet. Create a draft from an active application.</div>}</div>
    </section>
  </div>;
}
