"use client";
import { useState, type ReactNode } from "react";
import { RecruiterDrawer, recruiterSecondary } from "./workspace-ui";
export function FilterDrawer({children,count=0}:{children:ReactNode;count?:number}){const[open,setOpen]=useState(false);return <><button type="button" onClick={()=>setOpen(true)} className={recruiterSecondary}>Filters{count?` (${count})`:""}</button><RecruiterDrawer side="left" open={open} onClose={()=>setOpen(false)} title="Application filters">{children}</RecruiterDrawer></>}
