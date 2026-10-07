"use client";
import { useId, useRef, useState, type ReactNode } from "react";
const tabs = ["Overview", "Experience", "Resume", "Interviews", "Matches", "Activity", "Privacy"] as const;
export function Candidate360Sections({ overview, experience, resume, interviews, matches, activity, privacy }: { overview: ReactNode; experience: ReactNode; resume: ReactNode; interviews: ReactNode; matches: ReactNode; activity: ReactNode; privacy: ReactNode }) {
  const [active, setActive] = useState(0);
  const id = useId();
  const buttons = useRef<Array<HTMLButtonElement | null>>([]);
  const panels = [overview, experience, resume, interviews, matches, activity, privacy];
  return <div className="grid min-w-0 gap-4"><nav aria-label="Candidate profile sections" role="tablist" className="flex flex-wrap gap-1 border-b border-line">{tabs.map((tab,index)=><button ref={node=>{buttons.current[index]=node;}} key={tab} id={`${id}-tab-${index}`} aria-controls={`${id}-panel-${index}`} aria-selected={active===index} role="tab" tabIndex={active===index?0:-1} onClick={()=>setActive(index)} onKeyDown={event=>{let next=index;if(event.key==="ArrowRight")next=(index+1)%tabs.length;else if(event.key==="ArrowLeft")next=(index+tabs.length-1)%tabs.length;else if(event.key==="Home")next=0;else if(event.key==="End")next=tabs.length-1;else return;event.preventDefault();setActive(next);buttons.current[next]?.focus();}} className={`min-h-11 border-b-2 px-3 text-sm font-semibold ${active===index?"border-indigo text-indigo":"border-transparent text-ink-muted"}`}>{tab}</button>)}</nav>{panels.map((panel,index)=><div key={tabs[index]} id={`${id}-panel-${index}`} role="tabpanel" tabIndex={0} aria-labelledby={`${id}-tab-${index}`} hidden={active!==index}><div className="grid gap-4">{panel}</div></div>)}</div>;
}
