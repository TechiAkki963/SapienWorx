"use client";

import { useState } from "react";
import { Badge, Button, Meter, SectionTitle, WorkspaceShell } from "./ui";

const applications = [
  { company: "Northstar", role: "Product Designer", stage: "Interview", tone: "green" as const, mark: "N", style: "" },
  { company: "Tandem", role: "Senior UX Designer", stage: "Screening", tone: "blue" as const, mark: "T", style: "dark" },
  { company: "Morrow", role: "Product Designer", stage: "Applied", tone: "neutral" as const, mark: "M", style: "orange" },
];

const jobs = [
  { id: "northstar", company: "Northstar Labs", role: "Product Designer", location: "London · Hybrid", type: "Full-time", salary: "£62k – £76k", posted: "Posted 2d ago", logo: "N", color: "", match: "94% match" },
  { id: "cascade", company: "Cascade", role: "Senior Product Designer", location: "Remote · United Kingdom", type: "Full-time", salary: "£68k – £82k", posted: "Posted 3d ago", logo: "C", color: "blue", match: "91% match" },
  { id: "plume", company: "Plume Health", role: "Product Designer", location: "Manchester · Hybrid", type: "Permanent", salary: "£55k – £68k", posted: "Posted 5d ago", logo: "P", color: "orange", match: "88% match" },
];

export function CandidateDashboard() {
  return <WorkspaceShell workspace="candidate" active="dashboard" title="Good morning, Amara" description="Here’s a clear view of your career journey.">
    <section className="candidate-welcome">
      <h2>You're closer than you think.</h2>
      <p>Complete a few final details to make your profile stand out to the hiring teams you want to meet.</p>
      <Button href="/candidate/review" variant="secondary">Review your resume</Button>
    </section>
    <section className="candidate-steps" aria-label="Onboarding progress">
      <div className="candidate-step done"><strong>Account created</strong><small>Done</small></div>
      <div className="candidate-step done"><strong>Resume uploaded</strong><small>Done</small></div>
      <div className="candidate-step current"><strong>Review your details</strong><small>In progress</small></div>
      <div className="candidate-step"><strong>Start applying</strong><small>Next</small></div>
    </section>
    <div className="page-grid" style={{ marginTop: 25 }}>
      <div className="stack">
        <section className="panel">
          <SectionTitle eyebrow="Your profile" title="Profile strength" action={<Button href="/candidate/review" variant="quiet">Continue editing →</Button>} />
          <div className="completion-layout">
            <div className="completion-circle" aria-label="Profile completion: 68 percent" />
            <div>
              <strong style={{ fontSize: 14 }}>A strong profile gets more recruiter views.</strong>
              <p className="muted" style={{ margin: "4px 0 10px", fontSize: 12 }}>You have the essentials. Add your portfolio and job preferences next.</p>
              <Meter value={68} />
            </div>
          </div>
          <div className="action-list">
            <a className="action-link" href="/candidate/review"><b>1</b>Add portfolio and professional links <span style={{ marginLeft: "auto", color: "#2563eb" }}>→</span></a>
            <a className="action-link" href="/candidate/review"><b>2</b>Confirm parsed employment history <span style={{ marginLeft: "auto", color: "#2563eb" }}>→</span></a>
          </div>
        </section>
        <section className="panel">
          <SectionTitle eyebrow="Your activity" title="Applications" action={<Button href="/candidate/jobs" variant="quiet">Explore jobs →</Button>} />
          <div className="application-status">
            {applications.map((application) => <div className="application-row" key={application.company}>
              <span className={`company-mark ${application.style}`}>{application.mark}</span>
              <div><strong>{application.role}</strong><small>{application.company} · Updated today</small></div>
              <Badge tone={application.tone}>{application.stage}</Badge>
            </div>)}
          </div>
        </section>
      </div>
      <aside className="stack">
        <section className="panel live-updates-card">
          <SectionTitle eyebrow="Live updates" title="System notifications" />
          <div className="live-update"><span>●</span><div><strong>Northstar viewed your application</strong><small>Just now · Product Designer</small></div></div>
          <div className="live-update"><span>●</span><div><strong>Interview invitation received</strong><small>12 min ago · View your inbox</small></div></div>
          <p className="live-update-note">Updates appear here as your application status changes.</p>
        </section>
        <section className="panel">
          <SectionTitle eyebrow="Your resume" title="Ready for review" />
          <div className="resume-card">
            <div className="resume-card-top"><span className="file-mark">PDF</span><div><strong>Amara_Mensah_Resume.pdf</strong><p>Uploaded today · 284 KB</p></div></div>
            <div className="resume-card-bottom"><Badge tone="green">Parsed</Badge><a href="/candidate/review" className="button button-quiet">Review →</a></div>
          </div>
          <p className="muted" style={{ fontSize: 11, margin: "12px 0 0" }}>We extracted your details. Nothing becomes part of your profile until you confirm it.</p>
        </section>
        <section className="panel">
          <SectionTitle eyebrow="Recommended for you" title="Matches this week" />
          <div className="job-mini-list">
            {jobs.slice(0, 2).map((job) => <div className="job-mini" key={job.id}><span className="stripe"/><div><strong>{job.role}</strong><small>{job.company} · {job.location}</small></div><a href="/candidate/jobs" className="button button-quiet">View</a></div>)}
          </div>
        </section>
      </aside>
    </div>
  </WorkspaceShell>;
}

