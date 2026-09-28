"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import { useAdminPermission } from "@/components/admin/admin-access-provider";
import { apiRequest } from "@/lib/api";

type Approval = {
  id: string;
  status: string;
  requested_by: string;
  action_type: string;
  target_type: string;
  approval_reference: string;
  approvals: number;
  required_approvals: number;
};

function Message({ value }: { value: string }) {
  if (!value) return null;
  return <p role="status" className="text-xs leading-5 text-slate-600">{value}</p>;
}

export function ApprovalRequestForm() {
  const allowed = useAdminPermission("control_plane.manage");
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState("");
  if (!allowed) return null;

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const data = new FormData(form);
    setPending(true);
    setMessage("");
    try {
      await apiRequest("/api/v1/admin/control-plane/approvals", {
        method: "POST",
        body: JSON.stringify({
          action_type: String(data.get("action_type") ?? "").trim(),
          target_type: String(data.get("target_type") ?? "").trim(),
          target_id: String(data.get("target_id") ?? "").trim(),
          reason: String(data.get("reason") ?? "").trim(),
          approval_reference: String(data.get("approval_reference") ?? "").trim(),
          required_approvals: Number(data.get("required_approvals") ?? 2),
        }),
      });
      form.reset();
      setMessage("Approval request created.");
      router.refresh();
    } catch (cause) {
      setMessage(cause instanceof Error ? cause.message : "Could not create approval request.");
    } finally {
      setPending(false);
    }
  }

  return <form onSubmit={submit} className="grid gap-3 rounded-2xl border border-indigo-100 bg-indigo-50/40 p-4">
    <div><p className="text-sm font-bold text-slate-900">Request a governed action</p><p className="mt-1 text-xs leading-5 text-slate-500">Use a durable change/ticket reference. Requesters cannot approve their own request.</p></div>
    <div className="grid gap-3 md:grid-cols-2">
      <label className="grid gap-1 text-xs font-bold text-slate-600">Action type<input required name="action_type" placeholder="operational_setting.update" className="h-10 rounded-xl border border-slate-200 bg-white px-3 text-sm font-normal"/></label>
      <label className="grid gap-1 text-xs font-bold text-slate-600">Target type<input required name="target_type" placeholder="operational_setting" className="h-10 rounded-xl border border-slate-200 bg-white px-3 text-sm font-normal"/></label>
      <label className="grid gap-1 text-xs font-bold text-slate-600">Target UUID (optional)<input name="target_id" placeholder="UUID when applicable" className="h-10 rounded-xl border border-slate-200 bg-white px-3 text-sm font-normal"/></label>
      <label className="grid gap-1 text-xs font-bold text-slate-600">Approval reference<input required minLength={5} name="approval_reference" placeholder="CHG-2026-001" className="h-10 rounded-xl border border-slate-200 bg-white px-3 text-sm font-normal"/></label>
      <label className="grid gap-1 text-xs font-bold text-slate-600">Required approvals<select name="required_approvals" defaultValue="2" className="h-10 rounded-xl border border-slate-200 bg-white px-3 text-sm font-normal"><option value="2">2</option><option value="3">3</option><option value="4">4</option><option value="5">5</option></select></label>
    </div>
    <label className="grid gap-1 text-xs font-bold text-slate-600">Reason<textarea required minLength={10} maxLength={2000} name="reason" rows={3} className="rounded-xl border border-slate-200 bg-white p-3 text-sm font-normal"/></label>
    <div className="flex items-center gap-3"><button disabled={pending} className="rounded-xl bg-[#4656cf] px-4 py-2.5 text-xs font-bold text-white disabled:opacity-50">{pending ? "Creating…" : "Create approval request"}</button><Message value={message}/></div>
  </form>;
}

