"use client";

import { createContext, useContext, useEffect, useRef, useState, useId, type ReactNode } from "react";
import { createPortal } from "react-dom";

export const recruiterInput = "min-h-11 w-full min-w-0 rounded-lg border border-line bg-white px-3 py-2 text-sm text-ink outline-none focus-visible:ring-2 focus-visible:ring-indigo";
export const recruiterPrimary = "inline-flex min-h-11 items-center justify-center gap-2 rounded-lg bg-indigo px-4 text-sm font-semibold text-white hover:bg-navy focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo focus-visible:ring-offset-2 disabled:opacity-50";
export const recruiterSecondary = "inline-flex min-h-11 items-center justify-center gap-2 rounded-lg border border-line bg-white px-3 text-sm font-semibold text-ink hover:border-indigo focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo disabled:opacity-50";

export function RecruiterToolbar({ children, label = "Workspace controls" }: { children: ReactNode; label?: string }) {
  return <div aria-label={label} className="flex min-w-0 flex-wrap items-end gap-3 border-b border-line pb-4">{children}</div>;
}

export function WorkspaceState({ title, description, action, error = false }: { title: string; description: string; action?: ReactNode; error?: boolean }) {
  return <div role={error ? "alert" : undefined} className="swx-workspace-surface rounded-xl border border-line px-5 py-8 text-center">
    <h2 className="text-base font-semibold text-navy">{title}</h2>
    <p className="mx-auto mt-2 max-w-lg text-sm leading-6 text-ink-muted">{description}</p>
    {action && <div className="mt-4 flex flex-wrap justify-center gap-2">{action}</div>}
  </div>;
}

export function WorkspaceSkeleton({ rows = 5 }: { rows?: number }) {
  return <div role="status" aria-label="Loading workspace" className="swx-workspace-surface rounded-xl border border-line p-4">
    <span className="sr-only">Loading results. Your criteria are retained.</span>
    {Array.from({ length: rows }, (_, i) => <div key={i} aria-hidden="true" className="flex gap-4 border-b border-line py-5 motion-safe:animate-pulse"><div className="h-9 w-9 rounded-full bg-slate-100" /><div className="h-4 w-1/3 rounded bg-slate-100" /><div className="ml-auto h-4 w-1/5 rounded bg-slate-100" /></div>)}
  </div>;
}

export type WorkspaceColumn<T> = { key: string; title: string; render: (row: T) => ReactNode; secondary?: boolean; width?: string };

export function RecruiterDataTable<T>({ rows, columns, rowKey, mobileRow, label }: {
  rows: T[]; columns: WorkspaceColumn<T>[]; rowKey: (row: T) => string; mobileRow: (row: T) => ReactNode; label: string;
}) {
  return <>
    <div className="swx-workspace-surface hidden rounded-xl border border-line md:block">
      <table aria-label={label} className="w-full table-fixed border-collapse text-left text-sm">
        <thead><tr className="swx-type-label border-b border-line bg-slate-50/60 text-ink">{columns.map(column => <th scope="col" key={column.key} className={`px-3 py-3 font-semibold ${column.secondary ? "hidden xl:table-cell" : ""}`} style={{ width: column.width }}>{column.title}</th>)}</tr></thead>
        <tbody>{rows.map(row => <tr key={rowKey(row)} className="border-b border-line/60 align-top last:border-b-0 hover:bg-slate-50/40">{columns.map(column => <td key={column.key} className={`break-words px-3 py-4 ${column.secondary ? "hidden xl:table-cell" : ""}`}>{column.render(row)}</td>)}</tr>)}</tbody>
      </table>
    </div>
    <div aria-label={`${label} mobile list`} className="grid gap-3 md:hidden">{rows.map(row => <article key={rowKey(row)} className="swx-workspace-surface min-w-0 rounded-xl border border-line p-4">{mobileRow(row)}</article>)}</div>
  </>;
}

/** Centered native dialog keeps the background inert and returns keyboard focus.
 * Dirty forms use an inline discard decision rather than opening a second modal. */
