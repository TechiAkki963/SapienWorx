"use client";

import { useMemo, useState } from "react";
import { Badge, Button, Meter, SectionTitle, WorkspaceShell } from "./ui";
import { downloadCandidateProfilePdf } from "../lib/profile-pdf";
import { useCandidateDomain } from "./candidate-domain";

type WorkLink = { label: string; value: string; icon: string };
type Skill = { name: string; rating: number };
type Contribution = { title: string; detail: string };

const techLinks: WorkLink[] = [
  { label: "GitHub", value: "github.com/jordan-patel", icon: "⌘" },
  { label: "LeetCode", value: "leetcode.com/jordan-patel", icon: "⌁" },
  { label: "HackerRank", value: "hackerrank.com/jordan-patel", icon: "H" },
  { label: "CodeChef", value: "codechef.com/users/jordan_p", icon: "◈" },
];

const businessLinks: WorkLink[] = [
  { label: "Behance", value: "behance.net/amara-mensah", icon: "B" },
  { label: "Dribbble", value: "dribbble.com/amara-mensah", icon: "◌" },
  { label: "Portfolio", value: "amaramensah.design", icon: "↗" },
  { label: "Substack", value: "amara-mensah.substack.com", icon: "S" },
];

const techSkills: Skill[] = [
  { name: "Java", rating: 5 }, { name: "TypeScript", rating: 4 }, { name: "SQL", rating: 4 },
  { name: "Spring Boot", rating: 5 }, { name: "Next.js", rating: 4 }, { name: "React", rating: 4 },
  { name: "AWS", rating: 4 }, { name: "Docker", rating: 5 }, { name: "Kubernetes", rating: 3 },
];

const businessSkills: Skill[] = [
  { name: "Product strategy", rating: 5 }, { name: "Figma", rating: 5 }, { name: "User research", rating: 4 },
  { name: "Design systems", rating: 4 }, { name: "Go-to-market", rating: 4 }, { name: "Accessibility", rating: 3 },
];

const techStackGroups = [
  { label: "Languages", names: ["Java", "TypeScript", "SQL"] },
  { label: "Frameworks", names: ["Spring Boot", "Next.js", "React"] },
  { label: "Infrastructure", names: ["AWS", "Docker", "Kubernetes"] },
];

const techContributions: Contribution[] = [
  { title: "Architecture & scale", detail: "Designed an event-driven hiring workflow that supports 50k candidate updates per day with 99.95% availability." },
  { title: "Open-source contribution", detail: "Maintainer of an internal design-system migration toolkit, adopted by 12 product squads." },
];

const businessContributions: Contribution[] = [
  { title: "Revenue impact", detail: "Improved self-serve conversion by 32% through a new onboarding and pricing experiment." },
  { title: "Team leadership", detail: "Built and mentored a cross-functional product design practice across three delivery squads." },
];

const techCertificates = [
  ["AWS", "AWS Certified Solutions Architect", "Amazon Web Services · Issued 2024", "Credential ID: AWS-89274"],
  ["SB", "Spring Professional", "VMware · Issued 2023", "Credential ID: SPR-41389"],
];

const businessCertificates = [
  ["GA", "Google Analytics Certification", "Google · Issued 2024", "Expires May 2027"],
  ["PMP", "Project Management Professional", "PMI · Issued 2023", "Credential ID: PMP-23918"],
  ["HS", "HubSpot Content Marketing", "HubSpot Academy · Issued 2024", "Credential ID: HSB-60271"],
];

