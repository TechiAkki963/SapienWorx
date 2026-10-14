"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { apiRequest } from "@/lib/api";
import { CandidateAvatar } from "./candidate-avatar";
import { CandidatePopover } from "./candidate-popover";
import { useCandidateWorkspace } from "./candidate-workspace-state";
export function CandidateProfileMenu({ name, sidebar = false, collapsed = false }: {
    name: string;
    sidebar?: boolean;
    collapsed?: boolean;
}) {
    const { identity } = useCandidateWorkspace();
    const router = useRouter();
    const [busy, setBusy] = useState(false), [error, setError] = useState("");
    const fullName = identity?.full_name || name;
    return <CandidatePopover label={sidebar ? "Candidate profile menu" : "Candidate account"} title="Your account" placement={sidebar ? "beside" : "below"} className={sidebar ? "candidate-sidebar-profile" : "candidate-account-trigger"} trigger={<><CandidateAvatar name={name}/>{sidebar && !collapsed && <span className="candidate-sidebar-person"><strong title={fullName}>{fullName}</strong><span>Job Seeker</span></span>}{sidebar && !collapsed && <span aria-hidden="true">›</span>}</>}>
    {close => <>
      <div className="candidate-account-identity"><CandidateAvatar name={name}/><div><strong>{fullName}</strong><p>Job Seeker</p></div></div>
      <nav aria-label="Account links" className="candidate-account-links">
        {[["View profile", "/candidate/profile/preview"], ["Edit profile", "/candidate/profile?edit=intro"], ["Resume", "/candidate/profile#section-resume"], ["Profile completion", "/candidate/profile?panel=completion#profile-completion"], ["Help & support", "/candidate/help"]].map(([label, href], index) => <Link key={href} href={href} onClick={close} className={index === 4 ? "candidate-menu-divider" : ""}>{label}</Link>)}
      </nav>
      <button type="button" className="candidate-logout" disabled={busy} onClick={() => { setBusy(true); setError(""); void apiRequest("/api/v1/auth/logout", { method: "POST" }).then(() => { close(); router.replace("/login"); router.refresh(); }).catch(cause => { setError(cause instanceof Error ? cause.message : "Could not log out. Try again."); setBusy(false); }); }}>{busy ? "Logging out…" : "Log out"}</button>
      {error && <p role="alert" className="candidate-error">{error}</p>}
    </>}
  </CandidatePopover>;
}
