"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { SettingsIcon } from "@/components/ui/settings-icon";
import { CandidatePopover } from "./candidate-popover";
export function CandidateSettingsMenu() {
    const pathname = usePathname();
    return <CandidatePopover label="Settings" title="Settings" current={pathname === "/candidate/settings"} className={`swx-settings-link ${pathname === "/candidate/settings" ? "candidate-settings-current" : ""}`} trigger={<SettingsIcon />}>
    {close => <nav aria-label="Settings choices" className="candidate-account-links">
      <h2 className="candidate-menu-heading">Settings</h2>
      {[["Job preferences", "/candidate/settings#job-preferences"], ["Notification preferences", "/candidate/settings#notifications"], ["Privacy & visibility", "/candidate/settings#privacy"], ["Account & security", "/candidate/settings#security"], ["Appearance", "/candidate/settings#appearance"], ["Data & consent", "/candidate/settings#data"]].map(([label, href]) => <Link key={href} href={href} onClick={close}>{label}</Link>)}
    </nav>}
  </CandidatePopover>;
}
