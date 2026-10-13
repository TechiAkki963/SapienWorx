"use client";
import {useEffect} from "react";
import {apiRequest} from "@/lib/api";
export function JobViewEvent({jobID}:{jobID:string}) {
 useEffect(()=>{const controller=new AbortController();let timer:number|undefined,sent=false;
 const record=()=>{if(sent||document.visibilityState!=="visible")return;clearTimeout(timer);timer=window.setTimeout(()=>{if(document.visibilityState!=="visible"||sent)return;sent=true;void apiRequest(`/api/v1/jobs/${encodeURIComponent(jobID)}/views`,{method:"POST",body:"{}",signal:controller.signal}).catch(()=>{/* A view event never prevents a successful page render. */})},600)};
 record();document.addEventListener("visibilitychange",record);return()=>{clearTimeout(timer);controller.abort();document.removeEventListener("visibilitychange",record)}},[jobID]);
 return null;
}
