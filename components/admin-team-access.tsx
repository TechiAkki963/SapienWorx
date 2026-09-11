"use client";

import { useEffect, useMemo, useState } from "react";
import { apiClient } from "../lib/api-client";

type Role = "OWNER" | "OPERATIONS" | "SUPPORT" | "COMPLIANCE" | "FINANCE" | "READ_ONLY";
type Member = { id: string; displayName: string; email: string; role: Role; active: boolean; permissions: string[]; lastSignedInAt: string | null };
type TeamResponse = { members: Member[]; permissionCatalogue: string[]; currentPermissions: string[] };
const roles: Role[] = ["READ_ONLY", "OPERATIONS", "SUPPORT", "COMPLIANCE", "FINANCE", "OWNER"];
const label = (value: string) => value.replaceAll(".", " · ").replaceAll("_", " ");

export function AdminTeamAccess() {
  const [data, setData] = useState<TeamResponse | null>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [selected, setSelected] = useState<string[]>([]);
  const [bulkRole, setBulkRole] = useState<Role>("READ_ONLY");
  const [filter, setFilter] = useState("");
  const [form, setForm] = useState<{ displayName: string; email: string; role: Role; permissions: string[] }>({ displayName: "", email: "", role: "READ_ONLY", permissions: ["platform.read"] });
  const canManage = useMemo(() => Boolean(data?.currentPermissions.includes("*") || data?.currentPermissions.includes("team.manage")), [data]);
  const load = async () => { try { setError(""); setData(await apiClient<TeamResponse>("/api/admin/team")); } catch (reason) { setError(reason instanceof Error ? reason.message : "Team access could not be loaded."); } };
  useEffect(() => { void load(); }, []);
  const visible = useMemo(() => (data?.members ?? []).filter((member) => !filter.trim() || `${member.displayName} ${member.email} ${member.role} ${member.permissions.join(" ")}`.toLowerCase().includes(filter.trim().toLowerCase())), [data, filter]);
  const allVisibleSelected = visible.length > 0 && visible.every((member) => selected.includes(member.id));
  const toggle = (permission: string) => setForm((current) => ({ ...current, permissions: current.permissions.includes(permission) ? current.permissions.filter((item) => item !== permission) : [...current.permissions, permission] }));
  const invite = async () => { setBusy(true); setError(""); try { await apiClient("/api/admin/team", { method: "POST", body: JSON.stringify(form) }); setForm({ displayName: "", email: "", role: "READ_ONLY", permissions: ["platform.read"] }); await load(); } catch (reason) { setError(reason instanceof Error ? reason.message : "The team member could not be added."); } finally { setBusy(false); } };
  const update = async (member: Member, patch: Partial<Pick<Member, "role" | "active">>) => { setBusy(true); setError(""); try { await apiClient(`/api/admin/team/${member.id}`, { method: "PATCH", body: JSON.stringify(patch) }); await load(); } catch (reason) { setError(reason instanceof Error ? reason.message : "Access could not be updated."); } finally { setBusy(false); } };
  const bulkUpdate = async (patch: Partial<Pick<Member, "role" | "active">>) => {
    if (!data || !selected.length || busy) return;
    const targets = data.members.filter((member) => selected.includes(member.id));
    if (!window.confirm(`Apply this access change to ${targets.length} selected account${targets.length === 1 ? "" : "s"}? Each change will be persisted and audited.`)) return;
    setBusy(true); setError("");
    try {
      for (const member of targets) await apiClient(`/api/admin/team/${member.id}`, { method: "PATCH", body: JSON.stringify(patch) });
      setSelected([]); await load();
    } catch (reason) { setError(reason instanceof Error ? reason.message : "The bulk access update could not be completed."); }
    finally { setBusy(false); }
  };

  return <main className="admin-team-page">
    <header className="admin-team-header"><a href="/admin">← Master Access</a><span className="eyebrow">Team &amp; access</span><h1>Dense access governance</h1><p>Filter, compare and control sub-admin access from one audit-backed directory.</p></header>
    {error && <div className="async-error" role="alert"><strong>Couldn’t complete that action</strong><p>{error}</p><button onClick={() => void load()}>Retry</button></div>}
    {!data && !error ? <div className="async-loading" role="status">Loading team access…</div> : data && <>
      <section className="admin-team-card">
        <div className="section-heading"><div><span className="eyebrow">Master directory</span><h2>{visible.length} of {data.members.length} accounts</h2></div>{!canManage && <span className="status-pill">Read only</span>}</div>
        <div className="admin-list-tools"><label><span>Search accounts</span><input value={filter} onChange={(event) => setFilter(event.target.value)} placeholder="Name, email, role or permission" /></label></div>
        {canManage && selected.length > 0 && <div className="admin-bulk-governance" role="region" aria-label="Bulk governance controls"><strong>{selected.length} selected</strong><label><span>Set role</span><select value={bulkRole} onChange={(event) => setBulkRole(event.target.value as Role)}>{roles.map((role) => <option key={role}>{role}</option>)}</select></label><button disabled={busy} onClick={() => void bulkUpdate({ role: bulkRole })}>Apply role</button><button disabled={busy} onClick={() => void bulkUpdate({ active: true })}>Enable</button><button disabled={busy} onClick={() => void bulkUpdate({ active: false })}>Disable</button><button onClick={() => setSelected([])}>Clear</button></div>}
        <div className="admin-table-scroll"><table className="admin-dense-table"><thead><tr><th><input aria-label="Select all visible accounts" type="checkbox" checked={allVisibleSelected} onChange={(event) => setSelected(event.target.checked ? Array.from(new Set([...selected, ...visible.map((member) => member.id)])) : selected.filter((id) => !visible.some((member) => member.id === id)))} /></th><th>Member</th><th>Role</th><th>Permissions</th><th>Last sign-in</th><th>Status</th><th>Action</th></tr></thead><tbody>{visible.map((member) => <tr key={member.id}><td><input aria-label={`Select ${member.displayName}`} type="checkbox" checked={selected.includes(member.id)} onChange={(event) => setSelected((current) => event.target.checked ? [...current, member.id] : current.filter((id) => id !== member.id))} /></td><td><strong>{member.displayName}</strong><small>{member.email}</small></td><td><select value={member.role} disabled={!canManage || busy} onChange={(event) => void update(member, { role: event.target.value as Role })}>{roles.map((role) => <option key={role}>{role}</option>)}</select></td><td><div className="permission-summary">{member.permissions.slice(0, 4).map((permission) => <span key={permission}>{permission === "*" ? "All permissions" : label(permission)}</span>)}{member.permissions.length > 4 && <span>+{member.permissions.length - 4} more</span>}</div></td><td>{member.lastSignedInAt ? new Date(member.lastSignedInAt).toLocaleString() : "Never"}</td><td><span className={`status-pill ${member.active ? "ok" : "muted"}`}>{member.active ? "Active" : "Disabled"}</span></td><td><button disabled={!canManage || busy} onClick={() => void update(member, { active: !member.active })}>{member.active ? "Disable" : "Enable"}</button></td></tr>)}</tbody></table></div>
      </section>
      {canManage && <section className="admin-team-card"><div className="section-heading"><div><span className="eyebrow">Add sub-admin</span><h2>Choose access before provisioning the account</h2><p>The email can sign in immediately using email OTP.</p></div></div><div className="admin-team-form"><label><span>Display name</span><input value={form.displayName} onChange={(event) => setForm((current) => ({ ...current, displayName: event.target.value }))}/></label><label><span>Email</span><input type="email" value={form.email} onChange={(event) => setForm((current) => ({ ...current, email: event.target.value }))}/></label><label><span>Base role</span><select value={form.role} onChange={(event) => setForm((current) => ({ ...current, role: event.target.value as Role, permissions: event.target.value === "OWNER" ? [] : current.permissions }))}>{roles.map((role) => <option key={role}>{role}</option>)}</select></label></div>{form.role !== "OWNER" && <fieldset className="permission-picker"><legend>Granular permissions</legend>{data.permissionCatalogue.map((permission) => <label key={permission}><input type="checkbox" checked={form.permissions.includes(permission)} onChange={() => toggle(permission)}/><span><strong>{label(permission)}</strong><small>{permission}</small></span></label>)}</fieldset>}<button className="button primary" disabled={busy || !form.displayName.trim() || !form.email.trim()} onClick={() => void invite()}>{busy ? "Saving access…" : "Add sub-admin →"}</button></section>}
    </>}
  </main>;
}