export function ApprovalDecisionActions({ approval }: { approval: Approval }) {
  const allowed = useAdminPermission("control_plane.manage");
  const router = useRouter();
  const [busy, setBusy] = useState("");
  const [message, setMessage] = useState("");
  if (!allowed || approval.status !== "pending") return null;

  async function decide(decision: "approve" | "reject") {
    const note = window.prompt(decision === "approve" ? "Approval note (optional)" : "Rejection note");
    if (note === null) return;
    setBusy(decision);
    setMessage("");
    try {
      await apiRequest("/api/v1/admin/control-plane/approvals/" + approval.id + "/decisions", {
        method: "POST",
        body: JSON.stringify({ decision, note: note.trim() }),
      });
      router.refresh();
    } catch (cause) {
      setMessage(cause instanceof Error ? cause.message : "Decision could not be recorded.");
    } finally {
      setBusy("");
    }
  }

  return <div className="mt-3 flex flex-wrap items-center gap-2">
    <button type="button" disabled={!!busy} onClick={() => void decide("approve")} className="rounded-lg bg-emerald-600 px-3 py-2 text-xs font-bold text-white disabled:opacity-50">{busy === "approve" ? "Approving…" : "Approve"}</button>
    <button type="button" disabled={!!busy} onClick={() => void decide("reject")} className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs font-bold text-red-700 disabled:opacity-50">{busy === "reject" ? "Rejecting…" : "Reject"}</button>
    <Message value={message}/>
  </div>;
}

export function CaseCreateForm() {
  const allowed = useAdminPermission("control_plane.manage");
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState("");
  if (!allowed) return null;

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const data = new FormData(form);
    setPending(true);
    setMessage("");
    try {
      await apiRequest("/api/v1/admin/control-plane/cases", {
        method: "POST",
        body: JSON.stringify({
          case_type: data.get("case_type"),
          subject_type: data.get("subject_type"),
          subject_id: String(data.get("subject_id") ?? "").trim(),
          title: String(data.get("title") ?? "").trim(),
          priority: data.get("priority"),
          summary: String(data.get("summary") ?? "").trim(),
        }),
      });
      form.reset();
      setMessage("Case opened.");
      router.refresh();
    } catch (cause) {
      setMessage(cause instanceof Error ? cause.message : "Could not open case.");
    } finally {
      setPending(false);
    }
  }

  return <form onSubmit={submit} className="grid gap-3 rounded-2xl border border-slate-200 bg-slate-50/70 p-4">
    <p className="text-sm font-bold text-slate-900">Open investigation case</p>
    <div className="grid gap-3 md:grid-cols-2">
      <label className="grid gap-1 text-xs font-bold text-slate-600">Case type<select name="case_type" className="h-10 rounded-xl border border-slate-200 bg-white px-3 text-sm font-normal"><option>moderation</option><option>privacy</option><option>security</option><option>organization</option><option>operations</option></select></label>
      <label className="grid gap-1 text-xs font-bold text-slate-600">Subject type<select name="subject_type" className="h-10 rounded-xl border border-slate-200 bg-white px-3 text-sm font-normal"><option>user</option><option>job</option><option>message</option><option>privacy_request</option><option>organization</option><option>incident</option><option>system</option><option>release</option></select></label>
      <label className="grid gap-1 text-xs font-bold text-slate-600">Subject UUID (optional)<input name="subject_id" className="h-10 rounded-xl border border-slate-200 bg-white px-3 text-sm font-normal"/></label>
      <label className="grid gap-1 text-xs font-bold text-slate-600">Priority<select name="priority" defaultValue="normal" className="h-10 rounded-xl border border-slate-200 bg-white px-3 text-sm font-normal"><option>low</option><option>normal</option><option>high</option><option>critical</option></select></label>
    </div>
    <label className="grid gap-1 text-xs font-bold text-slate-600">Title<input required minLength={5} maxLength={240} name="title" className="h-10 rounded-xl border border-slate-200 bg-white px-3 text-sm font-normal"/></label>
    <label className="grid gap-1 text-xs font-bold text-slate-600">Summary<textarea name="summary" maxLength={4000} rows={3} className="rounded-xl border border-slate-200 bg-white p-3 text-sm font-normal"/></label>
    <div className="flex items-center gap-3"><button disabled={pending} className="rounded-xl bg-slate-900 px-4 py-2.5 text-xs font-bold text-white disabled:opacity-50">{pending ? "Opening…" : "Open case"}</button><Message value={message}/></div>
  </form>;
}


