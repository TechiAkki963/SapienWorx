"use client";
import {useEffect,useRef,useState} from "react";
import {useRouter} from "next/navigation";
import {apiRequest} from "@/lib/api";
import {jobStatusTransitions} from "@/lib/recruiter";
export function useJobStatusChange(jobID:string,initial:string){
 const router=useRouter();const [value,setValue]=useState(initial),[pending,setPending]=useState(""),[reason,setReason]=useState(""),[busy,setBusy]=useState(false),[error,setError]=useState(""),[undo,setUndo]=useState<{before:string;after:string}|null>(null);const timer=useRef<ReturnType<typeof setTimeout>|null>(null);
 useEffect(()=>setValue(initial),[initial]);useEffect(()=>()=>{if(timer.current)clearTimeout(timer.current)},[]);
 async function change(next:string,note="",reversing=false){if(busy)return;const previous=value;setBusy(true);setError("");setValue(next);try{
  await apiRequest(`/api/v1/recruiter/jobs/${jobID}/status`,{method:"PATCH",body:JSON.stringify({status:next,expected_status:previous,reason:note})});
  setPending("");setReason("");if(!reversing&&!note&&(jobStatusTransitions[next]??[]).includes(previous)){setUndo({before:previous,after:next});if(timer.current)clearTimeout(timer.current);timer.current=setTimeout(()=>setUndo(null),30000)}else setUndo(null);router.refresh();
 }catch(e){setValue(previous);setError(e instanceof Error?e.message:"Could not change job status.");router.refresh()}finally{setBusy(false)}}
 function request(next:string){if(["closed","archived"].includes(next)){setPending(next);setReason("");setError("")}else void change(next)}
 return {value,pending,setPending,reason,setReason,busy,error,undo,change,request};
}
