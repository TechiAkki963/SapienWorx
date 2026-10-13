"use client";
import { useRef, useState } from "react";
import { apiRequest } from "@/lib/api";
import { RecruiterModal, recruiterPrimary, recruiterSecondary } from "./workspace-ui";
type CVResponse={download:{url:string;expires_at:string};filename:string;provenance?:string};
function safeDocumentURL(value:string){const url=new URL(value,location.origin);if(url.protocol!=="https:"&&!(url.protocol==="http:"&&["localhost","127.0.0.1"].includes(url.hostname)))throw new Error("Document link is unavailable.");return url.toString()}
export function CandidateCVButton({candidateID,applicationID,available=true}:{candidateID:string;applicationID?:string;available?:boolean}) {
 const [open,setOpen]=useState(false),[busy,setBusy]=useState(false),[document,setDocument]=useState<CVResponse|null>(null),[error,setError]=useState("");
 const generation=useRef(0);
 function path(mode:string){const query=new URLSearchParams({mode});if(applicationID)query.set("application_id",applicationID);return `/api/v1/recruiter/candidates/${candidateID}/cv?${query}`}
 async function preview(){if(busy)return;setOpen(true);setBusy(true);setError("");setDocument(null);const current=++generation.current;try{const result=await apiRequest<CVResponse>(path("view"),{cache:"no-store"});result.download.url=safeDocumentURL(result.download.url);if(current===generation.current)setDocument(result)}catch(cause){if(current===generation.current)setError(cause instanceof Error?cause.message:"This resume is unavailable.")}finally{if(current===generation.current)setBusy(false)}}
 async function download(){if(busy)return;setBusy(true);setError("");try{const result=await apiRequest<CVResponse>(path("download"),{cache:"no-store"});const link=window.document.createElement("a");link.href=safeDocumentURL(result.download.url);link.target="_blank";link.rel="noopener noreferrer";link.download=result.filename;link.click()}catch(cause){setError(cause instanceof Error?cause.message:"Resume download is unavailable.")}finally{setBusy(false)}}
 function close(){++generation.current;setOpen(false);setBusy(false);setDocument(null)}
 return <><button type="button" className={recruiterSecondary} onClick={()=>void preview()} disabled={!available} aria-label={available?"View CV":"CV unavailable"}>{available?"View CV":"CV unavailable"}</button><RecruiterModal open={open} onClose={close} title="Candidate resume" size="extra-large" protectChanges={false} footer={<><button className={recruiterSecondary} onClick={close}>Close</button>{document&&<button className={recruiterPrimary} disabled={busy} onClick={()=>void download()}>Download CV</button>}</>}>
 {busy&&!document&&<p role="status" className="py-8 text-sm text-ink-muted">Opening the authorized resume…</p>}
 {error&&<p role="alert" className="rounded-lg border border-line p-4 text-sm text-ink-muted">{error}</p>}
 {document&&<><p className="mb-2 break-words text-sm font-semibold text-ink">{document.filename}</p>{document.provenance==="legacy_current_at_migration"&&<p className="mb-3 text-xs leading-6 text-ink-muted">Resume on file for a historical application. The original submission version was not recorded.</p>}<iframe src={document.download.url} title={`Resume preview: ${document.filename}`} referrerPolicy="no-referrer" className="h-[60dvh] w-full rounded-lg border border-line bg-slate-50" /><p className="mt-2 text-xs leading-6 text-ink-muted">If your browser cannot display this PDF, use Download CV.</p></>}
 </RecruiterModal></>;
}
