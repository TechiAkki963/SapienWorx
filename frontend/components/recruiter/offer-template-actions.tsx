"use client";
import Link from "next/link";
import {useRef,useState} from "react";
import {useRouter} from "next/navigation";
import {apiRequest} from "@/lib/api";
import type {OfferTemplate} from "@/lib/offers";
import {RecruiterModal,RecruiterModalClose,recruiterInput,recruiterPrimary,recruiterSecondary} from "./workspace-ui";
export function OfferTemplateActions({template}:{template:OfferTemplate}){
 const router=useRouter(),key=useRef("");const [open,setOpen]=useState(false),[reason,setReason]=useState(""),[busy,setBusy]=useState(false),[error,setError]=useState("");
 async function archive(){if(busy)return;setBusy(true);setError("");key.current||=crypto.randomUUID();try{await apiRequest(`/api/v1/recruiter/offer-templates/${template.id}/archive`,{method:"POST",body:JSON.stringify({expected_version:template.version,command_key:key.current,reason})});setOpen(false);router.refresh()}catch(e){setError(e instanceof Error?e.message:"Could not archive this template.")}finally{setBusy(false)}}
 return <><div className="flex flex-wrap gap-2"><Link className={recruiterSecondary} href={`/recruiter/offers/templates/${template.id}/edit`}>Edit new version</Link><Link className={recruiterSecondary} href={`/recruiter/offers/templates/new?clone=${template.id}`}>Clone template</Link><button type="button" className={recruiterSecondary} onClick={()=>{key.current="";setReason("");setError("");setOpen(true)}}>Archive template</button></div><RecruiterModal open={open} onClose={()=>setOpen(false)} busy={busy} title="Archive company template" size="small" footer={<><RecruiterModalClose disabled={busy}/><button type="button" className={recruiterPrimary} disabled={busy||reason.trim().length<10} onClick={()=>void archive()}>Confirm archive</button></>}><p className="mb-4 text-sm leading-6 text-ink-muted">{template.name} will be unavailable for new offers. Existing immutable letters and offer history are preserved.</p><label className="grid gap-2 text-sm text-ink">Reason<textarea className={recruiterInput} minLength={10} maxLength={1000} rows={4} value={reason} onChange={e=>{key.current="";setReason(e.target.value)}}/></label>{error&&<p role="alert" className="mt-3 text-sm text-rose-700">{error}</p>}</RecruiterModal></>
}