export function CandidateProfile() {
  const { domainCategory } = useCandidateDomain();
  const isTech = domainCategory === "TECH";
  const profile = isTech
    ? { initials: "JP", name: "Jordan Patel", headline: "Senior Backend Engineer", location: "Bengaluru, India", overallExperience: "7 years", relevantExperience: "6 years", completion: 86 }
    : { initials: "AM", name: "Amara Mensah", headline: "Senior Product Designer", location: "London, United Kingdom", overallExperience: "6 years", relevantExperience: "5 years", completion: 82 };
  const initialLinks = isTech ? techLinks : businessLinks;
  const initialSkills = isTech ? techSkills : businessSkills;
  const [profileImage, setProfileImage] = useState("");
  const [saved, setSaved] = useState(false);
  const [links, setLinks] = useState<WorkLink[]>(initialLinks);
  const [skills, setSkills] = useState<Skill[]>(initialSkills);
  const [contributions, setContributions] = useState<Contribution[]>(isTech ? techContributions : businessContributions);
  const [newLink, setNewLink] = useState({ label: "", value: "" });
  const [newSkill, setNewSkill] = useState({ name: "", rating: 3 });
  const [newContribution, setNewContribution] = useState({ title: "", detail: "" });
  const [showLinkForm, setShowLinkForm] = useState(false);
  const [showSkillForm, setShowSkillForm] = useState(false);
  const [showContributionForm, setShowContributionForm] = useState(false);
  const [noticePeriod, setNoticePeriod] = useState("30 days");
  const [profileVisible, setProfileVisible] = useState(true);

  const stackGroups = useMemo(() => techStackGroups.map((group) => ({
    ...group,
    skills: group.names.map((name) => skills.find((skill) => skill.name === name)).filter((skill): skill is Skill => Boolean(skill)),
  })), [skills]);
  const additionalTechSkills = skills.filter((skill) => !techStackGroups.some((group) => group.names.includes(skill.name)));

  function addLink() {
    if (!newLink.label.trim() || !newLink.value.trim()) return;
    setLinks([...links, { ...newLink, icon: "↗" }]);
    setNewLink({ label: "", value: "" });
    setShowLinkForm(false);
  }
  function addSkill() {
    if (!newSkill.name.trim()) return;
    setSkills([...skills, { ...newSkill }]);
    setNewSkill({ name: "", rating: 3 });
    setShowSkillForm(false);
  }
  function addContribution() {
    if (!newContribution.title.trim() || !newContribution.detail.trim()) return;
    setContributions([...contributions, newContribution]);
    setNewContribution({ title: "", detail: "" });
    setShowContributionForm(false);
  }
  function changeRating(name: string, rating: number) {
    setSkills(skills.map((skill) => skill.name === name ? { ...skill, rating } : skill));
  }
  function addProfileImage(file?: File) {
    if (file) setProfileImage(URL.createObjectURL(file));
  }
  function downloadProfile() {
    downloadCandidateProfilePdf({
      name: profile.name,
      headline: profile.headline,
      location: profile.location,
      email: isTech ? "jo••••@email.com" : "am••••@email.com",
      phone: isTech ? "+91 •••• 214 902" : "+44 •••• 900 112",
      noticePeriod,
      overallExperience: profile.overallExperience,
      relevantExperience: profile.relevantExperience,
      skills,
      links,
    });
  }

  const contributionTitle = isTech ? "Architecture & code contributions" : "Impact metrics & KPIs";
  const contributionCopy = isTech
    ? "Show recruiters the systems you designed, meaningful open-source work, and measurable scale outcomes."
    : "Make your strategic impact easy to scan with business outcomes, managed budgets, and team scope.";

  return <WorkspaceShell workspace="candidate" active="profile" title="Your professional profile" description="The details recruiters see only when you choose to apply or share your profile." actions={<div className="profile-heading-actions"><Button onClick={() => setSaved(true)}>{saved ? "Changes saved" : "Save changes"}</Button><button className="profile-download-button" type="button" onClick={downloadProfile} aria-label="Download profile as PDF" title="Download profile as PDF">⇩</button></div>}>
    {saved && <div className="creation-success">Your profile has been updated. Recruiters only see the information available on a role you apply to.</div>}
    <section className="profile-hero panel"><label className="profile-image-upload">{profileImage ? <img src={profileImage} alt="Your profile" /> : <span>{profile.initials}</span>}<input type="file" accept="image/*" onChange={(event) => addProfileImage(event.target.files?.[0])} /><b>Change</b></label><div><h2>{profile.name} <Badge tone={isTech ? "blue" : "purple"}>{isTech ? "Engineering & Tech" : "Business & Non-Tech"}</Badge></h2><p>{profile.headline} · {profile.location}</p><div className="profile-hero-meta"><span>{profile.overallExperience} overall experience</span><span>{profile.relevantExperience} relevant experience</span><span>Open to hybrid roles</span></div></div><div className="profile-completion"><strong>{profile.completion}%</strong><span>Profile complete</span><Meter value={profile.completion} /></div></section>
    <div className="profile-layout profile-layout-expanded"><div className="stack">
      <section className="panel"><SectionTitle eyebrow="Personal information" title="How recruiters identify you" action={<Button variant="quiet">Edit</Button>} /><div className="profile-detail-grid"><Detail label="Full name" value={profile.name} /><Detail label="Professional headline" value={profile.headline} /><Detail label="Email address" value={isTech ? "jo••••@email.com" : "am••••@email.com"} privateDetail /><Detail label="Contact number" value={isTech ? "+91 •••• 214 902" : "+44 •••• 900 112"} privateDetail /><Detail label="Current location" value={profile.location} /><label className="profile-select"><span>Notice period</span><select value={noticePeriod} onChange={(event) => setNoticePeriod(event.target.value)}><option>Immediately available</option><option>15 days</option><option>30 days</option><option>60 days</option><option>90 days</option></select></label></div><div className="profile-privacy-controls"><label className="profile-visibility-control"><input type="checkbox" checked={profileVisible} onChange={(event) => setProfileVisible(event.target.checked)} /><span><b>Profile visibility</b><small>{profileVisible ? "Available to recruiters only for roles you apply to or explicitly share." : "Hidden from recruiter searches until you choose to share it."}</small></span></label><p className="profile-private-note">Email and mobile stay masked and are never displayed publicly.</p></div></section>
      {!isTech && <CertificateSection certificates={businessCertificates} eyebrow="Industry credentials" title="Business certifications" prominent />}
      <section className="panel"><SectionTitle eyebrow="Experience" title="Work history" action={<Button variant="quiet">+ Add experience</Button>} /><div className="experience-summary"><div><strong>{profile.overallExperience}</strong><span>Overall experience</span></div><div><strong>{profile.relevantExperience}</strong><span>Relevant experience</span></div><div><strong>{noticePeriod}</strong><span>Notice period</span></div></div><div className="profile-timeline">{isTech ? <><Timeline role="Senior Backend Engineer" company="Nexora Cloud" start="March 2022" end="Present" copy="Leading services for a high-volume recruitment platform, owning API performance, observability, and infrastructure reliability." /><Timeline role="Software Engineer" company="Vertex Systems" start="July 2019" end="February 2022" copy="Built Java and TypeScript workflows for enterprise teams, collaborating across product, data, and security." /></> : <><Timeline role="Senior Product Designer" company="Northstar Labs" start="January 2022" end="Present" copy="Leading end-to-end design for an analytics platform used by more than 20,000 customers. Own research, product strategy and the core design system." /><Timeline role="Product Designer" company="Halcyon Studio" start="June 2019" end="December 2021" copy="Designed B2B workflows and a scalable interface library for enterprise teams, partnering with product managers and engineers." /></>}</div></section>
      <section className="panel domain-impact-panel"><SectionTitle eyebrow={isTech ? "Technical impact" : "Business impact"} title={contributionTitle} action={<Button variant="quiet" onClick={() => setShowContributionForm(!showContributionForm)}>{showContributionForm ? "Cancel" : isTech ? "+ Add contribution" : "+ Add impact"}</Button>} /><p className="section-helper">{contributionCopy}</p>{!isTech && <div className="impact-metric-grid"><Metric value="+32%" label="Conversion lift" /><Metric value="£1.8m" label="Budget influenced" /><Metric value="3 squads" label="Team scope" /></div>}{showContributionForm && <div className="inline-add-form contribution-add"><input value={newContribution.title} onChange={(event) => setNewContribution({ ...newContribution, title: event.target.value })} placeholder={isTech ? "e.g. Platform architecture" : "e.g. Revenue growth"} /><input value={newContribution.detail} onChange={(event) => setNewContribution({ ...newContribution, detail: event.target.value })} placeholder="Describe the measurable outcome" /><Button onClick={addContribution}>Add</Button></div>}<div className="contribution-list">{contributions.map((contribution) => <article key={`${contribution.title}-${contribution.detail}`}><span>{isTech ? "</>" : "↗"}</span><div><strong>{contribution.title}</strong><p>{contribution.detail}</p></div></article>)}</div></section>
      <section className="panel"><SectionTitle eyebrow="Education" title="Academic background" action={<Button variant="quiet">+ Add education</Button>} /><div className="education-table"><div className="education-head"><span>College / University</span><span>Course</span><span>Year</span><span>Grade</span></div>{isTech ? <><div><strong>Indian Institute of Technology Delhi</strong><span>B.Tech, Computer Science</span><span>2015 – 2019</span><span>8.7 CGPA</span></div><div><strong>Delhi Public School</strong><span>Senior secondary</span><span>2013 – 2015</span><span>92%</span></div></> : <><div><strong>University of the Arts London</strong><span>BA Interaction Design</span><span>2016 – 2019</span><span>First class</span></div><div><strong>Harris Academy</strong><span>A-levels, Art &amp; Design</span><span>2014 – 2016</span><span>AAB</span></div></>}</div></section>
      {isTech && <CertificateSection certificates={techCertificates} eyebrow="Credentials" title="Technical certifications" />}
    </div>
    <aside className="stack">
      <section className="panel domain-work-links"><SectionTitle eyebrow={isTech ? "Coding footprint" : "Visual portfolio"} title={isTech ? "Coding work links" : "Portfolio & work links"} action={<Button variant="quiet" onClick={() => setShowLinkForm(!showLinkForm)}>+ Add link</Button>} /><p className="section-helper">{isTech ? "Share verified coding profiles that help recruiters understand your engineering practice." : "Put your visual work, writing, and personal portfolio at the top of your profile."}</p>{showLinkForm && <div className="inline-add-form"><input value={newLink.label} onChange={(event) => setNewLink({ ...newLink, label: event.target.value })} placeholder={isTech ? "e.g. GitHub" : "e.g. Behance"} /><input value={newLink.value} onChange={(event) => setNewLink({ ...newLink, value: event.target.value })} placeholder="Paste the link" /><Button onClick={addLink}>Add</Button></div>}<div className="link-list">{links.map((link) => <a href={`https://${link.value.replace(/^https?:\/\//, "")}`} target="_blank" rel="noreferrer" key={`${link.label}-${link.value}`}><span>{link.icon}</span><div><strong>{link.label}</strong><small>{link.value}</small></div><b>↗</b></a>)}</div></section>
      {isTech ? <section className="panel"><SectionTitle eyebrow="Technical expertise" title="Tech stack matrix" action={<Button variant="quiet" onClick={() => setShowSkillForm(!showSkillForm)}>+ Add skill</Button>} /><p className="section-helper">Rate the languages, frameworks, and infrastructure tools you use in production.</p>{showSkillForm && <SkillAddForm newSkill={newSkill} setNewSkill={setNewSkill} onAdd={addSkill} tech />}<div className="tech-stack-matrix">{stackGroups.map((group) => <section className="tech-stack-group" key={group.label}><h3>{group.label}</h3><div>{group.skills.map((skill) => <SkillRating skill={skill} onChange={changeRating} key={skill.name} />)}</div></section>)}{additionalTechSkills.length > 0 && <section className="tech-stack-group"><h3>Additional tools</h3><div>{additionalTechSkills.map((skill) => <SkillRating skill={skill} onChange={changeRating} key={skill.name} />)}</div></section>}</div></section> : <section className="panel"><SectionTitle eyebrow="Strategic expertise" title="Skills &amp; ratings" action={<Button variant="quiet" onClick={() => setShowSkillForm(!showSkillForm)}>+ Add skill</Button>} /><p className="section-helper">Rate the competencies that define your strategic and creative practice.</p>{showSkillForm && <SkillAddForm newSkill={newSkill} setNewSkill={setNewSkill} onAdd={addSkill} />}<div className="skill-ratings">{skills.map((skill) => <SkillRating skill={skill} onChange={changeRating} key={skill.name} />)}</div></section>}
    </aside></div>
  </WorkspaceShell>;
}

