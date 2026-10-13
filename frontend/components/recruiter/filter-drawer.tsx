"use client";
import { useState, type ReactNode } from "react";
import { RecruiterModal, recruiterSecondary } from "./workspace-ui";
export function FilterDrawer({children,count=0,title="Application filters"}:{children:ReactNode;count?:number;title?:string}){const[open,setOpen]=useState(false);return <><button type="button" onClick={()=>setOpen(true)} className={recruiterSecondary}>Filters{count?` (${count})`:""}</button><RecruiterModal open={open} onClose={()=>setOpen(false)} title={title}>{children}</RecruiterModal></>}