export function OrganizationGovernanceForm({ companyID }: { companyID: string }) {
  const allowed = useAdminPermission("control_plane.manage");
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState("");
  if (!allowed) return null;

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const data = new FormData(form);
    setPending(true);
    setMessage("");
    try {
      await apiRequest("/api/v1/admin/control-plane/organization-reviews", {
        method: "POST",
        body: JSON.stringify({
          company_id: companyID,
          review_type: data.get("review_type"),
          assigned_to: String(data.get("assigned_to") ?? "").trim(),
          source_user_id: String(data.get("source_user_id") ?? "").trim(),
          target_user_id: String(data.get("target_user_id") ?? "").trim(),
          duplicate_company_id: String(data.get("duplicate_company_id") ?? "").trim(),
          reason: String(data.get("reason") ?? "").trim(),
          approval_reference: String(data.get("approval_reference") ?? "").trim(),
        }),
      });
      form.reset();
      setMessage("Governance review opened with dual approval.");
      router.refresh();
    } catch (cause) {
      setMessage(cause instanceof Error ? cause.message : "Could not create governance review.");
    } finally {
      setPending(false);
    }
  }

  if (!open) return <button type="button" onClick={() => setOpen(true)} className="rounded-lg border border-indigo-200 bg-indigo-50 px-3 py-2 text-xs font-bold text-indigo-700">Govern organization</button>;

  return <form onSubmit={submit} className="mt-3 grid gap-3 rounded-xl border border-indigo-100 bg-indigo-50/40 p-3">
    <div className="flex items-center justify-between gap-2"><p className="text-xs font-bold text-slate-800">Governed organization action</p><button type="button" onClick={() => setOpen(false)} className="text-xs font-bold text-slate-500">Close</button></div>
    <label className="grid gap-1 text-xs font-bold text-slate-600">Review type<select name="review_type" className="h-9 rounded-lg border border-slate-200 bg-white px-2 text-xs font-normal"><option value="restriction">Restriction</option><option value="invitation">Invitation review</option><option value="reassignment">Recruiter reassignment</option><option value="merge_review">Duplicate / merge review</option></select></label>
    <div className="grid gap-2 sm:grid-cols-2">
      <label className="grid gap-1 text-[11px] font-bold text-slate-600">Assigned admin UUID<input name="assigned_to" className="h-9 rounded-lg border border-slate-200 bg-white px-2 text-xs font-normal"/></label>
      <label className="grid gap-1 text-[11px] font-bold text-slate-600">Source recruiter UUID<input name="source_user_id" className="h-9 rounded-lg border border-slate-200 bg-white px-2 text-xs font-normal"/></label>
      <label className="grid gap-1 text-[11px] font-bold text-slate-600">Target recruiter UUID<input name="target_user_id" className="h-9 rounded-lg border border-slate-200 bg-white px-2 text-xs font-normal"/></label>
      <label className="grid gap-1 text-[11px] font-bold text-slate-600">Duplicate company UUID<input name="duplicate_company_id" className="h-9 rounded-lg border border-slate-200 bg-white px-2 text-xs font-normal"/></label>
    </div>
    <label className="grid gap-1 text-xs font-bold text-slate-600">Approval reference<input required minLength={5} name="approval_reference" placeholder="ORG-CHG-001" className="h-9 rounded-lg border border-slate-200 bg-white px-2 text-xs font-normal"/></label>
    <label className="grid gap-1 text-xs font-bold text-slate-600">Reason<textarea required minLength={10} maxLength={2000} name="reason" rows={2} className="rounded-lg border border-slate-200 bg-white p-2 text-xs font-normal"/></label>
    <div className="flex flex-wrap items-center gap-2"><button disabled={pending} className="rounded-lg bg-indigo-600 px-3 py-2 text-xs font-bold text-white disabled:opacity-50">{pending ? "Creating…" : "Create governed review"}</button><Message value={message}/></div>
  </form>;
}


