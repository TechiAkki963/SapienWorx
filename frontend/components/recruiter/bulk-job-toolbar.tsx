"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";

import { apiRequest } from "@/lib/api";
import { BulkJobActionResult, RecruiterTeamMember } from "@/lib/recruiter";

type BulkAction = "" | "pause" | "close" | "archive" | "reassign";

function selectedJobIDs() {
  return Array.from(new Set(
    Array.from(document.querySelectorAll<HTMLInputElement>('input[data-bulk-job-id]:checked'))
      .map((input) => input.dataset.bulkJobId!)
      .filter(Boolean),
  ));
}

function actionLabel(action: BulkAction) {
  return action === "reassign" ? "Reassign" : action ? action[0].toUpperCase() + action.slice(1) : "Choose action";
}

export function BulkJobToolbar({ team, pageJobCount }: { team: RecruiterTeamMember[]; pageJobCount: number }) {
  const router = useRouter();
  const [selected, setSelected] = useState<string[]>([]);
  const [action, setAction] = useState<BulkAction>("");
  const [assignee, setAssignee] = useState("");
  const [confirming, setConfirming] = useState(false);
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<BulkJobActionResult | null>(null);
  const [error, setError] = useState("");
  const reviewButtonRef = useRef<HTMLButtonElement>(null);
  const cancelButtonRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    const sync = () => setSelected(selectedJobIDs());
    const listener = (event: Event) => {
      if (event.target instanceof HTMLInputElement && event.target.matches("input[data-bulk-job-id]")) sync();
    };
    document.addEventListener("change", listener);
    sync();
    return () => document.removeEventListener("change", listener);
  }, []);

  useEffect(() => {
    if (!confirming) return;
    const previousFocus = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const frame = window.requestAnimationFrame(() => cancelButtonRef.current?.focus());
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      event.preventDefault();
      setConfirming(false);
    };
    document.addEventListener("keydown", onKeyDown);
    return () => {
      window.cancelAnimationFrame(frame);
      document.removeEventListener("keydown", onKeyDown);
      if (previousFocus && document.contains(previousFocus)) previousFocus.focus();
    };
  }, [confirming]);

  function selectPage(next: boolean) {
    document.querySelectorAll<HTMLInputElement>("input[data-bulk-job-id]").forEach((input) => {
      input.checked = next;
    });
    setSelected(next ? selectedJobIDs() : []);
    setResult(null);
    setError("");
  }

  function resetSelection() {
    selectPage(false);
    setAction("");
    setAssignee("");
    setConfirming(false);
  }

  async function submit() {
    if (!action || !selected.length || (action === "reassign" && !assignee)) return;
    setBusy(true);
    setError("");
    try {
      const payload = {
        job_ids: selected,
        action,
        ...(action === "reassign" ? { assigned_recruiter_id: assignee } : {}),
      };
      const response = await apiRequest<BulkJobActionResult>("/api/v1/recruiter/jobs/bulk", {
        method: "POST",
        body: JSON.stringify(payload),
      });
      resetSelection();
      setResult(response);
      router.refresh();
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "Bulk action could not be completed.");
      setConfirming(false);
    } finally {
      setBusy(false);
    }
  }

  const allSelected = pageJobCount > 0 && selected.length === pageJobCount;
  const assigneeName = team.find((member) => member.user_id === assignee)?.full_name;
  const confirmationText = action === "reassign"
    ? `Reassign ${selected.length} selected job${selected.length === 1 ? "" : "s"} to ${assigneeName ?? "the selected recruiter"}?`
    : `${actionLabel(action)} ${selected.length} selected job${selected.length === 1 ? "" : "s"}?`;

  if (!selected.length && !result && !error) return null;
  return (
    <section aria-label="Bulk job actions" className="rounded-2xl border border-line/70 bg-white p-3.5 shadow-[0_4px_20px_rgba(16,33,63,0.03)] sm:p-4">
      <div className="flex flex-wrap items-center gap-2.5">
        <button
          type="button"
          onClick={() => selectPage(!allSelected)}
          aria-pressed={allSelected}
          className="min-h-10 rounded-xl border border-line bg-white px-3 text-xs font-bold text-ink transition hover:border-indigo/30 hover:text-indigo"
        >
          {allSelected ? "Clear page" : "Select page"}
        </button>
        <p aria-live="polite" aria-atomic="true" className="min-w-0 flex-1 text-xs font-semibold text-ink-muted">
          {selected.length ? <><span className="font-extrabold text-navy">{selected.length}</span> selected on this page</> : "Select vacancies below to use governed bulk actions."}
        </p>

        {selected.length > 0 && (
          <div className="flex w-full flex-wrap items-end gap-2 sm:w-auto">
            <label className="grid min-w-[9rem] flex-1 gap-1 text-[13px] font-extrabold uppercase tracking-[0.08em] text-ink-muted sm:flex-none">
              Action
              <select
                aria-label="Bulk action"
                value={action}
                disabled={busy}
                onChange={(event) => { setAction(event.target.value as BulkAction); setConfirming(false); setResult(null); setError(""); }}
                className="min-h-10 rounded-xl border border-line bg-white px-3 text-sm font-semibold normal-case tracking-normal text-ink outline-none focus:border-indigo/40"
              >
                <option value="">Choose action</option>
                <option value="pause">Pause</option>
                <option value="close">Close</option>
                <option value="archive">Archive</option>
                <option value="reassign">Reassign recruiter</option>
              </select>
            </label>

            {action === "reassign" && (
              <label className="grid min-w-[12rem] flex-1 gap-1 text-[13px] font-extrabold uppercase tracking-[0.08em] text-ink-muted sm:flex-none">
                Recruiter
                <select
                  aria-label="Assign recruiter"
                  value={assignee}
                  disabled={busy}
                  onChange={(event) => { setAssignee(event.target.value); setConfirming(false); }}
                  className="min-h-10 rounded-xl border border-line bg-white px-3 text-sm font-semibold normal-case tracking-normal text-ink outline-none focus:border-indigo/40"
                >
                  <option value="">Choose recruiter</option>
                  {team.map((member) => <option key={member.user_id} value={member.user_id}>{member.full_name}{member.designation ? ` · ${member.designation}` : ""}</option>)}
                </select>
              </label>
            )}

            <button
              ref={reviewButtonRef}
              type="button"
              disabled={!action || busy || (action === "reassign" && !assignee)}
              onClick={() => setConfirming(true)}
              className="min-h-10 rounded-xl bg-indigo px-4 text-sm font-bold text-white transition hover:bg-navy disabled:cursor-not-allowed disabled:opacity-45"
            >
              Review action
            </button>
          </div>
        )}
      </div>

      {confirming && selected.length > 0 && (
        <div role="alertdialog" aria-label="Confirm bulk job action" aria-describedby="bulk-confirm-description" className="mt-3 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-amber-200 bg-amber-50 px-3.5 py-3">
          <div>
            <p id="bulk-confirm-title" className="text-sm font-bold text-amber-950">{confirmationText}</p>
            <p id="bulk-confirm-description" className="mt-0.5 text-xs text-amber-900/80">Each job is checked independently against its lifecycle and organization rules.</p>
          </div>
          <div className="flex gap-2">
            <button ref={cancelButtonRef} type="button" disabled={busy} onClick={() => setConfirming(false)} className="rounded-lg border border-amber-300 bg-white px-3 py-2 text-xs font-bold text-amber-950">Cancel</button>
            <button type="button" disabled={busy} onClick={submit} className="rounded-lg bg-amber-900 px-3 py-2 text-xs font-bold text-white disabled:opacity-50">{busy ? "Applying…" : `Confirm ${actionLabel(action)}`}</button>
          </div>
        </div>
      )}

      {result && (
        <div role="status" aria-live="polite" aria-atomic="true" className="mt-3 rounded-xl border border-line bg-slate-50/70 px-3.5 py-3 text-xs text-ink">
          <p className="font-extrabold text-navy">Bulk action {result.status}.</p>
          <p className="mt-1 text-ink-muted">{result.succeeded_count} changed · {result.unchanged_count} unchanged · {result.failed_count} failed</p>
          {result.failed_count > 0 && <p className="mt-1 font-semibold text-rose-700">Failed jobs remain unchanged and can be reviewed individually.</p>}
        </div>
      )}
      {error && <p role="alert" className="mt-3 rounded-xl border border-rose-200 bg-rose-50 px-3.5 py-3 text-xs font-semibold text-rose-800">{error}</p>}
    </section>
  );
}
