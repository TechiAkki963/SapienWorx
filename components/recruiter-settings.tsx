"use client";

import { useEffect, useState } from "react";
import { apiClient } from "../lib/api-client";
import { Badge, Button, Meter, SectionTitle, WorkspaceShell } from "./ui";
import { AccountSecurity } from "./account-security";

type RecruiterAccountSettings = {
  organisationId: string;
  organisationName: string;
  currentUserRole: "ORG_ADMIN" | "RECRUITER";
  planName: string;
  recruiterSeatLimit: number;
  seatsUsed: number;
  monthlyJobCreditLimit: number;
  jobsThisMonth: number;
  invoiceStatus: string;
  renewalAt: string | null;
  savedSearchAlertsEnabled: boolean;
  campaignsEnabled: boolean;
  accountReviewStatus: "PENDING" | "VERIFIED" | "NEEDS_INFORMATION" | "REJECTED";
  reviewDueAt: string | null;
  workEmailDomain: string | null;
};

const pretty = (value: string) => value.replaceAll("_", " ").replace(/\b\w/g, (letter) => letter.toUpperCase());
const ratio = (used: number, limit: number) => limit ? Math.min(100, Math.round(used / limit * 100)) : 0;

export function RecruiterSettings() {
  const [settings, setSettings] = useState<RecruiterAccountSettings | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [reloadToken, setReloadToken] = useState(0);
  useEffect(() => {
    let active = true;
    setLoading(true); setError("");
    void apiClient<RecruiterAccountSettings>("/api/recruiter/workflow/account-settings")
      .then((value) => { if (active) setSettings(value); })
      .catch((reason) => { if (active) setError(reason instanceof Error ? reason.message : "We could not load your organisation settings."); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [reloadToken]);

  return <WorkspaceShell workspace="recruiter" active="settings" title="Organisation settings" description="See your plan, allowances, workspace permissions, and organisation safeguards in one place.">
    <main className="workflow-page recruiter-settings-page">
      {loading && <p className="workflow-loading" role="status">Loading organisation settings…</p>}
      {error && !loading && <section className="panel settings-recovery" role="alert"><span aria-hidden="true">↻</span><div><h2>Settings are temporarily unavailable</h2><p>{error}</p><Button variant="secondary" onClick={() => setReloadToken((value) => value + 1)}>Try again</Button></div></section>}
      {settings && !loading && <>
        <section className="recruiter-settings-hero"><div><span className="eyebrow">Current workspace</span><h2>{settings.organisationName}</h2><p>Your access level is <b>{pretty(settings.currentUserRole)}</b>. {settings.workEmailDomain ? `The verified work-email domain is ${settings.workEmailDomain}.` : "The organisation domain is awaiting verification."}</p></div><div><Badge tone={settings.accountReviewStatus === "VERIFIED" ? "green" : settings.accountReviewStatus === "REJECTED" ? "rose" : "amber"}>{pretty(settings.accountReviewStatus)} review</Badge><strong>{pretty(settings.planName)} plan</strong>{settings.reviewDueAt && settings.accountReviewStatus === "PENDING" && <small>Review expected by {new Date(settings.reviewDueAt).toLocaleDateString()}</small>}{settings.renewalAt && <small>Renews {new Date(settings.renewalAt).toLocaleDateString()}</small>}</div></section>
        <section className="workflow-grid workflow-two recruiter-allowances">
          <article className="panel"><SectionTitle eyebrow="Team allowance" title="Recruiter seats"/><div className="allowance-number"><strong>{settings.seatsUsed}</strong><span>of {settings.recruiterSeatLimit || "unlimited"} seats used</span></div>{settings.recruiterSeatLimit > 0 && <Meter value={ratio(settings.seatsUsed, settings.recruiterSeatLimit)}/>}<p>{settings.recruiterSeatLimit && settings.seatsUsed >= settings.recruiterSeatLimit ? "Your seat allowance is full. An organisation admin must change the plan before inviting another recruiter." : "Available seats can be assigned to verified work-email accounts."}</p></article>
          <article className="panel"><SectionTitle eyebrow="Monthly allowance" title="Job publishing credits"/><div className="allowance-number"><strong>{settings.jobsThisMonth}</strong><span>of {settings.monthlyJobCreditLimit || "unlimited"} jobs used</span></div>{settings.monthlyJobCreditLimit > 0 && <Meter value={ratio(settings.jobsThisMonth, settings.monthlyJobCreditLimit)}/>}<p>{settings.monthlyJobCreditLimit && settings.jobsThisMonth >= settings.monthlyJobCreditLimit ? "The monthly publishing allowance has been reached." : "Draft jobs do not consume a publishing credit until they are posted."}</p></article>
        </section>
        <section className="workflow-grid workflow-two">
          <article className="panel settings-capabilities"><SectionTitle eyebrow="Workspace safeguards" title="Enabled capabilities"/><div><span>Saved-search alerts</span><Badge tone={settings.savedSearchAlertsEnabled ? "green" : "neutral"}>{settings.savedSearchAlertsEnabled ? "Enabled" : "Disabled"}</Badge></div><div><span>Recruiter campaigns</span><Badge tone={settings.campaignsEnabled ? "green" : "neutral"}>{settings.campaignsEnabled ? "Enabled" : "Disabled"}</Badge></div><p>Organisation administrators can change retention, alerts, campaigns, and member roles inside Recruitment Workspace.</p><Button href="/recruiter/workbench#controls" variant="secondary">Open workspace controls</Button></article>
          <article className="panel settings-security"><SectionTitle eyebrow="Security" title="Sign-in and organisation access"/><ul><li>Official work email verification is required.</li><li>OTP challenges protect new or untrusted sessions.</li><li>Candidate contact access is recorded against hiring context.</li></ul><p>Need a plan or billing change? Contact your organisation administrator so access stays auditable.</p></article>
        </section>
        <AccountSecurity/>
      </>}
    </main>
  </WorkspaceShell>;
}
