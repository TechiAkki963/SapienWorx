"use client";
import { useEffect, useState } from "react";
import { apiRequest } from "@/lib/api";
type PrivacyRequest = {
    id: string;
    request_type: string;
    status: string;
    created_at: string;
};
export function CandidateDataControls() {
    const [requests, setRequests] = useState<PrivacyRequest[]>([]), [kind, setKind] = useState("access"), [busy, setBusy] = useState(false), [message, setMessage] = useState(""), [failed, setFailed] = useState(false);
    useEffect(() => {
        const abort = new AbortController();
        void apiRequest<{
            items: PrivacyRequest[];
        }>("/api/v1/user/privacy/requests", { signal: abort.signal }).then(result => setRequests(result.items || [])).catch(() => {
            if (!abort.signal.aborted) {
                setFailed(true);
                setMessage("Your data requests could not be loaded.");
            }
        });
        return () => abort.abort();
    }, []);
    async function act(work: () => Promise<void>) {
        setBusy(true);
        setMessage("");
        setFailed(false);
        try {
            await work();
        }
        catch (cause) {
            setFailed(true);
            setMessage(cause instanceof Error ? cause.message : "The data request could not be completed.");
        }
        finally {
            setBusy(false);
        }
    }
    return <div><form onSubmit={event => { event.preventDefault(); void act(async () => { const result = await apiRequest<PrivacyRequest>("/api/v1/user/privacy/requests", { method: "POST", body: JSON.stringify({ request_type: kind }) }); setRequests(current => [result, ...current.filter(item => item.id !== result.id)]); setMessage("Your data request was received. Its progress is shown below."); }); }}><label className="candidate-data-type">Request type<select value={kind} disabled={busy} onChange={event => setKind(event.target.value)}>{[["access", "Access my data"], ["export", "Export my data"], ["rectification", "Correct my data"], ["restriction", "Restrict processing"], ["objection", "Object to processing"], ["erasure", "Request erasure"]].map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label><button className="candidate-primary-action" disabled={busy}>{busy ? "Working…" : "Submit data request"}</button></form><p className="mt-4 text-sm leading-7 text-ink-muted">Requests follow the existing privacy review and retention rules. Submitting an erasure request does not immediately delete your account.</p><button type="button" className="candidate-secondary-action" disabled={busy} onClick={() => void act(async () => { const bundle = await apiRequest<unknown>("/api/v1/user/privacy/export"); const url = URL.createObjectURL(new Blob([JSON.stringify(bundle, null, 2)], { type: "application/json" })); const link = document.createElement("a"); link.href = url; link.download = "sapienworx-data-export.json"; link.click(); setTimeout(() => URL.revokeObjectURL(url), 1000); setMessage("Your available account data was downloaded. Any review requirement is reported by the privacy service."); })}>Download available account data</button>{message && <p role={failed ? "alert" : "status"} className={failed ? "candidate-error" : "candidate-preference-status"}>{message}</p>}{requests.length > 0 && <ul aria-label="Your data requests" className="candidate-data-requests">{requests.map(request => <li key={request.id}><strong>{request.request_type.replaceAll("_", " ")}</strong><span>{request.status.replaceAll("_", " ")}</span></li>)}</ul>}</div>;
}