export function ResumeReview() {
  const [confirmed, setConfirmed] = useState(false);
  const [notice, setNotice] = useState("Your profile is unchanged until you confirm the information below.");
  return <WorkspaceShell workspace="candidate" active="resume" title="Review your resume" description="Confirm the details we found before adding them to your profile." actions={<Button href="/candidate" variant="secondary">Save and exit</Button>}>
    <div className="review-intro"><span>✦</span><div><b>{notice}</b>Field confidence is a guide only. Please check each item against your original resume.</div>{confirmed && <Badge tone="green">Profile updated</Badge>}</div>
    <section className="review-layout">
      <aside className="document-pane" aria-label="Original uploaded resume">
        <div className="document-toolbar"><span>Amara_Mensah_Resume.pdf</span><span>− &nbsp; 100% &nbsp; +</span></div>
        <article className="document-paper">
          <h2>Amara Mensah</h2><div className="document-contact">Product Designer · London, UK · amara.mensah@email.com</div>
          <h3>Profile</h3><p>Product designer with 6+ years creating intuitive digital experiences for people and growing teams. I bring strategic product thinking and detail-oriented interface design together.</p>
          <h3>Experience</h3><div className="document-job"><strong>Senior Product Designer · Northstar Labs</strong><p>Jan 2022 – Present · London, UK</p><p>Leading end-to-end experience design for an analytics platform used by 20,000+ customers.</p></div><div className="document-job"><strong>Product Designer · Halycon Studio</strong><p>Jun 2019 – Dec 2021 · London, UK</p></div>
          <h3>Education</h3><p><strong>BA Interaction Design</strong> · University of the Arts London · 2016 – 2019</p>
          <h3>Skills</h3><p>Product strategy · Figma · Prototyping · Research · Design systems</p>
        </article>
      </aside>
      <form className="review-form" onSubmit={(event) => { event.preventDefault(); setConfirmed(true); setNotice("Your confirmed details have been added to your profile."); }}>
        <header className="review-form-head"><div><h2>Extracted details</h2><p>Review, edit, accept or reject each section.</p></div><Badge tone="green">5 sections found</Badge></header>
        <div className="review-section"><div className="review-section-title"><h3>Personal information</h3><span className="confidence high">● High confidence</span></div><div className="review-fields"><Field label="Full name" defaultValue="Amara Mensah"/><Field label="Email" defaultValue="amara.mensah@email.com"/><Field label="Phone" defaultValue="+44 7700 900 112"/><Field label="Location" defaultValue="London, United Kingdom"/></div></div>
        <div className="review-section"><div className="review-section-title"><h3>Professional summary</h3><span className="confidence medium">● Review recommended</span></div><div className="review-fields"><Field label="Headline" defaultValue="Senior Product Designer" wide/><Field label="Summary" defaultValue="Product designer with 6+ years creating intuitive digital experiences for people and growing teams." multiline wide/></div></div>
        <div className="review-section"><div className="review-section-title"><h3>Most recent experience</h3><span className="confidence high">● High confidence</span></div><div className="review-fields"><Field label="Company" defaultValue="Northstar Labs"/><Field label="Role" defaultValue="Senior Product Designer"/><Field label="Start date" defaultValue="January 2022"/><Field label="End date" defaultValue="Present"/><Field label="What you did" defaultValue="Leading end-to-end experience design for an analytics platform used by 20,000+ customers." multiline wide/></div></div>
        <footer className="review-footer"><p>By confirming, you choose which parsed details become part of your Sapienworx profile.</p><div><Button href="/candidate" variant="secondary">Cancel</Button><Button type="submit">{confirmed ? "Confirmed" : "Confirm and update profile"}</Button></div></footer>
      </form>
    </section>
  </WorkspaceShell>;
}

