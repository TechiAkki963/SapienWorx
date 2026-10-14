"use client";
import { useEffect, useRef, useState, type ReactNode } from "react";
import Link from "next/link";
import { CandidateNav } from "./candidate-nav";
import { CandidateProfileMenu } from "./candidate-profile-menu";
import { CandidateTopbar } from "./candidate-topbar";
export function CandidateFrame({ children, name, initialCollapsed, preferenceKey }: {
    children: ReactNode;
    name: string;
    initialCollapsed: boolean;
    preferenceKey: string;
}) {
    const [collapsed, setCollapsed] = useState(initialCollapsed);
    const [animate, setAnimate] = useState(false);
    const [tablet, setTablet] = useState(false), [tabletExpanded, setTabletExpanded] = useState(false);
    const toggleRef = useRef<HTMLButtonElement>(null);
    useEffect(() => { const media = matchMedia("(min-width:768px) and (max-width:1023px)"); const update = () => { setTablet(media.matches); setTabletExpanded(false); }; update(); media.addEventListener("change", update); return () => media.removeEventListener("change", update); }, []);
    useEffect(() => {
        if (!tabletExpanded)
            return;
        const escape = (event: KeyboardEvent) => {
            if (event.key === "Escape") {
                setTabletExpanded(false);
                toggleRef.current?.focus();
            }
        };
        document.addEventListener("keydown", escape);
        return () => document.removeEventListener("keydown", escape);
    }, [tabletExpanded]);
    const effectiveCollapsed = tablet ? !tabletExpanded : collapsed;
    function toggle() {
        setAnimate(true);
        if (tablet) {
            setTabletExpanded(value => !value);
            return;
        }
        const next = !collapsed;
        document.cookie = `${preferenceKey}=${next ? "collapsed" : "expanded"}; Path=/; Max-Age=31536000; SameSite=Lax${location.protocol === "https:" ? "; Secure" : ""}`;
        setCollapsed(next);
    }
    return <div className="candidate-frame" data-sidebar-animated={animate} data-sidebar-collapsed={effectiveCollapsed} data-tablet-expanded={tabletExpanded}>
    <aside className="candidate-workspace-sidebar" id="candidate-desktop-sidebar">
      <Link href="/candidate" aria-label="SapienWorx Candidate home" className="candidate-sidebar-brand">
        <img className="candidate-sidebar-wordmark" src="/brand/recruiter/logo-wordmark-white.png" alt="SapienWorx" width="172" height="36"/>
        <img className="candidate-sidebar-mark" src="/brand/recruiter/android-chrome-192x192.png" alt="SapienWorx" width="36" height="36"/>
      </Link>
      <button ref={toggleRef} type="button" className="candidate-sidebar-toggle" aria-label={effectiveCollapsed ? "Expand sidebar" : "Collapse sidebar"} aria-expanded={!effectiveCollapsed} aria-controls="candidate-workspace-navigation" onClick={toggle}><span aria-hidden="true">{effectiveCollapsed ? "›" : "‹"}</span></button>
      <CandidateNav collapsed={effectiveCollapsed}/>
      <CandidateProfileMenu name={name} sidebar collapsed={effectiveCollapsed}/>
    </aside>
    {tabletExpanded && <button type="button" className="candidate-tablet-backdrop" aria-label="Close Candidate navigation" onClick={() => { setTabletExpanded(false); toggleRef.current?.focus(); }}/>}
    <div className="candidate-main-shell">
      <header className="candidate-workspace-header"><div className="candidate-workspace-topbar">
        <Link href="/candidate" className="candidate-mobile-brand" aria-label="SapienWorx Candidate home"><img src="/brand/recruiter/android-chrome-192x192.png" alt="SapienWorx" width="32" height="32"/></Link>
        <form action="/candidate/jobs" className="candidate-global-search" role="search"><label className="sr-only" htmlFor="candidate-global-query">Search jobs, companies or keywords</label><svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true"><circle cx="10" cy="10" r="7"/><path d="m15 15 6 6"/></svg><input id="candidate-global-query" name="q" placeholder="Search jobs, companies or keywords…" maxLength={160}/><button className="sr-only" type="submit">Search jobs</button></form>
        <CandidateTopbar name={name}/>
      </div></header>
      <main id="main-content" tabIndex={-1} className="candidate-workspace-main">{children}</main>
    </div>
    <CandidateNav mobile/>
  </div>;
}
