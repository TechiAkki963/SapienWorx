"use client";
import { useEffect, useRef, useState, useTransition, type ReactNode } from "react";
import { useRouter } from "next/navigation";
export function AutoFilterForm({action,children,label,className}:{action:string;children:ReactNode;label:string;className?:string}) {
 const router=useRouter(); const [ready,setReady]=useState(false);useEffect(()=>setReady(true),[]); const timer=useRef<ReturnType<typeof setTimeout>|null>(null); const [pending,startTransition]=useTransition();
 useEffect(()=>()=>{if(timer.current)clearTimeout(timer.current)},[]);
 function apply(form:HTMLFormElement){if(timer.current)clearTimeout(timer.current);const query=new URLSearchParams();new FormData(form).forEach((value,key)=>{if(typeof value==="string"&&value)query.append(key,value)});query.delete("page");startTransition(()=>router.replace(action+(query.size?"?"+query:""),{scroll:false}));}
 return <form action={action} aria-label={label} aria-busy={pending} className={className} onSubmit={e=>{e.preventDefault();apply(e.currentTarget)}} onChange={e=>{const form=e.currentTarget; if(timer.current)clearTimeout(timer.current);if(e.target instanceof HTMLInputElement&&e.target.type!=="checkbox")timer.current=setTimeout(()=>apply(form),350);else apply(form)}}><fieldset disabled={!ready} className="contents">{children}</fieldset><span className="sr-only" role="status">{pending?"Updating results…":""}</span></form>;
}