export function CaseManagementForm({ caseID }: { caseID: string }) {
  const allowed = useAdminPermission("control_plane.manage");
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState("");
  if (!allowed) return null;

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const data = new FormData(form);
    setPending(true);
    setMessage("");
    try {
      await apiRequest("/api/v1/admin/control-plane/cases/" + caseID, {
        method: "PATCH",
        body: JSON.stringify({
          assigned_to: String(data.get("assigned_to") ?? "").trim(),
          status: String(data.get("status") ?? "").trim(),
          event_type: String(data.get("event_type") ?? "note"),
          note: String(data.get("note") ?? "").trim(),
        }),
      });
      form.reset();
      setMessage("Case updated.");
      router.refresh();
    } catch (cause) {
      setMessage(cause instanceof Error ? cause.message : "Could not update case.");
    } finally {
      setPending(false);
    }
  }

  return <form onSubmit={submit} className="grid gap-3 rounded-2xl border border-slate-200 bg-white p-4">
    <p className="text-sm font-bold text-slate-900">Update investigation</p>
    <div className="grid gap-3 sm:grid-cols-2">
      <label className="grid gap-1 text-xs font-bold text-slate-600">Assign reviewer UUID<input name="assigned_to" className="h-10 rounded-xl border border-slate-200 px-3 text-sm font-normal"/></label>
      <label className="grid gap-1 text-xs font-bold text-slate-600">Status<select name="status" defaultValue="" className="h-10 rounded-xl border border-slate-200 px-3 text-sm font-normal"><option value="">Keep current</option><option>open</option><option>investigating</option><option>awaiting_review</option><option>resolved</option><option>closed</option></select></label>
      <label className="grid gap-1 text-xs font-bold text-slate-600">Event<select name="event_type" defaultValue="note" className="h-10 rounded-xl border border-slate-200 px-3 text-sm font-normal"><option>note</option><option>assigned</option><option>status_changed</option><option>reviewed</option><option>escalated</option><option>hold_added</option><option>hold_released</option></select></label>
    </div>
    <label className="grid gap-1 text-xs font-bold text-slate-600">Investigation note<textarea name="note" maxLength={4000} rows={3} className="rounded-xl border border-slate-200 p-3 text-sm font-normal"/></label>
    <div className="flex items-center gap-3"><button disabled={pending} className="rounded-xl bg-slate-900 px-4 py-2.5 text-xs font-bold text-white disabled:opacity-50">{pending ? "Saving…" : "Save case update"}</button><Message value={message}/></div>
  </form>;
}


