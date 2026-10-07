"use client";

import { useEffect, useRef, type ReactNode } from "react";

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
        <thead><tr className="border-b border-line bg-slate-50/60 text-xs text-ink-muted">{columns.map(column => <th scope="col" key={column.key} className={`px-3 py-3 font-semibold ${column.secondary ? "hidden xl:table-cell" : ""}`} style={{ width: column.width }}>{column.title}</th>)}</tr></thead>
        <tbody>{rows.map(row => <tr key={rowKey(row)} className="border-b border-line/60 align-top last:border-b-0 hover:bg-slate-50/40">{columns.map(column => <td key={column.key} className={`break-words px-3 py-4 ${column.secondary ? "hidden xl:table-cell" : ""}`}>{column.render(row)}</td>)}</tr>)}</tbody>
      </table>
    </div>
    <div aria-label={`${label} mobile list`} className="grid gap-3 md:hidden">{rows.map(row => <article key={rowKey(row)} className="swx-workspace-surface min-w-0 rounded-xl border border-line p-4">{mobileRow(row)}</article>)}</div>
  </>;
}

/** Native modal dialog supplies background inertness, focus containment and Escape.
 * Explicit focus return also covers programmatic closing and route changes. */
export function RecruiterDrawer({ open, onClose, title, children, footer, wide = false, initialFocus, side = "right" }: {
  open: boolean; onClose: () => void; title: string; children: ReactNode; footer?: ReactNode; wide?: boolean; initialFocus?: string; side?: "left" | "right";
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  const close = useRef(onClose);
  close.current = onClose;
  useEffect(() => {
    const node = dialog.current;
    if (!node || !open) return;
    const opener = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const previousOverflow = document.body.style.overflow;
    node.showModal();
    if (initialFocus) node.querySelector<HTMLElement>(initialFocus)?.focus();
    document.body.style.overflow = "hidden";
    return () => { node.close(); document.body.style.overflow = previousOverflow; opener?.focus(); };
  }, [open, initialFocus]);
  return <dialog ref={dialog} aria-label={title} onKeyDown={event => {
    if (event.key !== "Tab") return;
    const controls = Array.from(event.currentTarget.querySelectorAll<HTMLElement>('a[href],button:not([disabled]),input:not([disabled]),select:not([disabled]),textarea:not([disabled]),summary,[tabindex="0"]')).filter(node => node.getClientRects().length > 0 && !node.closest("[inert]"));
    const first = controls[0], last = controls[controls.length - 1];
    if (!first) { event.preventDefault(); return; }
    if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
    else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
  }} onCancel={event => { event.preventDefault(); close.current(); }} onClick={event => { if (event.target === event.currentTarget) close.current(); }} className={`swx-workspace-drawer ${wide ? "swx-workspace-drawer-wide" : ""} ${side === "left" ? "swx-workspace-drawer-left" : ""}`}>
    <div className="flex h-full min-h-0 flex-col">
      <header className="flex shrink-0 items-center justify-between gap-3 border-b border-line px-5 py-4"><h2 className="text-lg font-semibold text-navy">{title}</h2><button autoFocus type="button" onClick={onClose} aria-label={`Close ${title}`} className={`${recruiterSecondary} h-11 w-11 px-0`}>×</button></header>
      <div className="min-h-0 flex-1 overflow-y-auto px-5 py-5">{children}</div>
      {footer && <footer className="flex shrink-0 flex-wrap justify-end gap-2 border-t border-line px-5 py-4">{footer}</footer>}
    </div>
  </dialog>;
}
