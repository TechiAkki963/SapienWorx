type Workspace = "candidate" | "recruiter" | "admin";

const workspaceLabels: Record<Workspace, string> = {
  candidate: "candidate workspace",
  recruiter: "recruiter workspace",
  admin: "Master Access",
};

export function WorkspaceRouteLoading({ workspace }: { workspace: Workspace }) {
  return <main className={`route-loading-shell route-loading-${workspace}`} role="status" aria-live="polite" aria-label={`Loading ${workspaceLabels[workspace]}`} aria-busy="true">
    <span className="sr-only">Loading {workspaceLabels[workspace]}…</span>
    <header className="route-loading-topbar"><span className="route-loading-logo"/><span className="route-loading-search"/><span className="route-loading-account"/></header>
    <aside className="route-loading-sidebar"><span className="route-loading-workspace"/>{Array.from({ length: workspace === "recruiter" ? 8 : 6 }, (_, index) => <span className="route-loading-nav" key={index}/>)}</aside>
    <section className="route-loading-content"><span className="route-loading-eyebrow"/><span className="route-loading-title"/><span className="route-loading-copy"/><div className="route-loading-grid">{Array.from({ length: 4 }, (_, index) => <article key={index}><span/><span/><span/></article>)}</div><div className="route-loading-panel"><span/><span/><span/><span/></div></section>
  </main>;
}

export function PublicRouteLoading({ label = "Sapienworx" }: { label?: string }) {
  return <main className="public-route-loading" role="status" aria-live="polite" aria-label={`Loading ${label}`} aria-busy="true">
    <span className="sr-only">Loading {label}…</span>
    <header><span className="route-loading-logo"/><span className="public-loading-links"/><span className="route-loading-account"/></header>
    <section><span className="route-loading-eyebrow"/><span className="public-loading-title"/><span className="public-loading-copy"/><div className="public-loading-actions"><span/><span/></div></section>
  </main>;
}