export function OperationEvidenceForm() {
  const allowed = useAdminPermission("system.configure");
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState("");
  if (!allowed) return null;

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const data = new FormData(form);
    setPending(true);
    setMessage("");
    try {
      await apiRequest("/api/v1/admin/control-plane/operation-evidence", {
        method: "POST",
        body: JSON.stringify({
          evidence_type: data.get("evidence_type"),
          environment: String(data.get("environment") ?? "").trim(),
          component: String(data.get("component") ?? "").trim(),
          status: data.get("status"),
          owner: String(data.get("owner") ?? "").trim(),
          reference: String(data.get("reference") ?? "").trim(),
          details: {},
        }),
      });
      form.reset();
      setMessage("Operational evidence recorded.");
      router.refresh();
    } catch (cause) {
      setMessage(cause instanceof Error ? cause.message : "Could not record evidence.");
    } finally {
      setPending(false);
    }
  }

  return <form onSubmit={submit} className="mt-4 grid gap-3 rounded-xl border border-slate-200 bg-slate-50 p-3">
    <p className="text-xs font-bold text-slate-800">Record verified operational evidence</p>
    <div className="grid gap-2 sm:grid-cols-2">
      <label className="grid gap-1 text-[11px] font-bold text-slate-600">Evidence type<select name="evidence_type" className="h-9 rounded-lg border border-slate-200 bg-white px-2 text-xs font-normal"><option>service_health</option><option>database_health</option><option>alert</option><option>release</option><option>migration</option><option>backup</option><option>restore_test</option></select></label>
      <label className="grid gap-1 text-[11px] font-bold text-slate-600">Status<select name="status" className="h-9 rounded-lg border border-slate-200 bg-white px-2 text-xs font-normal"><option>passed</option><option>healthy</option><option>warning</option><option>critical</option><option>failed</option><option>pending</option><option>unconnected</option><option>unknown</option></select></label>
      <label className="grid gap-1 text-[11px] font-bold text-slate-600">Environment<input required name="environment" defaultValue="production" className="h-9 rounded-lg border border-slate-200 bg-white px-2 text-xs font-normal"/></label>
      <label className="grid gap-1 text-[11px] font-bold text-slate-600">Component<input required name="component" placeholder="postgres / backup job / api" className="h-9 rounded-lg border border-slate-200 bg-white px-2 text-xs font-normal"/></label>
      <label className="grid gap-1 text-[11px] font-bold text-slate-600">Owner<input name="owner" className="h-9 rounded-lg border border-slate-200 bg-white px-2 text-xs font-normal"/></label>
      <label className="grid gap-1 text-[11px] font-bold text-slate-600">Evidence reference<input name="reference" placeholder="run ID / ticket / object reference" className="h-9 rounded-lg border border-slate-200 bg-white px-2 text-xs font-normal"/></label>
    </div>
    <div className="flex items-center gap-2"><button disabled={pending} className="rounded-lg bg-slate-900 px-3 py-2 text-xs font-bold text-white disabled:opacity-50">{pending ? "Recording…" : "Record evidence"}</button><Message value={message}/></div>
  </form>;
}

export function ReleaseCreateForm() {
  const allowed = useAdminPermission("release.manage");
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState("");
  if (!allowed) return null;

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const data = new FormData(form);
    setPending(true);
    setMessage("");
    try {
      await apiRequest("/api/v1/admin/control-plane/releases", {
        method: "POST",
        body: JSON.stringify({
          release_reference: String(data.get("release_reference") ?? "").trim(),
          environment: String(data.get("environment") ?? "").trim(),
          commit_sha: String(data.get("commit_sha") ?? "").trim(),
          migration_reference: String(data.get("migration_reference") ?? "").trim(),
          approval_reference: String(data.get("approval_reference") ?? "").trim(),
          notes: String(data.get("notes") ?? "").trim(),
        }),
      });
      form.reset();
      setMessage("Release checkpoint created with dual-approval request.");
      router.refresh();
    } catch (cause) {
      setMessage(cause instanceof Error ? cause.message : "Could not create release checkpoint.");
    } finally {
      setPending(false);
    }
  }

  return <form onSubmit={submit} className="mt-4 grid gap-3 rounded-xl border border-indigo-100 bg-indigo-50/40 p-3">
    <p className="text-xs font-bold text-slate-800">Create release acceptance checkpoint</p>
    <div className="grid gap-2 sm:grid-cols-2">
      <label className="grid gap-1 text-[11px] font-bold text-slate-600">Release reference<input required minLength={5} name="release_reference" placeholder="SWX-2026.09.28" className="h-9 rounded-lg border border-slate-200 bg-white px-2 text-xs font-normal"/></label>
      <label className="grid gap-1 text-[11px] font-bold text-slate-600">Environment<input required name="environment" defaultValue="production" className="h-9 rounded-lg border border-slate-200 bg-white px-2 text-xs font-normal"/></label>
      <label className="grid gap-1 text-[11px] font-bold text-slate-600">Commit SHA<input required minLength={7} name="commit_sha" className="h-9 rounded-lg border border-slate-200 bg-white px-2 font-mono text-xs font-normal"/></label>
      <label className="grid gap-1 text-[11px] font-bold text-slate-600">Migration reference<input name="migration_reference" placeholder="000034…" className="h-9 rounded-lg border border-slate-200 bg-white px-2 text-xs font-normal"/></label>
      <label className="grid gap-1 text-[11px] font-bold text-slate-600">Approval reference<input required minLength={5} name="approval_reference" placeholder="REL-CHG-001" className="h-9 rounded-lg border border-slate-200 bg-white px-2 text-xs font-normal"/></label>
    </div>
    <label className="grid gap-1 text-[11px] font-bold text-slate-600">Notes<textarea name="notes" maxLength={4000} rows={2} className="rounded-lg border border-slate-200 bg-white p-2 text-xs font-normal"/></label>
    <div className="flex items-center gap-2"><button disabled={pending} className="rounded-lg bg-indigo-600 px-3 py-2 text-xs font-bold text-white disabled:opacity-50">{pending ? "Creating…" : "Create release checkpoint"}</button><Message value={message}/></div>
  </form>;
}

