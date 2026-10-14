"use client";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { apiRequest, APIRequestError } from "@/lib/api";
import { applicationChanged, requestApplicationState, requestApplicationJourney, type ApplicationJourney } from "@/lib/application-journey";
import { WorkspaceDialog } from "./workspace-dialog";
import { useOptionalCandidateWorkspace } from "./candidate-workspace-state";
import "./candidate-workspace.css";
export function JobApplyButton({ jobId, jobTitle, companyName, trackCard = false, detail = false }: {
    jobId: string;
    jobTitle: string;
    companyName: string;
    trackCard?: boolean;
    detail?: boolean;
}) {
    const [state, setState] = useState<ApplicationJourney | null>(null), [error, setError] = useState(""), [open, setOpen] = useState(false), [referral, setReferral] = useState(false);
    const workspace = useOptionalCandidateWorkspace(), root = useRef<HTMLSpanElement>(null);
    useEffect(() => {
        let alive = true, revision = 0;
        const refresh = () => {
            const current = ++revision;
            void requestApplicationState(jobId).then(value => {
                if (alive && current === revision) {
                    setState(value);
                    setError("");
                }
            }).catch(() => {
                if (alive && current === revision)
                    setError("Application status unavailable. Try again.");
            });
        };
        refresh();
        try {
            setReferral(sessionStorage.getItem("swx.pending.referral.job") === jobId && !!sessionStorage.getItem("swx.pending.referral"));
        }
        catch { }
        const changed = (event: Event) => {
            if ((event as CustomEvent).detail === jobId)
                refresh();
        };
        window.addEventListener("swx-application-changed", changed);
        return () => { alive = false; window.removeEventListener("swx-application-changed", changed); };
    }, [jobId]);
    useEffect(() => {
        if (!trackCard || !workspace?.identity?.product_analytics_enabled || !root.current)
            return;
        const observer = new IntersectionObserver(entries => {
            if (entries.some(entry => entry.isIntersecting && entry.intersectionRatio >= .5) && document.visibilityState === "visible") {
                void apiRequest("/api/v1/candidate/job-events", { method: "POST", body: JSON.stringify({ job_id: jobId, event: "job_card_viewed" }) }).catch(() => { });
                observer.disconnect();
            }
        }, { threshold: .5 });
        const target = root.current.closest("[data-candidate-job-card]") || root.current;
        observer.observe(target);
        const visible = () => { if (document.visibilityState === "visible") {
            observer.unobserve(target);
            observer.observe(target);
        } };
        document.addEventListener("visibilitychange", visible);
        return () => { observer.disconnect(); document.removeEventListener("visibilitychange", visible); };
    }, [jobId, trackCard, workspace?.identity?.product_analytics_enabled]);
    const label = state?.state === "applied" ? "Applied ✓" : state?.state === "closed" ? "Closed" : state?.state === "expired" ? "Expired" : state?.state === "unavailable" ? "Unavailable" : state?.state === "draft" ? "Continue application →" : error ? "Retry Apply" : state ? detail ? "Apply now →" : "Apply →" : "Checking…";
    return <span ref={root} className="candidate-apply-control">{referral ? <Link className="candidate-primary-action" href="/referrals">Review referral invitation</Link> : <button type="button" className="candidate-primary-action" disabled={!error && (!state || !["apply", "draft"].includes(state.state))} onClick={() => {
                setOpen(true);
                if (workspace?.identity?.product_analytics_enabled)
                    void apiRequest("/api/v1/candidate/job-events", { method: "POST", body: JSON.stringify({ job_id: jobId, event: "apply_clicked" }) }).catch(() => { });
            }}>{label}</button>}{open && <ApplicationModal jobId={jobId} jobTitle={jobTitle} companyName={companyName} onClose={() => setOpen(false)}/>}</span>;
}
function ApplicationModal({ jobId, jobTitle, companyName, onClose }: {
    jobId: string;
    jobTitle: string;
    companyName: string;
    onClose: () => void;
}) {
    const [state, setState] = useState<ApplicationJourney | null>(null), [answers, setAnswers] = useState<string[]>([]), [error, setError] = useState(""), [busy, setBusy] = useState(false), [review, setReview] = useState(false), [notice, setNotice] = useState(""), [submitted, setSubmitted] = useState(false), [retry, setRetry] = useState(0);
    const router = useRouter(), workspace = useOptionalCandidateWorkspace(), pending = useRef(false);
    useEffect(() => {
        let alive = true;
        setState(null);
        setError("");
        void requestApplicationJourney(jobId).then(value => {
            if (alive) {
                setState(value);
                setAnswers(value.questions.map((_, i) => value.answers[i] || ""));
                setReview(!value.questions.length);
            }
        }).catch(cause => {
            if (alive)
                setError(cause instanceof Error ? cause.message : "Could not load application.");
        });
        return () => { alive = false; };
    }, [jobId, retry]);
    async function save(submit = false) {
        if (!state || pending.current)
            return;
        pending.current = true;
        setBusy(true);
        setError("");
        setNotice("");
        try {
            const body = { job_id: jobId, question_version: state.question_version, revision: state.revision, answers };
            if (submit) {
                await apiRequest("/api/v1/candidate/applications", { method: "POST", body: JSON.stringify(body) });
                setSubmitted(true);
                applicationChanged(jobId);
                router.refresh();
            }
            else {
                const saved = await apiRequest<ApplicationJourney>("/api/v1/candidate/application-draft", { method: "PUT", body: JSON.stringify(body) });
                setState(saved);
                applicationChanged(jobId);
                setNotice("Draft saved. You can continue this application later.");
            }
        }
        catch (cause) {
            if (cause instanceof APIRequestError && cause.code === "already_applied") {
                setSubmitted(true);
                applicationChanged(jobId);
            }
            else {
                setError(cause instanceof Error ? cause.message : "Your application could not be saved.");
                if (cause instanceof APIRequestError && cause.code === "application_changed")
                    setNotice("Your local answers are retained. Copy them before reloading the updated questions.");
            }
        }
        finally {
            pending.current = false;
            setBusy(false);
        }
    }
    return <WorkspaceDialog title={submitted ? "Application submitted" : "Apply for this job"} onClose={onClose} busy={busy}><div className="candidate-job-share-context"><h3>{jobTitle}</h3><p>{companyName}</p></div>{submitted ? <><p role="status">Your application is in your tracker. You will not be asked to apply again.</p><Link className="candidate-primary-action" href="/candidate/applications">View applications</Link></> : !state ? <><p role={error ? "alert" : "status"}>{error || "Checking the current job and application…"}</p>{error && <button className="candidate-secondary-action" onClick={() => setRetry(v => v + 1)}>Try again</button>}</> : !["apply", "draft"].includes(state.state) ? <p role="status">{state.state === "applied" ? "You have already applied to this job." : "This job is no longer available for applications."}</p> : <form onSubmit={event => {
                event.preventDefault();
                if (review)
                    void save(true);
                else
                    setReview(true);
            }} className="candidate-application-form"><p>Apply as <strong>{workspace?.identity?.full_name || "your signed-in candidate account"}</strong>. Your professional profile and any uploaded resume are shared with this employer for this application.</p>{state.previous_questions?.length ? <section className="candidate-answer-review"><h3>The job’s questions changed</h3><p>Your earlier saved answers are preserved below. Answer the current questions before submitting.</p>{state.previous_questions.map((question, index) => <p key={index}><strong>{question}</strong><br />{state.previous_answers?.[index] || "No saved answer"}</p>)}</section> : null}{state.questions.length > 0 && <><h3>{review ? "Review your answers" : "Screening questions"}</h3><p>These questions are configured for this job. All answers are required before submission.</p>{state.questions.map((question, index) => <label key={index} className="candidate-screening-question"><span>{index + 1}. {question}</span>{review ? <p className="candidate-answer-review">{answers[index]}</p> : <textarea required maxLength={4000} rows={3} value={answers[index] || ""} onChange={event => setAnswers(current => current.map((answer, i) => i === index ? event.target.value : answer))} disabled={busy}/>}</label>)}</>}{!state.questions.length && <p>This job has no additional screening questions. Review the role before confirming your application.</p>}{error && <p role="alert" className="candidate-error">{error}</p>}{notice && <p role="status">{notice}</p>}<div className="candidate-application-actions">{review && state.questions.length > 0 && <button type="button" className="candidate-secondary-action" disabled={busy} onClick={() => setReview(false)}>Edit answers</button>}<button type="button" className="candidate-secondary-action" disabled={busy} onClick={() => void save()}>Save draft</button><button type="submit" className="candidate-primary-action" disabled={busy}>{busy ? "Saving…" : review ? "Submit application" : "Review application"}</button><button type="button" className="candidate-secondary-action" disabled={busy} onClick={onClose}>Cancel</button></div></form>}</WorkspaceDialog>;
}
