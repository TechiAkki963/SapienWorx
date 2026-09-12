"use client";

import { useEffect, useMemo, useState } from "react";
import { apiClient } from "../lib/api-client";
import { Button, WorkspaceShell } from "./ui";
import { MasterAdminInvitations } from "./master-admin-invitations";
import styles from "./master-admin-access-v2.module.css";

type Admin = {
  id: string;
  displayName: string;
  email: string;
  role: string;
  permissions: string[];
  permissionCeiling?: string[];
  customisedPermissions?: boolean;
  active: boolean;
  lastSignedInAt: string;
};
type GovernanceSummary = { currentAdmin: Admin; admins: Admin[] };

const permissionLabels: Record<string, { title: string; detail: string }> = {
  "platform.read": { title: "Platform read", detail: "View Master Access operational and governance data." },
  "operations.manage": { title: "Operations", detail: "Acknowledge and manage operational alerts." },
  "releases.manage": { title: "Releases", detail: "Manage feature releases and rollout controls." },
  "integrations.manage": { title: "Integrations", detail: "Manage integration state and secret references." },
  "knowledge.manage": { title: "Knowledge Hub", detail: "Manage public knowledge content." },
  "support.manage": { title: "Support", detail: "Approve and use masked support-access sessions." },
  "support.request_access": { title: "Request support access", detail: "Request purpose-limited support access." },
  "privacy.manage": { title: "Privacy", detail: "Manage privacy-rights workflows." },
  "audit.export": { title: "Audit export", detail: "Export authorised audit evidence." },
  "moderation.manage": { title: "Moderation", detail: "Review and action moderation cases." },
  "billing.manage": { title: "Billing", detail: "Manage organisation plan and billing controls." },
  "reports.export": { title: "Reports export", detail: "Export operational reports." },
};

const pretty = (value: string) => value.replaceAll("_", " ").replace(/\b\w/g, (character) => character.toUpperCase());
const date = (value: string) => value ? new Date(value).toLocaleString("en-IN") : "Never";

export function MasterAdminAccessV2() {
  const [data, setData] = useState<GovernanceSummary | null>(null);
  const [selectedId, setSelectedId] = useState("");
  const [draft, setDraft] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  const load = async () => {
    try {
      setLoading(true); setError("");
      const response = await apiClient<GovernanceSummary>("/api/admin/governance");
      setData(response);
      const firstEditable = response.admins.find((admin) => admin.role !== "OWNER" && admin.id !== response.currentAdmin.id);
      setSelectedId((current) => current && response.admins.some((admin) => admin.id === current) ? current : firstEditable?.id ?? response.admins[0]?.id ?? "");
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Administrator access could not be loaded.");
    } finally { setLoading(false); }
  };

  useEffect(() => { void load(); }, []);

  const selected = useMemo(() => data?.admins.find((admin) => admin.id === selectedId) ?? null, [data, selectedId]);
  useEffect(() => { setDraft(selected?.permissions ?? []); setNotice(""); setError(""); }, [selectedId, selected?.permissions]);

  const ceiling = selected?.role === "OWNER" ? ["*"] : selected?.permissionCeiling ?? [];
  const editable = Boolean(data && selected && data.currentAdmin.role === "OWNER" && selected.role !== "OWNER" && selected.id !== data.currentAdmin.id);
  const permissionOptions = ceiling.filter((permission) => permission !== "*");

  const toggle = (permission: string) => {
    if (!editable || permission === "platform.read") return;
    setDraft((current) => current.includes(permission) ? current.filter((item) => item !== permission) : [...current, permission]);
  };

  const save = async () => {
    if (!selected || !editable) return;
    try {
      setSaving(true); setError(""); setNotice("");
      await apiClient(`/api/admin/governance/admins/${selected.id}/permissions`, {
        method: "PUT",
        body: JSON.stringify({ permissions: draft }),
      });
      setNotice(`Permissions saved for ${selected.displayName}.`);
      await load();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Permissions could not be updated.");
    } finally { setSaving(false); }
  };

  return <WorkspaceShell workspace="admin" active="users" title="Administrator access" description="Granular, server-enforced access for the people who operate SapienWorx.">
    <main className={styles.page}>
      <header className={styles.header}>
        <div><span className={styles.eyebrow}>Master Access</span><h2>Administrators & permissions</h2><p>Roles define the maximum access envelope. Owners can narrow individual non-Owner permissions without expanding them beyond that role.</p></div>
        <div className={styles.headerActions}><Button href="/admin#users" variant="secondary">User directory</Button><Button href="/admin#advanced" variant="secondary">Governance</Button></div>
      </header>

      {error && <p className={styles.error} role="alert">{error}</p>}
      {notice && <p className={styles.notice} role="status">{notice}</p>}

      <section className={styles.layout}>
        <div className={styles.tablePanel}>
          <div className={styles.panelTitle}><div><span className={styles.eyebrow}>Access directory</span><h3>{data?.admins.length ?? 0} administrators</h3></div><span>Server enforced</span></div>
          <div className={styles.tableWrap}><table><thead><tr><th>Administrator</th><th>Role</th><th>Access</th><th>Last sign-in</th><th>Status</th></tr></thead><tbody>
            {loading ? <tr><td colSpan={5}>Loading administrators…</td></tr> : data?.admins.map((admin) => <tr key={admin.id} className={selectedId === admin.id ? styles.selectedRow : undefined} onClick={() => setSelectedId(admin.id)}><td><button type="button" className={styles.identityButton} onClick={() => setSelectedId(admin.id)}><strong>{admin.displayName}</strong><span>{admin.email}</span></button></td><td>{pretty(admin.role)}</td><td>{admin.role === "OWNER" ? "Full access" : `${admin.permissions.length} enabled`}{admin.customisedPermissions && <small>Customised</small>}</td><td>{date(admin.lastSignedInAt)}</td><td><span className={admin.active ? styles.active : styles.inactive}>{admin.active ? "Active" : "Disabled"}</span></td></tr>) }
          </tbody></table></div>
        </div>

        <aside className={styles.permissionPanel}>
          {selected ? <>
            <header><div><span className={styles.eyebrow}>Permission set</span><h3>{selected.displayName}</h3><p>{selected.email}</p></div><span className={styles.role}>{pretty(selected.role)}</span></header>
            {selected.role === "OWNER" ? <div className={styles.ownerState}><strong>Owner access is intentionally complete.</strong><p>Owner privileges cannot be narrowed from this screen. Changes to Owner responsibility require the controlled administrator-role process.</p></div> : <div className={styles.permissions}>
              {permissionOptions.map((permission) => {
                const copy = permissionLabels[permission] ?? { title: pretty(permission), detail: "Platform permission." };
                const enabled = draft.includes(permission);
                return <label key={permission} className={!editable ? styles.locked : undefined}><input type="checkbox" checked={enabled} disabled={!editable || permission === "platform.read"} onChange={() => toggle(permission)} /><span><strong>{copy.title}</strong><small>{copy.detail}</small></span><code>{permission}</code></label>;
              })}
            </div>}
            {selected.role !== "OWNER" && <footer><p>{editable ? "Only permissions within this role’s server-defined ceiling can be enabled." : "Only another Owner can change this administrator’s permissions."}</p><button type="button" className={styles.save} disabled={!editable || saving} onClick={() => void save()}>{saving ? "Saving…" : "Save permissions"}</button></footer>}
          </> : <div className={styles.empty}>Select an administrator to review access.</div>}
        </aside>
      </section>

      <MasterAdminInvitations owner={data?.currentAdmin.role === "OWNER"} />
    </main>
  </WorkspaceShell>;
}