export function ReleaseTransitionForm({ releaseID, status }: { releaseID: string; status: string }) {
  const allowed = useAdminPermission("release.manage");
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState("");
  if (!allowed) return null;

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const data = new FormData(form);
    setPending(true);
    setMessage("");
    try {
      await apiRequest("/api/v1/admin/control-plane/releases/" + releaseID, {
        method: "PATCH",
        body: JSON.stringify({
          status: data.get("status"),
          backup_evidence_id: String(data.get("backup_evidence_id") ?? "").trim(),
          restore_test_evidence_id: String(data.get("restore_test_evidence_id") ?? "").trim(),
          note: String(data.get("note") ?? "").trim(),
        }),
      });
      setMessage("Release state updated.");
      router.refresh();
    } catch (cause) {
      setMessage(cause instanceof Error ? cause.message : "Release state could not be updated.");
    } finally {
      setPending(false);
    }
  }

  return <form onSubmit={submit} className="mt-3 grid gap-2 border-t border-slate-100 pt-3">
    <div className="grid gap-2 sm:grid-cols-2">
      <label className="grid gap-1 text-[11px] font-bold text-slate-600">Next state<select name="status" defaultValue={status === "reviewing" ? "approved_for_rollout" : status === "approved_for_rollout" ? "deployed" : "accepted"} className="h-9 rounded-lg border border-slate-200 px-2 text-xs font-normal"><option>approved_for_rollout</option><option>deployed</option><option>accepted</option><option>rejected</option><option>rolled_back</option></select></label>
      <label className="grid gap-1 text-[11px] font-bold text-slate-600">Backup evidence UUID<input name="backup_evidence_id" className="h-9 rounded-lg border border-slate-200 px-2 font-mono text-xs font-normal"/></label>
      <label className="grid gap-1 text-[11px] font-bold text-slate-600">Restore-test evidence UUID<input name="restore_test_evidence_id" className="h-9 rounded-lg border border-slate-200 px-2 font-mono text-xs font-normal"/></label>
      <label className="grid gap-1 text-[11px] font-bold text-slate-600">Note<input name="note" className="h-9 rounded-lg border border-slate-200 px-2 text-xs font-normal"/></label>
    </div>
    <div className="flex items-center gap-2"><button disabled={pending} className="rounded-lg bg-slate-900 px-3 py-2 text-xs font-bold text-white disabled:opacity-50">{pending ? "Updating…" : "Apply reviewed state"}</button><Message value={message}/></div>
  </form>;
}