function Field({ label, defaultValue, wide = false, multiline = false }: { label: string; defaultValue: string; wide?: boolean; multiline?: boolean }) {
  return <div className={`review-field ${wide ? "wide" : ""}`}><label>{label}</label>{multiline ? <textarea defaultValue={defaultValue} /> : <input defaultValue={defaultValue} />}</div>;
}

export function CandidateJobs() {
  const [saved, setSaved] = useState<string[]>([]);
  const [applied, setApplied] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const visibleJobs = jobs.filter((job) => `${job.role} ${job.company}`.toLowerCase().includes(query.toLowerCase()));
  return <WorkspaceShell workspace="candidate" active="jobs" title="Find work that fits" description="Roles selected around your experience, preferences and profile.">
    {applied && <div className="applied-banner">Your application for <strong>{jobs.find((job) => job.id === applied)?.role}</strong> has been registered. You can follow it from Applications.</div>}
    <section className="job-search-bar"><label className="input-with-icon"><span>⌕</span><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search by role, skill or company" /></label><select aria-label="Location"><option>United Kingdom</option><option>Remote</option><option>London</option></select><Button>Search jobs</Button></section>
    <section className="job-browser"><aside className="filters panel"><SectionTitle title="Filters" action={<Button variant="quiet">Clear</Button>} /><Filter title="Workplace" items={["Remote", "Hybrid", "On-site"]}/><Filter title="Employment type" items={["Full-time", "Permanent", "Contract"]}/><Filter title="Experience" items={["Mid level", "Senior", "Lead"]}/></aside><div><SectionTitle title={`${visibleJobs.length} roles for you`} action={<span className="muted" style={{ fontSize: 11 }}>Sorted by relevance</span>} /><div className="job-list">{visibleJobs.map((job) => <article className="job-card" key={job.id}><span className={`job-logo ${job.color}`}>{job.logo}</span><div><h3>{job.role}</h3><p>{job.company}</p><div className="job-meta"><span>{job.location}</span><span>{job.type}</span><span>{job.salary}</span><span>{job.posted}</span></div></div><div className="job-card-actions"><button aria-label={`Save ${job.role}`} onClick={() => setSaved((current) => current.includes(job.id) ? current.filter((id) => id !== job.id) : [...current, job.id])} className={`save-button ${saved.includes(job.id) ? "saved" : ""}`}>{saved.includes(job.id) ? "♥" : "♡"}</button>{applied === job.id ? <Badge tone="green">Applied</Badge> : <Button onClick={() => setApplied(job.id)}>Quick apply</Button>}<small className="positive">{job.match}</small></div></article>)}</div></div></section>
  </WorkspaceShell>;
}

function Filter({ title, items }: { title: string; items: string[] }) {
  return <div className="filter-group"><h3>{title}</h3>{items.map((item) => <label className="filter-check" key={item}><span><input type="checkbox" /> {item}</span><span> </span></label>)}</div>;
}
