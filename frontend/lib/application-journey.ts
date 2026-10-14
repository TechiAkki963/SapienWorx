import { apiRequest } from "./api";
export type ApplicationJourney = {
    previous_questions?: string[];
    previous_answers?: string[];
    job_id: string;
    state: "apply" | "draft" | "applied" | "closed" | "expired" | "unavailable";
    questions: string[];
    question_version: string;
    answers: string[];
    revision: number;
};
type Pending = {
    resolve: (value: ApplicationJourney) => void;
    reject: (cause: unknown) => void;
};
const pending = new Map<string, Pending[]>();
let timer: ReturnType<typeof setTimeout> | null = null;
// Coalesce the visible page's controls, without keeping another user's state in a cache.
export function requestApplicationState(jobId: string): Promise<ApplicationJourney> {
    return new Promise((resolve, reject) => {
        pending.set(jobId, [...(pending.get(jobId) || []), { resolve, reject }]);
        if (!timer)
            timer = setTimeout(() => {
                timer = null;
                const entries = [...pending];
                pending.clear();
                for (let start = 0; start < entries.length; start += 50) {
                    const batch = entries.slice(start, start + 50);
                    void apiRequest<{
                        items: ApplicationJourney[];
                    }>("/api/v1/candidate/application-state?" + new URLSearchParams({ job_ids: batch.map(([id]) => id).join(",") })).then(result => {
                        for (const [id, waiters] of batch) {
                            const value = result.items.find(item => item.job_id === id);
                            for (const waiter of waiters) {
                                if (value)
                                    waiter.resolve(value);
                                else
                                    waiter.reject(new Error("Application status is unavailable."));
                            }
                        }
                    }).catch(cause => {
                        for (const [, waiters] of batch)
                            for (const waiter of waiters)
                                waiter.reject(cause);
                    });
                }
            }, 20);
    });
}
export function applicationChanged(jobId: string) { window.dispatchEvent(new CustomEvent("swx-application-changed", { detail: jobId })); }
export async function requestApplicationJourney(jobId: string) { const result = await apiRequest<{
    items: ApplicationJourney[];
}>("/api/v1/candidate/application-state?" + new URLSearchParams({ job_ids: jobId, details: "true" })); const value = result.items[0]; if (!value)
    throw new Error("Application status is unavailable."); return value; }