const ModalDismiss = createContext<()=>void>(()=>{});
let triggerSubscriptions=0;
let lastModalActivation:{element:WeakRef<HTMLElement>;at:number}|null=null;
function recordModalActivation(event:Event){
  if(event instanceof KeyboardEvent && event.key!=="Enter" && event.key!==" ")return;
  const target=event.target instanceof Element?event.target.closest<HTMLElement>('button,a[href],summary,input,select,textarea,[role="button"]'):null;
  if(target)lastModalActivation={element:new WeakRef(target),at:performance.now()};
}
function observeModalActivations(){
  // One shared listener set regardless of how many candidate cards contain dialogs.
  if(triggerSubscriptions++===0){document.addEventListener("pointerdown",recordModalActivation,true);document.addEventListener("click",recordModalActivation,true);document.addEventListener("keydown",recordModalActivation,true)}
  return()=>{if(--triggerSubscriptions===0){document.removeEventListener("pointerdown",recordModalActivation,true);document.removeEventListener("click",recordModalActivation,true);document.removeEventListener("keydown",recordModalActivation,true);lastModalActivation=null}};
}
export function RecruiterModalClose({children="Cancel",className=recruiterSecondary,disabled=false}:{children?:ReactNode;className?:string;disabled?:boolean}) {
  const dismiss=useContext(ModalDismiss);
  return <button type="button" disabled={disabled} className={className} onClick={dismiss}>{children}</button>;
}
export function RecruiterModal({ open, onClose, title, children, footer, wide = false, size, initialFocus, returnFocus, busy = false, protectChanges = true, resetKey }: {
  open:boolean;onClose:()=>void;title:string;children:ReactNode;footer?:ReactNode;wide?:boolean;
  size?:"small"|"medium"|"large"|"extra-large";initialFocus?:string;returnFocus?:string;busy?:boolean;protectChanges?:boolean;resetKey?:string|number;
}) {
  const dialog=useRef<HTMLDialogElement>(null),close=useRef(onClose),dirty=useRef(false);
  const [confirmDiscard,setConfirmDiscard]=useState(false);
  const [mounted,setMounted]=useState(false);
  const titleID=useId();
  close.current=onClose;
  function requestClose(){if(busy)return;if(protectChanges&&dirty.current){setConfirmDiscard(true);return}close.current()}
  useEffect(()=>{setMounted(true);return observeModalActivations()},[]);
  useEffect(()=>{dirty.current=false;setConfirmDiscard(false)},[resetKey]);
  useEffect(()=>{
    const node=dialog.current;if(!node||!open)return;
    // Safari does not focus every pointer-activated button. Remember activation
    // without forcing pointer users through an artificial focus transition.
    const activated=lastModalActivation&&performance.now()-lastModalActivation.at<1500?lastModalActivation.element.deref():null;
    const opener=activated?.isConnected?activated:document.activeElement instanceof HTMLElement&&document.activeElement!==document.body?document.activeElement:null;
    const previousOverflow=document.body.style.overflow;
    dirty.current=false;setConfirmDiscard(false);
    node.showModal();document.body.style.overflow="hidden";
    const target=node.querySelector<HTMLElement>(initialFocus||'[data-modal-initial-focus],input:not([type="hidden"]),textarea,select');
    (target??node.querySelector<HTMLElement>("[data-modal-close]"))?.focus();
    return()=>{node.close();document.body.style.overflow=previousOverflow;
      // A successful bulk action can remove its trigger by clearing selection.
      // Restore focus to a logical workspace control instead of losing it to body.
      const target=opener?.isConnected?opener:document.querySelector<HTMLElement>(returnFocus||"#main-content");
      target?.focus();
    };
  },[open,initialFocus,returnFocus,mounted]);
  if(!mounted)return null;
  return createPortal(<ModalDismiss.Provider value={requestClose}><dialog ref={dialog} aria-labelledby={titleID} aria-modal="true" aria-busy={busy||undefined} onInput={()=>{dirty.current=true}} onChange={()=>{dirty.current=true}} onKeyDown={event=>{
    if(event.key!=="Tab"||(event.target as HTMLElement).closest("dialog")!==event.currentTarget)return;
    const controls=Array.from(event.currentTarget.querySelectorAll<HTMLElement>('a[href],button:not([disabled]),input:not([disabled]):not([type="hidden"]),select:not([disabled]),textarea:not([disabled]),summary,[tabindex="0"]')).filter(node=>node.tabIndex>=0&&node.getClientRects().length>0&&getComputedStyle(node).visibility!=="hidden"&&!node.closest("[inert]")&&node.closest("dialog")===event.currentTarget);
    const first=controls[0],last=controls.at(-1);
    if(!first||!last){event.preventDefault();event.currentTarget.focus();return}
    if(event.shiftKey&&document.activeElement===first){event.preventDefault();last.focus()}
    else if(!event.shiftKey&&document.activeElement===last){event.preventDefault();first.focus()}
  }} onCancel={event=>{event.preventDefault();event.stopPropagation();requestClose()}} onClick={event=>{if(event.target===event.currentTarget)requestClose()}} className={`theme-surface swx-recruiter-workspace swx-workspace-modal swx-workspace-modal-${size??(wide?"large":"medium")}`}>
    {open&&<div className="flex h-full min-h-0 flex-col">
      <header className="flex shrink-0 items-center justify-between gap-3 border-b border-line px-5 py-4"><h2 id={titleID} className="min-w-0 break-words text-lg font-semibold text-navy">{title}</h2><button data-modal-close type="button" disabled={busy} onClick={requestClose} aria-label={`Close ${title}`} className={`${recruiterSecondary} h-11 w-11 shrink-0 px-0`}>×</button></header>
      <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-5 py-5">{children}</div>
      {confirmDiscard?<footer role="alert" className="shrink-0 border-t border-line px-5 py-4"><p className="mb-3 text-sm font-semibold text-ink">Discard your unsaved changes?</p><div className="flex flex-wrap justify-end gap-2"><button type="button" className={recruiterSecondary} onClick={()=>setConfirmDiscard(false)}>Keep editing</button><button type="button" className={recruiterPrimary} onClick={()=>{dirty.current=false;setConfirmDiscard(false);close.current()}}>Discard changes</button></div></footer>:footer&&<footer className="flex shrink-0 flex-wrap justify-end gap-2 border-t border-line px-5 py-4">{footer}</footer>}
    </div>}
  </dialog></ModalDismiss.Provider>,document.body);
}
