"use client";

import { useState } from "react";
import { Button, SectionTitle, WorkspaceShell } from "./ui";

export function CandidateSettings() {
  const [automationConsent, setAutomationConsent] = useState(false);
  const [deletionRequested, setDeletionRequested] = useState(false);
  const [downloadRequested, setDownloadRequested] = useState(false);

  return <WorkspaceShell workspace="candidate" active="settings" title="Settings" description="Manage your account preferences, privacy choices and Sapienworx data.">
    <div className="settings-layout"><section className="panel"><SectionTitle eyebrow="Account" title="Account preferences"/><div className="settings-row"><div><strong>Contact details</strong><p>Update your email or mobile number with a new dual verification.</p></div><Button variant="quiet">Update details</Button></div><div className="settings-row"><div><strong>Profile visibility</strong><p>Your profile is visible only when you apply or choose to share it.</p></div><Button variant="quiet">Manage visibility</Button></div></section><section className="panel privacy-panel"><SectionTitle eyebrow="Your data" title="Privacy controls"/><p className="settings-intro">Control optional data use and exercise your data rights at any time.</p><label className="privacy-toggle"><input type="checkbox" checked={automationConsent} onChange={(event) => setAutomationConsent(event.target.checked)}/><span><b>Future automation consent</b><small>{automationConsent ? "Optional consent recorded today. You may withdraw this at any time." : "Not enabled. Your data will not be considered for future improvement research."}</small></span></label><button className="privacy-link" onClick={() => setDownloadRequested(true)}>Download my data <span>→</span></button>{downloadRequested && <div className="settings-feedback"><b>Data export requested</b><p>We’ll prepare a secure, time-limited download after identity confirmation.</p></div>}<button className="privacy-link danger" onClick={() => setDeletionRequested(true)}>Delete my account and data <span>→</span></button>{deletionRequested && <div className="deletion-state"><b>Deletion request started</b><p>A secure data-erasure request needs identity confirmation before processing. The completed backend workflow will hard-delete your profile, documents and parser metadata within the legal timeframe and retain only an anonymised audit hash.</p></div>}</section></div>
  </WorkspaceShell>;
}
