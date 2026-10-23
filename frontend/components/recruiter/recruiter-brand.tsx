/* Approved supplied artwork stays scoped to the recruiter shell. */
/* eslint-disable @next/next/no-img-element */
export function RecruiterBrand({ collapsed = false }: { collapsed?: boolean }) {
    return <span className="swx-recruiter-sidebar-brand" aria-hidden="true">
      {collapsed
        ? <img src="/brand/recruiter/android-chrome-192x192.png" width={192} height={192} alt="" className="swx-recruiter-brand-icon" />
        : <img src="/brand/recruiter/logo-wordmark-white.png" width={1322} height={306} alt="" className="swx-recruiter-brand-wordmark" />}
    </span>;
}
