"use client";
import { useEffect, useState } from "react";
import { apiRequest } from "@/lib/api";
import { useCandidateWorkspace } from "./candidate-workspace-state";
type Preferences = {
    notifications: Record<string, boolean>;
    product_analytics: boolean;
};
const categories = [["applications", "Application updates"], ["interviews", "Interview reminders"], ["offers", "Offer updates"], ["messages", "Message notifications"], ["job_alerts", "Job and saved-search alerts"]];
export function CandidateNotificationPreferences() {
    const [preferences, setPreferences] = useState<Preferences | null>(null), [busy, setBusy] = useState(false), [message, setMessage] = useState(""), [failed, setFailed] = useState(false);
    useEffect(() => {
        const abort = new AbortController();
        void apiRequest<Preferences>("/api/v1/candidate/preferences", { signal: abort.signal }).then(setPreferences).catch(() => {
            if (!abort.signal.aborted) {
                setMessage("Your notification preferences could not be loaded. Reload to try again.");
                setFailed(true);
            }
        });
        return () => abort.abort();
    }, []);
    return <form onSubmit={event => {
            event.preventDefault();
            if (!preferences)
                return;
            setBusy(true);
            setMessage("");
            setFailed(false);
            void apiRequest<Preferences>("/api/v1/candidate/preferences", { method: "PATCH", body: JSON.stringify({ notifications: preferences.notifications }) }).then(result => { setPreferences(result); setMessage("Notification preferences saved."); window.dispatchEvent(new Event("swx-notifications-changed")); }).catch(cause => { setFailed(true); setMessage(cause instanceof Error ? cause.message : "Could not save preferences."); }).finally(() => setBusy(false));
        }}>
  {preferences ? <fieldset disabled={busy} className="candidate-preference-options"><legend className="sr-only">In-app notification preferences</legend>{categories.map(([key, label]) => <label key={key}><input type="checkbox" checked={preferences.notifications[key] !== false} onChange={event => setPreferences({ ...preferences, notifications: { ...preferences.notifications, [key]: event.target.checked } })}/>{label}</label>)}</fieldset> : !failed && <p role="status">Loading preferences…</p>}
  {preferences && <button type="submit" className="candidate-primary-action" disabled={busy}>{busy ? "Saving…" : "Save notification preferences"}</button>}
  {message && <p role={failed ? "alert" : "status"} className={failed ? "candidate-error" : "candidate-preference-status"}>{message}</p>}
 </form>;
}
export function CandidateAnalyticsConsent() {
    const { patchIdentity } = useCandidateWorkspace();
    const [enabled, setEnabled] = useState<boolean | null>(null), [busy, setBusy] = useState(false), [message, setMessage] = useState(""), [failed, setFailed] = useState(false);
    useEffect(() => {
        const abort = new AbortController();
        void apiRequest<Preferences>("/api/v1/candidate/preferences", { signal: abort.signal }).then(result => setEnabled(result.product_analytics)).catch(() => {
            if (!abort.signal.aborted) {
                setFailed(true);
                setMessage("Your consent preference could not be loaded. Reload to try again.");
            }
        });
        return () => abort.abort();
    }, []);
    return <div><label className="candidate-preference-consent"><input type="checkbox" checked={enabled === true} disabled={busy || enabled === null} onChange={event => { const previous = enabled; const next = event.target.checked; setEnabled(next); setBusy(true); setMessage(""); setFailed(false); void apiRequest<Preferences>("/api/v1/candidate/preferences", { method: "PATCH", body: JSON.stringify({ product_analytics: next }) }).then(result => { setEnabled(result.product_analytics); patchIdentity({ product_analytics_enabled: result.product_analytics }); setMessage(next ? "Optional product analytics enabled." : "Optional product analytics disabled."); }).catch(cause => { setEnabled(previous); setFailed(true); setMessage(cause instanceof Error ? cause.message : "Could not save your consent."); }).finally(() => setBusy(false)); }}/>Allow optional product analytics</label><p>Help improve the job-card and application journey using first-party interaction events. This is off by default. No advertising or third-party tracking service is used, and your choice does not affect applications.</p>{message && <p role={failed ? "alert" : "status"} className={failed ? "candidate-error" : "candidate-preference-status"}>{message}</p>}</div>;
}
