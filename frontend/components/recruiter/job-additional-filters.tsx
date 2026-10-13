"use client";
import {useState} from "react";
import type {RecruiterTeamMember} from "@/lib/recruiter";
import {FilterDrawer} from "./filter-drawer";
import {recruiterInput,recruiterPrimary} from "./workspace-ui";

export function JobAdditionalFilters({values,preserved,team}:{values:Record<string,string>;preserved:[string,string][];team:RecruiterTeamMember[]}){
 const [from,setFrom]=useState(values.posted_from),[through,setThrough]=useState(values.posted_to);
 const count=Object.values(values).filter(Boolean).length;
 return <FilterDrawer title="Job filters" count={count}><form action="/recruiter/jobs" method="GET" aria-label="Additional job filters" className="grid gap-4">
  {preserved.map(([key,value])=><input type="hidden" key={key} name={key} value={value}/>)}
  <label className="grid gap-2 text-sm font-semibold text-ink">Location<input name="location" defaultValue={values.location} maxLength={160} className={recruiterInput} placeholder="City or state"/></label>
  <label className="grid gap-2 text-sm font-semibold text-ink">Department<input name="department" defaultValue={values.department} maxLength={160} className={recruiterInput}/></label>
  <label className="grid gap-2 text-sm font-semibold text-ink">Posted by<select name="posted_by" defaultValue={values.posted_by} className={recruiterInput}><option value="">Any company recruiter</option>{values.posted_by&&!team.some(member=>member.user_id===values.posted_by)&&<option value={values.posted_by}>Previously selected recruiter</option>}{team.map(member=><option key={member.user_id} value={member.user_id}>{member.full_name}</option>)}</select></label>
  <div className="grid gap-4 sm:grid-cols-2"><label className="grid gap-2 text-sm font-semibold text-ink">Posted from<input type="date" name="posted_from" value={from} onChange={e=>setFrom(e.target.value)} max={through||undefined} className={recruiterInput}/></label><label className="grid gap-2 text-sm font-semibold text-ink">Posted through<input type="date" name="posted_to" value={through} onChange={e=>setThrough(e.target.value)} min={from||undefined} className={recruiterInput}/></label></div>
  <p className="text-xs leading-6 text-ink-muted">Posted dates use India time. Drafts have no posted date.</p>
  <button type="submit" className={recruiterPrimary}>Apply job filters</button>
 </form></FilterDrawer>;
}
