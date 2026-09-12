"use client";

import { useEffect, useMemo, useState } from "react";
import { apiClient } from "../lib/api-client";
import { Button } from "./ui";
import styles from "./master-admin-access-v2.module.css";

type Invitation = { id: string; displayName: string; email: string; role: string; permissions: string[]; invitedBy: string; createdAt: string; expiresAt: string; acceptedAt: string; revokedAt: string; status: string };

const rolePermissions: Record<string, string[]> = {
  OPERATIONS: ["platform.read", "operations.manage", "releases.manage", "integrations.manage", "knowledge.manage"],
  SUPPORT: ["platform.read", "support.manage", "support.request_access"],
  COMPLIANCE: ["platform.read", "privacy.manage", "audit.export", "moderation.manage"],
  FINANCE: ["platform.read", "billing.manage", "reports.export"],
  READ_ONLY: ["platform.read"],
};
const roles = Object.keys(rolePermissions);
const pretty = (value: string) => value.replaceAll("_", " ").replace(/\b\w/g, (character) => character.toUpperCase());
const date = (value: string) => value ? new Date(value).toLocaleString("en-IN") : "Not recorded";

export function MasterAdminInvitations({ owner }: { owner: boolean }) {
  const [items, setItems] = useState<Invitation[]>([]);
  const [form, setForm] = useState({ displayName: "", email: "", role: "READ_ONLY", permissions: ["platform.read"] });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  const load = async () => {
    if (!owner) return;
    try { setItems(await apiClient<Invitation[]>("/api/admin/governance/admin-invitations")); }
    catch (reason) { setError(reason instanceof Error ? reason.message : "Administrator invitations could not be loaded."); }
  };
  useEffect(() => { void load(); }, [owner]);

  const ceiling = rolePermissions[form.role] ?? [];
  const pending = useMemo(() => items.filter((item) => item.status === "PENDING"), [items]);

  const changeRole = (role: string) => setForm((current) => ({ ...current, role, permissions: rolePermissions[role] ?? ["platform.read"] }));
  const toggle = (permission: string) => {
    if (permission === "platform.read") return;
    setForm((current) => ({ ...current, permissions: current.permissions.includes(permission) ? current.permissions.filter((item) => item !== permission) : [...current.permissions, permission] }));
  };

  const invite = async () => {
    if (!form.displayName.trim() || !form.email.trim()) { setError("Enter the administrator name and email address."); return; }
    try {
      setBusy(true); setError(""); setNotice("");
      await apiClient("/api/admin/governance/admin-invitations", { method: "POST", body: JSON.stringify(form) });
      setNotice(`Invitation sent to ${form.email.trim()}.`);
      setForm({ displayName: "", email: "", role: "READ_ONLY", permissions: ["platform.read"] });
      await load();
    } catch (reason) { setError(reason instanceof Error ? reason.message : "The invitation could not be created."); }
    finally { setBusy(false); }
  };

  const revoke = async (item: Invitation) => {
    if (!window.confirm(`Revoke the invitation for ${item.displayName}? The activation link will stop working immediately.`)) return;
    try {
      setBusy(true); setError(""); setNotice("");
      await apiClient(`/api/admin/governance/admin-invitations/${item.id}/revoke`, { method: "POST" });
      setNotice(`Invitation revoked for ${item.displayName}.`);
      await load();
    } catch (reason) { setError(reason instanceof Error ? reason.message : "The invitation could not be revoked."); }
    finally { setBusy(false); }
  };

  if (!owner) return <section className={styles.inviteNote}><div><span className={styles.eyebrow}>Administrator provisioning</span><h3>Owner approval required</h3><p>Only a Master Access Owner can issue, revoke, or configure administrator invitations.</p></div><span>Server enforced</span></section>;

  return <section className={styles.invitationPanel}>
    <header><div><span className={styles.eyebrow}>Administrator provisioning</span><h3>Invite administrator</h3><p>Invitations expire after 24 hours. The invited administrator must set a password and verify their email before an account is created.</p></div><span>{pending.length} pending</span></header>
    {error && <p className={styles.error} role="alert">{error}</p>}{notice && <p className={styles.notice} role="status">{notice}</p>}
    <div className={styles.invitationLayout}>
      <div className={styles.inviteForm}>
        <label><span>Full name</span><input value={form.displayName} onChange={(event) => setForm({ ...form, displayName: event.target.value })} placeholder="Administrator name" /></label>
        <label><span>Work email</span><input type="email" value={form.email} onChange={(event) => setForm({ ...form, email: event.target.value })} placeholder="name@company.com" /></label>
        <label><span>Role ceiling</span><select value={form.role} onChange={(event) => changeRole(event.target.value)}>{roles.map((role) => <option value={role} key={role}>{pretty(role)}</option>)}</select></label>
        <div className={styles.invitePermissions}><span>Initial permissions</span>{ceiling.map((permission) => <label key={permission}><input type="checkbox" checked={form.permissions.includes(permission)} disabled={permission === "platform.read"} onChange={() => toggle(permission)} /><span>{pretty(permission)}</span></label>)}</div>
        <Button disabled={busy || !form.displayName.trim() || !form.email.trim()} onClick={() => void invite()}>{busy ? "Sending invitation…" : "Send secure invitation"}</Button>
        <p className={styles.inviteHelp}>Owner access cannot be provisioned by invitation. Owner responsibility continues through the controlled role-change process.</p>
      </div>
      <div className={styles.inviteList}><div className={styles.inviteListTitle}><strong>Invitation history</strong><span>Latest 100</span></div>{items.length ? items.map((item) => <article key={item.id}><div><strong>{item.displayName}</strong><span>{item.email} · {pretty(item.role)}</span><small>Invited by {item.invitedBy} · expires {date(item.expiresAt)}</small></div><div><span className={`${styles.inviteStatus} ${item.status === "PENDING" ? styles.pending : item.status === "ACCEPTED" ? styles.accepted : styles.closed}`}>{pretty(item.status)}</span>{item.status === "PENDING" && <button type="button" onClick={() => void revoke(item)} disabled={busy}>Revoke</button>}</div></article>) : <p className={styles.empty}>No administrator invitations have been issued.</p>}</div>
    </div>
  </section>;
}
