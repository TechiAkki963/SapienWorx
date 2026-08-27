"use client";

import { createContext, type ReactNode, useCallback, useContext, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { getCandidateDomain, resolveCandidateDomain, type CandidateDomainCategory } from "../lib/candidate-domain";
import { AuthFrame } from "./auth";
import { Button } from "./ui";

type ResolvedDomain = "TECH" | "NON_TECH";
type CandidateDomainContextValue = { domainCategory: CandidateDomainCategory | null };
type GateState =
  | { status: "loading" }
  | { status: "error"; message: string }
  | { status: "ready"; domainCategory: CandidateDomainCategory; message?: string };

const CandidateDomainContext = createContext<CandidateDomainContextValue>({ domainCategory: null });
const LOCAL_DOMAIN_STORAGE_KEY = "sapienworx.local-candidate-domain";

function isLocalDemo() {
  // The browser also runs on localhost in the Compose-backed QA environment.
  // Only turn off API-backed domain checks when an explicit test/demo flag is
  // supplied; otherwise an authenticated candidate's stored category must win.
  return process.env.NEXT_PUBLIC_LOCAL_DEMO === "true";
}

function localDomainCategory(): CandidateDomainCategory | null {
  const stored = window.localStorage.getItem(LOCAL_DOMAIN_STORAGE_KEY);
  return stored === "TECH" || stored === "NON_TECH" || stored === "MIXED_AMBIGUOUS" || stored === "UNASSIGNED" ? stored : null;
}

export function useCandidateDomain() {
  return useContext(CandidateDomainContext);
}

/**
 * Candidate route guard. It fails closed until the API has confirmed a final
 * domain, then presents the appropriate mandatory decision experience.
 */
export function CandidateDomainGate({ children }: { children: ReactNode }) {
  const router = useRouter();
  const [state, setState] = useState<GateState>({ status: "loading" });

  const loadDomain = useCallback(async (signal?: AbortSignal) => {
    setState({ status: "loading" });
    if (isLocalDemo()) {
      setState({ status: "ready", domainCategory: localDomainCategory() ?? "UNASSIGNED" });
      return;
    }
    try {
      const response = await getCandidateDomain(signal);
      if (!["TECH", "NON_TECH", "MIXED_AMBIGUOUS", "UNASSIGNED"].includes(response.domainCategory)) {
        throw new Error("Your profile domain could not be verified. Please try again.");
      }
      setState({ status: "ready", domainCategory: response.domainCategory });
    } catch (error) {
      if (signal?.aborted) return;
      setState({
        status: "error",
        message: error instanceof Error ? error.message : "Your profile domain could not be verified. Please try again.",
      });
    }
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    void loadDomain(controller.signal);
    return () => controller.abort();
  }, [loadDomain]);

  const confirmDomain = useCallback((selection: ResolvedDomain) => {
    if (state.status !== "ready") return;
    const previousDomain = state.domainCategory;

    if (isLocalDemo()) {
      window.localStorage.setItem(LOCAL_DOMAIN_STORAGE_KEY, selection);
      setState({ status: "ready", domainCategory: selection });
      if (previousDomain === "UNASSIGNED") router.replace("/candidate/profile");
      return;
    }

    // Optimistically unlock the requested route. If the request fails, the
    // original mandatory state is restored immediately and remains blocking.
    setState({ status: "ready", domainCategory: selection });
    if (previousDomain === "UNASSIGNED") router.replace("/candidate/profile");

    void resolveCandidateDomain(selection)
      .then((response) => setState({ status: "ready", domainCategory: response.domainCategory }))
      .catch((error) => setState({
        status: "ready",
        domainCategory: previousDomain,
        message: error instanceof Error ? error.message : "We could not save your choice. Please try again.",
      }));
  }, [router, state]);

  if (state.status === "loading") return <DomainVerificationState />;
  if (state.status === "error") return <DomainVerificationState message={state.message} onRetry={() => void loadDomain()} />;

  const contextValue = { domainCategory: state.domainCategory };
  if (state.domainCategory === "UNASSIGNED") {
    return <CandidateDomainContext.Provider value={contextValue}>
      <DomainResolution mode="unassigned" message={state.message} onConfirm={confirmDomain} />
    </CandidateDomainContext.Provider>;
  }

  if (state.domainCategory === "MIXED_AMBIGUOUS") {
    return <CandidateDomainContext.Provider value={contextValue}>
      <div className="candidate-domain-obscured" aria-hidden="true" inert>{children}</div>
      <div className="candidate-domain-overlay">
        <DomainResolution mode="mixed" message={state.message} onConfirm={confirmDomain} />
      </div>
    </CandidateDomainContext.Provider>;
  }

  return <CandidateDomainContext.Provider value={contextValue}>{children}</CandidateDomainContext.Provider>;
}

function DomainVerificationState({ message, onRetry }: { message?: string; onRetry?: () => void }) {
  return <main className="domain-verification-state" aria-live="polite">
    <div className="domain-verification-card">
      <span className="domain-verification-mark" aria-hidden="true">✦</span>
      <h1>{message ? "We need to verify your profile" : "Preparing your career workspace"}</h1>
      <p>{message ?? "We’re confirming your profile focus before opening your candidate workspace."}</p>
      {onRetry ? <Button onClick={onRetry}>Try again</Button> : <span className="domain-verification-loader" aria-label="Verifying profile domain" />}
    </div>
  </main>;
}

function DomainResolution({ mode, message, onConfirm }: {
  mode: "mixed" | "unassigned";
  message?: string;
  onConfirm: (selection: ResolvedDomain) => void;
}) {
  const [selection, setSelection] = useState<ResolvedDomain | null>(null);
  const dialogRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (mode !== "mixed") return;
    dialogRef.current?.focus();
    const preventEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        event.stopPropagation();
      }
    };
    window.addEventListener("keydown", preventEscape, true);
    return () => window.removeEventListener("keydown", preventEscape, true);
  }, [mode]);

  const choices: Array<{ value: ResolvedDomain; icon: string; title: string; copy: string }> = [
    { value: "TECH", icon: ">_", title: "Engineering & Technical", copy: "Software development, data, and IT infrastructure." },
    { value: "NON_TECH", icon: "▤", title: "Business & Strategy", copy: "Product management, marketing, sales, and operations." },
  ];

  const selectionControls = <div className={mode === "mixed" ? "domain-choice-grid" : "domain-choice-stack"} role="radiogroup" aria-label="Choose your primary domain">
    {choices.map((choice) => <button
      type="button"
      key={choice.value}
      role="radio"
      aria-checked={selection === choice.value}
      className={selection === choice.value ? "domain-choice-card selected" : "domain-choice-card"}
      onClick={() => setSelection(choice.value)}
    >
      <span className="domain-choice-icon" aria-hidden="true">{choice.icon}</span>
      <span><strong>{choice.title}</strong><small>{choice.copy}</small></span>
      <i aria-hidden="true" />
    </button>)}
  </div>;

  const resolutionBody = <>
    {message && <p className="domain-resolution-error" role="alert">{message}</p>}
    {selectionControls}
    <Button onClick={() => selection && onConfirm(selection)} disabled={!selection}>Confirm my primary domain</Button>
  </>;

  if (mode === "unassigned") {
    return <AuthFrame
      eyebrow="Candidate onboarding"
      title="Tailor your Sapienworx experience."
      copy="Tell us your primary area of expertise so we can customise your profile fields and recommend the most relevant opportunities."
    >
      <section className="domain-resolution-full">{resolutionBody}</section>
    </AuthFrame>;
  }

  return <section ref={dialogRef} tabIndex={-1} className="domain-resolution-modal" role="dialog" aria-modal="true" aria-labelledby="domain-resolution-title" aria-describedby="domain-resolution-copy">
    <span className="domain-resolution-kicker">Your profile, your choice</span>
    <h1 id="domain-resolution-title">You have a brilliantly diverse profile.</h1>
    <p id="domain-resolution-copy">Our parser noticed a strong mix of both technical engineering and strategic business experience in your CV. To ensure we match you with the right recruitment teams, how would you like to categorise your primary focus?</p>
    {resolutionBody}
  </section>;
}
