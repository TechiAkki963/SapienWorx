"use client";
import {type NamedPool} from "./create-pool";

import Link from "next/link";
import { AnimatePresence, motion } from "motion/react";
import { useEffect, useMemo, useState } from "react";

import {
  BulkInMailDrawer,
  type BulkMessageTemplate,
  type BulkRecruiterJob,
} from "@/components/recruiter/bulk-inmail-drawer";
import { RecruiterTagList } from "@/components/recruiter/recruiter-tag";
import { apiRequest } from "@/lib/api";
import { RecruiterDataTable, RecruiterDrawer, recruiterInput, recruiterPrimary, recruiterSecondary } from "./workspace-ui";
import { experience } from "@/lib/recruiter";

export type TalentPoolCandidate = {
  candidate_id: string;
  full_name: string;
  headline?: string;
  current_city?: string;
  experience_months: number;
  notice_period_days?: number;
  tags: string[];
  saved_at: string; saved_by?:string;current_company?:string;last_active_at?:string;skills?:string[];
};

function candidateInitials(name: string) {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .map((part) => part[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();
}

function savedDate(value: string) {
  return new Intl.DateTimeFormat("en-GB", {
    timeZone: "Asia/Kolkata",
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(new Date(value));
}

function SelectionCheckbox({
  checked,
  onChange,
  label,
}: {
  checked: boolean;
  onChange: () => void;
  label: string;
}) {
  return (
    <label className="group relative inline-flex h-9 w-9 shrink-0 cursor-pointer items-center justify-center rounded-lg transition hover:bg-[#e8f6f1] focus-within:ring-2 focus-within:ring-[#24A47F]/30">
      <input
        type="checkbox"
        checked={checked}
        onChange={onChange}
        aria-label={label}
        className="peer h-[18px] w-[18px] cursor-pointer appearance-none rounded-[5px] border-2 border-[#aab9b4] bg-white transition checked:border-[#24A47F] checked:bg-[#24A47F] focus:outline-none"
      />
      <svg
        aria-hidden="true"
        viewBox="0 0 16 16"
        className="pointer-events-none absolute h-3 w-3 scale-75 fill-none stroke-white stroke-[2.2] opacity-0 transition peer-checked:scale-100 peer-checked:opacity-100"
      >
        <path d="m3.25 8.2 2.8 2.8 6.7-6.7" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    </label>
  );
}

export function TalentPoolSelection({
  items: initialItems,
  messageTemplates,
  activeJobs, poolID, canEdit=true, smart=false, pools=[],
}: {
  poolID?:string;canEdit?:boolean;smart?:boolean;pools?:NamedPool[];
  items: TalentPoolCandidate[];
  messageTemplates: BulkMessageTemplate[];
  activeJobs: BulkRecruiterJob[];
}) {
  const [addOpen,setAddOpen]=useState(false);
  const [targetPool,setTargetPool]=useState("");
  const [items,setItems] = useState(initialItems);
  useEffect(()=>setItems(initialItems),[initialItems]);
  const [editor,setEditor] = useState<TalentPoolCandidate | "bulk" | "remove" | null>(null);
  const [tags,setTags] = useState("");
  const [busy,setBusy] = useState(false);
  const [error,setError] = useState("");
  const [notice,setNotice] = useState("");
  const [selected, setSelected] = useState<Set<string>>(() => new Set());

  useEffect(()=>setSelected(current=>new Set([...current].filter(id=>initialItems.some(candidate=>candidate.candidate_id===id)))),[initialItems]);
  const allSelected = items.length > 0 && items.every(candidate=>selected.has(candidate.candidate_id));
  const selectedCount = selected.size;
  const selectedCandidateIDs = useMemo(() => Array.from(selected), [selected]);

  function toggleCandidate(candidateID: string) {
    setSelected((current) => {
      const next = new Set(current);
      if (next.has(candidateID)) next.delete(candidateID);
      else next.add(candidateID);
      return next;
    });
  }

  function toggleAll() {
    setSelected(() => {
      if (allSelected) return new Set();
      return new Set(items.map((candidate) => candidate.candidate_id));
    });
  }

  function clearSelection() {
    setSelected(new Set());
  }

  function requestBulkComposer() {
    window.dispatchEvent(
      new CustomEvent("sapienworx:open-bulk-inmail", {
        detail: { candidateIDs: selectedCandidateIDs },
      }),
    );
  }

  function openEditor(candidate:TalentPoolCandidate | "bulk") {
    setEditor(candidate);setTags(candidate === "bulk" ? "" : candidate.tags.join(", "));setError("");
  }
  async function updateBookmarks(remove=false) {
    if(busy || !editor)return;
    const candidates=typeof editor === "object" ? [editor] : items.filter(candidate=>selected.has(candidate.candidate_id));
    const clean=Array.from(new Map(tags.split(",").map(tag=>tag.trim()).filter(Boolean).map(tag=>[tag.toLowerCase(),tag])).values());
    if(!remove && (clean.length>20 || clean.some(tag=>tag.length>80))) {setError("Use up to 20 pool tags, each at most 80 characters.");return;}
    const updates=candidates.map(candidate=>({candidate,tags:editor === "bulk" ? Array.from(new Map([...candidate.tags,...clean].map(tag=>[tag.toLowerCase(),tag])).values()) : clean}));
    if(!remove && updates.some(item=>item.tags.length>20)){setError("A selected candidate would exceed 20 tags. Edit that candidate’s pool tags first.");return;}
    setBusy(true);setError("");setNotice("");
    const succeeded=new Set<string>();
    for(const item of updates){try{await apiRequest(poolID?`/api/v1/recruiter/talent-pools/${poolID}/candidates/${encodeURIComponent(item.candidate.candidate_id)}`:`/api/v1/recruiter/talent-pool/${encodeURIComponent(item.candidate.candidate_id)}`,remove?{method:"DELETE"}:{method:"PUT",body:JSON.stringify({tags:item.tags})});succeeded.add(item.candidate.candidate_id);}catch{/* Report partial results while retaining failed selections. */}}
    setItems(current=>remove?current.filter(candidate=>!succeeded.has(candidate.candidate_id)):current.map(candidate=>{const item=updates.find(item=>item.candidate.candidate_id===candidate.candidate_id);return item && succeeded.has(candidate.candidate_id)?{...candidate,tags:item.tags}:candidate;}));
    setSelected(new Set(candidates.filter(candidate=>!succeeded.has(candidate.candidate_id)).map(candidate=>candidate.candidate_id)));
    setBusy(false);
    if(succeeded.size!==candidates.length){setError(`${succeeded.size} of ${candidates.length} bookmarks updated. Some could not be updated; retry after checking your connection.`);}
    else {setNotice(remove?`${succeeded.size} bookmarks removed. Candidate records are retained.`:"Pool tags updated.");setEditor(null);}
  }

  return (
    <>
      {notice && <p role="status" className="text-sm text-ink">{notice}</p>}
      <RecruiterDrawer open={editor!==null} onClose={()=>{if(!busy)setEditor(null);}} title={editor==="remove"?"Remove selected bookmarks":"Edit pool tags"} footer={<><button type="button" className={recruiterSecondary} disabled={busy} onClick={()=>setEditor(null)}>Cancel</button><button type="button" className={recruiterPrimary} disabled={busy} onClick={()=>updateBookmarks(editor==="remove")}>{busy?"Updating…":editor==="remove"?"Remove bookmarks":"Save pool tags"}</button></>}>
        {editor==="remove" ? <p className="text-sm leading-7 text-ink">Remove {selected.size} selected private bookmarks from your talent pool? Candidate profiles, applications and conversations are retained.</p> : <><p className="mb-4 text-sm leading-7 text-ink-muted">{editor==="bulk"?"Add tags to the selected candidates while preserving their existing pool groups.":typeof editor==="object"&&editor?`Organize ${editor.full_name} with private pool tags.`:""}</p><label className="grid gap-2 text-sm font-semibold text-ink">Pool tags<input className={recruiterInput} value={tags} onChange={event=>setTags(event.target.value)} placeholder="e.g. Engineering, Future roles"/></label><p className="mt-2 text-xs leading-6 text-ink-muted">Separate tags with commas. Up to 20 tags per candidate.</p></>}
        {error && <p role="alert" className="mt-4 text-sm text-rose-700">{error}</p>}
      </RecruiterDrawer>
      <RecruiterDrawer open={addOpen} onClose={()=>{if(!busy)setAddOpen(false)}} title="Add selected candidates to pool" footer={<><button disabled={busy} className={recruiterSecondary} onClick={()=>setAddOpen(false)}>Cancel</button><button disabled={busy||!targetPool} className={recruiterPrimary} onClick={async()=>{setBusy(true);setError("");const ids=[...selected];const results=await Promise.allSettled(ids.map(id=>apiRequest(`/api/v1/recruiter/talent-pools/${targetPool}/candidates/${id}`,{method:"PUT",body:JSON.stringify({})})));const failed=ids.filter((_,i)=>results[i].status==="rejected");setBusy(false);if(failed.length){setSelected(new Set(failed));setError(`${ids.length-failed.length} of ${ids.length} added. Failed selections retained.`)}else{setAddOpen(false);setNotice("Candidates added to pool.");clearSelection()}}}>Add to pool</button></>}><label className="grid gap-2 text-sm font-semibold text-ink">Pool<select value={targetPool} onChange={e=>setTargetPool(e.target.value)} className={recruiterInput}><option value="">Choose a pool you own</option>{pools.filter(p=>p.can_edit&&p.kind==="manual").map(p=><option key={p.id} value={p.id}>{p.name} · {p.visibility}</option>)}</select></label>{error&&<p role="alert" className="mt-3 text-sm text-rose-700">{error}</p>}</RecruiterDrawer>
      <section className="overflow-hidden rounded-2xl border border-line/70 bg-white shadow-[0_8px_24px_rgba(16,33,63,0.05)]">
        <div className="flex flex-col gap-3 border-b border-line/70 bg-[#fbfcfe] px-3 py-3 sm:flex-row sm:items-center sm:justify-between sm:px-4">
          <div className="flex items-center gap-2.5">
            <SelectionCheckbox checked={allSelected} onChange={toggleAll} label={allSelected ? "Clear all candidates" : "Select all candidates"} />
            <div>
              <p className="text-sm font-semibold text-navy">Select visible candidates</p>

            </div>
          </div>
          <div className="flex items-center gap-2">
            {selectedCount > 0 && (
              <button type="button" onClick={clearSelection} className="min-h-9 rounded-lg px-3 text-xs font-bold text-ink-muted transition hover:bg-white hover:text-navy">
                Clear selection
              </button>
            )}
            {selectedCount>0&&<span className="rounded-lg border border-line bg-indigo-soft px-3 py-2 text-xs font-extrabold text-indigo">
              {selectedCount} selected
            </span>}
          </div>
        </div>

        <RecruiterDataTable label="Saved candidates" rows={items} rowKey={candidate=>candidate.candidate_id} columns={[
          {key:"candidate",title:"Candidate",width:"34%",render:candidate=><div className="flex items-start gap-2"><SelectionCheckbox checked={selected.has(candidate.candidate_id)} onChange={()=>toggleCandidate(candidate.candidate_id)} label={`${selected.has(candidate.candidate_id)?"Deselect":"Select"} ${candidate.full_name}`} /><div className="min-w-0"><Link className="break-words font-semibold text-navy" href={`/recruiter/candidates/${candidate.candidate_id}?from=talent-pool`}>{candidate.full_name}</Link><p className="mt-1 text-xs leading-5 text-ink-muted">{candidate.headline}</p>{candidate.current_company&&<p className="text-xs text-ink-muted">{candidate.current_company}</p>}{candidate.last_active_at&&<p className="mt-1 text-xs text-ink-muted">Active {savedDate(candidate.last_active_at)}</p>}</div></div>},
          {key:"experience",title:"Experience / location",width:"24%",render:candidate=><div className="grid gap-1 text-xs text-ink-muted"><p>{experience(candidate.experience_months)}</p><p>{candidate.current_city || "Location not provided"}</p><p>{candidate.notice_period_days==null?"Notice not provided":candidate.notice_period_days===0?"Immediate":`${candidate.notice_period_days} days notice`}</p></div>},
          {key:"groups",title:"Skills / tags",width:"23%",render:candidate=><div><p className="text-xs leading-5 text-ink-muted">{candidate.skills?.slice(0,3).join(" · ")}</p><RecruiterTagList tags={candidate.tags}/>{canEdit&&<button aria-label={`Edit tags for ${candidate.full_name}`} className="min-h-11 min-w-11 text-sm font-semibold text-indigo" onClick={()=>openEditor(candidate)}>+</button>}</div>},
          {key:"action",title:"Action",width:"19%",render:candidate=><div><Link className="inline-flex min-h-11 items-center text-sm font-semibold text-indigo" href={`/recruiter/candidates/${candidate.candidate_id}?from=talent-pool`}>View candidate</Link><details><summary className="min-h-11 cursor-pointer content-center text-sm text-ink" aria-label={`More actions for ${candidate.full_name}`}>⋯</summary><Link className="block min-h-11 content-center text-sm text-indigo" href={`/recruiter/candidates/${candidate.candidate_id}?compose=1`}>Send message</Link><Link className="block min-h-11 content-center text-sm text-indigo" href={`/recruiter/candidates/${candidate.candidate_id}?tab=activity`}>View activity & notes</Link></details><p className="mt-1 text-xs text-ink-muted">{smart?"Live criteria match":`Saved ${savedDate(candidate.saved_at)}${candidate.saved_by?` · ${candidate.saved_by}`:""}`}</p></div>},
        ]} mobileRow={candidate=><div className="grid gap-3"><div className="flex items-center gap-2"><SelectionCheckbox checked={selected.has(candidate.candidate_id)} onChange={()=>toggleCandidate(candidate.candidate_id)} label={`${selected.has(candidate.candidate_id)?"Deselect":"Select"} ${candidate.full_name}`}/><Link className="font-semibold text-navy" href={`/recruiter/candidates/${candidate.candidate_id}?from=talent-pool`}>{candidate.full_name}</Link></div><div><p className="text-sm text-ink-muted">{candidate.headline}</p>{candidate.current_company&&<p className="mt-1 text-xs text-ink-muted">{candidate.current_company}</p>}</div><p className="text-xs text-ink-muted">{experience(candidate.experience_months)} · {candidate.current_city || "Location not provided"} · {candidate.notice_period_days==null?"Notice not provided":candidate.notice_period_days===0?"Immediate":`${candidate.notice_period_days} days notice`}</p>{candidate.skills?.length&&<p className="text-xs text-ink-muted">{candidate.skills.slice(0,3).join(" · ")}</p>}<div className="flex flex-wrap items-center gap-2"><RecruiterTagList tags={candidate.tags}/>{canEdit&&<button type="button" aria-label={`Edit tags for ${candidate.full_name}`} onClick={()=>openEditor(candidate)} className="min-h-11 min-w-11 font-semibold text-indigo">+</button>}</div><div className="flex flex-wrap items-start gap-3"><Link className="min-h-11 content-center text-sm font-semibold text-indigo" href={`/recruiter/candidates/${candidate.candidate_id}?from=talent-pool`}>View candidate</Link><details><summary className="min-h-11 min-w-11 cursor-pointer list-none content-center text-center text-sm text-ink" aria-label={`More actions for ${candidate.full_name}`}>⋯</summary><Link className="block min-h-11 content-center text-sm text-indigo" href={`/recruiter/candidates/${candidate.candidate_id}?compose=1`}>Send message</Link><Link className="block min-h-11 content-center text-sm text-indigo" href={`/recruiter/candidates/${candidate.candidate_id}?tab=activity`}>View activity & notes</Link></details></div><p className="text-xs text-ink-muted">{smart?"Live criteria match":`Saved ${savedDate(candidate.saved_at)}`}{candidate.saved_by?` · ${candidate.saved_by}`:""}{candidate.last_active_at?` · Active ${savedDate(candidate.last_active_at)}`:""}</p></div>}/>

      </section>

      <AnimatePresence>
        {selectedCount > 0 && (
          <motion.div
            initial={{ opacity: 0, y: 28, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 22, scale: 0.98 }}
            transition={{ type: "spring", stiffness: 360, damping: 30, mass: 0.8 }}
            className="fixed inset-x-3 bottom-[calc(4.75rem+env(safe-area-inset-bottom))] z-50 mx-auto max-w-[46rem] sm:inset-x-6 lg:bottom-5"
            role="region"
            aria-label="Bulk candidate actions"
          >
            <div className="flex flex-col gap-3 rounded-2xl border border-[#bde3d7] bg-white/96 p-3 shadow-[0_22px_60px_rgba(16,33,63,0.20)] backdrop-blur-xl sm:flex-row sm:items-center sm:justify-between sm:p-3.5">
              <div className="flex min-w-0 items-center gap-3 px-1">
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[#e5f6f0] text-sm font-black text-[#18775e]">{selectedCount}</span>
                <div className="min-w-0">
                  <p className="truncate text-sm font-extrabold text-navy">
                    {selectedCount} candidate{selectedCount === 1 ? "" : "s"} selected
                  </p>
                  <p className="text-[11px] leading-4 text-ink-muted">Messaging uses existing consent and relationship rules.</p>
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <button type="button" onClick={()=>{setAddOpen(true);setError("")}} className={recruiterSecondary}>Add to pool</button>{canEdit&&<><button type="button" onClick={()=>openEditor("bulk")} className={recruiterSecondary}>Add tags</button><button type="button" onClick={()=>{setEditor("remove");setError("");}} className={recruiterSecondary}>{poolID?"Remove from pool":"Remove bookmarks"}</button></>}<Link href="/recruiter/outreach" className={recruiterSecondary}>Outreach campaigns</Link>
                <button type="button" onClick={clearSelection} className="min-h-10 flex-1 rounded-xl border border-line bg-white px-4 text-sm font-bold text-ink-muted transition hover:bg-slate-50 hover:text-navy sm:flex-none">
                  Clear
                </button>
                <button
                  type="button"
                  onClick={requestBulkComposer}
                  className="min-h-10 flex-[1.35] rounded-xl bg-[#24A47F] px-5 text-sm font-extrabold text-white shadow-[0_10px_24px_rgba(36,164,127,0.24)] transition hover:bg-[#1d8d6d] focus-visible:ring-2 focus-visible:ring-[#24A47F]/35 sm:flex-none"
                >
                  Message selected
                </button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <BulkInMailDrawer onSent={clearSelection} initialTemplates={messageTemplates} initialJobs={activeJobs} />
    </>
  );
}
