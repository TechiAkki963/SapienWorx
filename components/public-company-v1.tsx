import Link from "next/link";
import { JobCard, PublicNavigation, type PublicJob } from "./public-site";

export function PublicCompanyV1({ slug, jobs }: { slug: string; jobs: PublicJob[] }) {
  const companyJobs = jobs.filter((job) => job.companySlug === slug);
  const company = companyJobs[0]?.company ?? slug.split("-").map((part) => part.charAt(0).toUpperCase()+part.slice(1)).join(" ");
  const mark = company.slice(0,2).toUpperCase();
  return <main className="public-page company-profile-v1">
    <PublicNavigation/>
    <section className="company-cover-band"><div className="public-container"><span className="company-cover-mark" aria-hidden="true">{mark}</span><div><span className="eyebrow">Employer profile</span><h1>{company}</h1><p>{companyJobs[0]?.verifiedEmployer ? "Verified employer on SapienWorx" : "Employer profile"}</p></div></div></section>
    <section className="public-section company-profile-layout">
      <div className="company-profile-main">
        <section className="company-profile-story"><span className="eyebrow">About the company</span><h2>Work, culture and opportunities</h2>{companyJobs.length ? <p>{company} is currently hiring through SapienWorx. Employer-authored culture details, workplace photos and testimonials will appear here when the organisation publishes them.</p> : <p>This employer has not published its culture story yet. The profile remains intentionally simple until verified employer content is available.</p>}</section>
        <section><header className="company-role-heading"><div><span className="eyebrow">Open roles</span><h2>{companyJobs.length ? `${companyJobs.length} current role${companyJobs.length===1?"":"s"}` : "No published roles"}</h2></div><Link href="/jobs">Browse all jobs →</Link></header>{companyJobs.length ? <div className="public-job-grid-list">{companyJobs.map((job)=><JobCard job={job} key={job.id}/>)}</div> : <div className="empty-state"><strong>No roles are published for this employer right now.</strong><p>Check back later or browse other verified opportunities.</p></div>}</section>
      </div>
      <aside className="company-profile-aside"><strong>Employer information</strong><dl><div><dt>Profile</dt><dd>{companyJobs.length ? "Active" : "Basic"}</dd></div><div><dt>Open roles</dt><dd>{companyJobs.length}</dd></div><div><dt>Verification</dt><dd>{companyJobs[0]?.verifiedEmployer ? "Verified" : "Not displayed"}</dd></div></dl><p>No culture statement, photography or testimonial is invented when the employer has not supplied it.</p></aside>
    </section>
  </main>;
}