function CertificateSection({ certificates, eyebrow, title, prominent = false }: { certificates: string[][]; eyebrow: string; title: string; prominent?: boolean }) {
  return <section className={prominent ? "panel industry-credentials" : "panel"}><SectionTitle eyebrow={eyebrow} title={title} action={<Button variant="quiet">+ Add certificate</Button>} /><div className={prominent ? "certificate-grid certificate-grid-prominent" : "certificate-grid"}>{certificates.map(([mark, certificate, issuer, detail]) => <article key={certificate}><span>{mark}</span><div><strong>{certificate}</strong><p>{issuer}</p><small>{detail}</small></div><b>✓</b></article>)}</div></section>;
}

function SkillAddForm({ newSkill, setNewSkill, onAdd, tech = false }: { newSkill: { name: string; rating: number }; setNewSkill: (value: { name: string; rating: number }) => void; onAdd: () => void; tech?: boolean }) {
  return <div className="inline-add-form skill-add"><input list={tech ? "tech-skill-options" : "business-skill-options"} value={newSkill.name} onChange={(event) => setNewSkill({ ...newSkill, name: event.target.value })} placeholder="Select or add a skill" /><datalist id={tech ? "tech-skill-options" : "business-skill-options"}>{(tech ? ["Python", "Go", "Terraform", "Azure", "GCP"] : ["P&L management", "B2B SaaS", "Stakeholder management", "Agile Scrum"]).map((option) => <option value={option} key={option} />)}</datalist><select value={newSkill.rating} onChange={(event) => setNewSkill({ ...newSkill, rating: Number(event.target.value) })}>{[1, 2, 3, 4, 5].map((rating) => <option value={rating} key={rating}>{rating} / 5</option>)}</select><Button onClick={onAdd}>Add</Button></div>;
}

function SkillRating({ skill, onChange }: { skill: Skill; onChange: (name: string, rating: number) => void }) {
  return <div className="skill-rating"><span>{skill.name}</span><div role="group" aria-label={`${skill.name} rating`}>{[1, 2, 3, 4, 5].map((rating) => <button type="button" className={rating <= skill.rating ? "active" : ""} onClick={() => onChange(skill.name, rating)} key={rating} aria-label={`Set ${skill.name} to ${rating} out of 5`}>★</button>)}</div><small>{skill.rating}/5</small></div>;
}

function Detail({ label, value, privateDetail = false }: { label: string; value: string; privateDetail?: boolean }) {
  return <div className="profile-detail"><span>{label} {privateDetail && <em>Private</em>}</span><strong>{value}</strong></div>;
}

function Timeline({ role, company, start, end, copy }: { role: string; company: string; start: string; end: string; copy: string }) {
  return <article><span className="timeline-dot" /><div><strong>{role}</strong><p>{company} · {start} – {end}</p><small>{copy}</small></div></article>;
}

function Metric({ value, label }: { value: string; label: string }) {
  return <div><strong>{value}</strong><span>{label}</span></div>;
}
