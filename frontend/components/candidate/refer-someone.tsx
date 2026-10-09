"use client";
import Link from "next/link";
import {useId,useRef,useState,type FormEvent} from "react";
import {Button} from "@/components/ui/button";
import {apiRequest} from "@/lib/api";
import {CandidateReferralSummary} from "@/lib/candidate-referrals";
import {WorkspaceDialog} from "./workspace-dialog";
import "./candidate-workspace.css";
const input="min-h-11 w-full rounded-xl border border-line bg-white px-3 py-2 text-sm font-normal text-ink focus:border-indigo focus:outline-none focus:ring-2 focus:ring-indigo/20";
export function ReferSomeone({jobId,title,company,location,terms="",eligibility="",rewardEnabled=false}:{jobId:string;title:string;company:string;location?:string;terms?:string;eligibility?:string;rewardEnabled?:boolean}){
 const[open,setOpen]=useState(false),[busy,setBusy]=useState(false),[error,setError]=useState(""),[created,setCreated]=useState<CandidateReferralSummary|null>(null);
 const formID=useId(),pending=useRef(false);
 async function submit(e:FormEvent<HTMLFormElement>){
  e.preventDefault();if(pending.current)return;pending.current=true;setBusy(true);setError("");
  const f=new FormData(e.currentTarget);
  try{setCreated(await apiRequest<CandidateReferralSummary>("/api/v1/candidate/referral-invitations",{method:"POST",body:JSON.stringify({job_id:jobId,full_name:f.get("full_name"),email:f.get("email"),phone:f.get("phone"),relationship:f.get("relationship"),note:f.get("note"),knows_person:f.get("knows_person")==="on"})}))}
  catch(c){setError(c instanceof Error?c.message:"Could not queue this invitation. Please try again.")}
  finally{pending.current=false;setBusy(false)}
 }
 return <><button type="button" className="min-h-11 rounded-xl border border-line bg-white px-4 text-sm font-semibold text-ink hover:border-indigo" onClick={()=>{setCreated(null);setError("");setOpen(true)}}>Refer someone</button>
 {open&&<WorkspaceDialog drawer title="Refer someone" busy={busy} onClose={()=>setOpen(false)} footer={created?<Button onClick={()=>setOpen(false)}>Done</Button>:<><Button variant="secondary" disabled={busy} onClick={()=>setOpen(false)}>Cancel</Button><Button form={formID} type="submit" disabled={busy}>{busy?"Queuing…":"Send invitation"}</Button></>}>
 {created?<div role="status" className="grid gap-4"><span aria-hidden="true" className="grid h-12 w-12 place-items-center rounded-full bg-mint text-2xl text-navy">✓</span><h3 className="text-xl font-semibold text-navy">{created.status==="invitation_queued"?"Referral invitation queued":"Referral invitation recorded"}</h3><p className="text-sm leading-7 text-ink">{created.candidate_name} has been invited to consider <strong>{title}</strong> at {company}.</p><p className="text-sm leading-7 text-ink-muted">Email delivery is tracked in My Referrals. No account or application is created on their behalf; they decide whether to apply.</p><Link href="/candidate/referrals" className="inline-flex min-h-11 items-center font-semibold text-indigo hover:underline">View my referrals →</Link></div>:<form id={formID} onSubmit={submit} className="grid gap-5">
 <div><p className="text-sm leading-7 text-ink-muted">Know someone who could be a good fit? Invite them to view this opportunity and decide for themselves.</p><div className="mt-4 rounded-xl border border-line bg-indigo-soft/25 p-4"><h3 className="font-semibold text-navy">{title}</h3><p className="mt-1 text-sm text-ink-muted">{company}{location?` · ${location}`:""}</p></div></div>
 <label className="grid gap-2 text-sm font-semibold text-ink">Full name <input autoComplete="off" required name="full_name" maxLength={160} className={input}/></label>
 <label className="grid gap-2 text-sm font-semibold text-ink">Email <input autoComplete="off" required type="email" name="email" maxLength={320} className={input}/></label>
 <label className="grid gap-2 text-sm font-semibold text-ink">Phone (optional)<input autoComplete="off" type="tel" name="phone" pattern="\+[1-9][0-9]{6,14}" maxLength={16} placeholder="+91…" className={input}/></label>
 <label className="grid gap-2 text-sm font-semibold text-ink">Relationship (optional)<select name="relationship" className={input}><option value="">Select relationship</option>{["Former colleague","Colleague","Friend","Classmate","Family","Other"].map(v=><option key={v}>{v}</option>)}</select></label>
 <label className="grid gap-2 text-sm font-semibold text-ink">Personal message (optional)<textarea name="note" rows={3} maxLength={2000} className={input} placeholder="I thought this opportunity might suit you…"/></label>
 {(terms||eligibility)&&<details className="rounded-xl border border-line px-3"><summary className="min-h-11 cursor-pointer content-center text-sm font-semibold text-navy">Referral {rewardEnabled?"programme ":""}terms</summary>{eligibility&&<div className="py-3"><h4 className="text-sm font-semibold text-ink">Eligibility</h4><p className="mt-1 whitespace-pre-wrap text-sm leading-6 text-ink-muted">{eligibility}</p></div>}{terms&&<p className="whitespace-pre-wrap pb-3 text-sm leading-6 text-ink-muted">{terms}</p>}{rewardEnabled&&<p className="pb-3 text-sm leading-6 text-ink-muted">Rewards require a successful placement and employer review. This invitation does not promise money.</p>}</details>}
 <label className="flex items-start gap-3 text-sm leading-6 text-ink"><input required type="checkbox" name="knows_person" className="mt-1 h-5 w-5 shrink-0 accent-indigo"/>I confirm I have permission to share these contact details for this referral.</label>
 {error&&<p role="alert" className="rounded-xl border border-rose-200 bg-rose-50 p-3 text-sm text-ink">{error}</p>}
 </form>}
 </WorkspaceDialog>}</>
}
