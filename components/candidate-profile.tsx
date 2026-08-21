"use client";

import { useState } from "react";
import { useCandidateDomain } from "./candidate-domain";
import { Badge, Button, Meter, SectionTitle, WorkspaceShell } from "./ui";
import { downloadCandidateProfilePdf } from "../lib/profile-pdf";

type WorkLink = { label: string; value: string; icon: string };
type Skill = { name: string; rating: number };

const initialLinks: WorkLink[] = [
  { label: "GitHub", value: "github.com/amara-mensah", icon: "⌘" },
  { label: "LeetCode", value: "leetcode.com/amara-mensah", icon: "⌁" },
  { label: "CodeChef", value: "codechef.com/users/amara_m", icon: "◈" },
  { label: "Dribbble", value: "dribbble.com/amara-mensah", icon: "◌" },
];

const initialSkills: Skill[] = [
  { name: "Product strategy", rating: 5 }, { name: "Figma", rating: 5 }, { name: "User research", rating: 4 }, { name: "Design systems", rating: 4 }, { name: "Prototyping", rating: 4 }, { name: "Accessibility", rating: 3 },
];

export function CandidateProfile() {
  const { domainCategory } = useCandidateDomain();
  const [profileImage, setProfileImage] = useState("");
  const [saved, setSaved] = useState(false);
  const [links, setLinks] = useState<WorkLink[]>(initialLinks);
  const [skills, setSkills] = useState<Skill[]>(initialSkills);
  const [newLink, setNewLink] = useState({ label: "", value: "" });
  const [newSkill, setNewSkill] = useState({ name: "", rating: 3 });
  const [showLinkForm, setShowLinkForm] = useState(false);
  const [showSkillForm, setShowSkillForm] = useState(false);
  const [noticePeriod, setNoticePeriod] = useState("30 days");
  const [githubUrl, setGithubUrl] = useState("");
  const [programmingLanguage, setProgrammingLanguage] = useState("");
  const [programmingLanguages, setProgrammingLanguages] = useState<string[]>([]);
  const [portfolioUrl, setPortfolioUrl] = useState("");
  const [coreCompetency, setCoreCompetency] = useState("");
  const [coreCompetencies, setCoreCompetencies] = useState<string[]>([]);

  function addLink() { if (!newLink.label.trim() || !newLink.value.trim()) return; setLinks([...links, { ...newLink, icon: "↗" }]); setNewLink({ label: "", value: "" }); setShowLinkForm(false); }
  function addSkill() { if (!newSkill.name.trim()) return; setSkills([...skills, { ...newSkill }]); setNewSkill({ name: "", rating: 3 }); setShowSkillForm(false); }
  function changeRating(name: string, rating: number) { setSkills(skills.map((skill) => skill.name === name ? { ...skill, rating } : skill)); }
  function addProfileImage(file?: File) { if (!file) return; setProfileImage(URL.createObjectURL(file)); }
  function addProgrammingLanguage() { const value = programmingLanguage.trim(); if (!value || programmingLanguages.includes(value)) return; setProgrammingLanguages([...programmingLanguages, value]); setProgrammingLanguage(""); }
  function addCoreCompetency() { const value = coreCompetency.trim(); if (!value || coreCompetencies.includes(value)) return; setCoreCompetencies([...coreCompetencies, value]); setCoreCompetency(""); }
  function downloadProfile() { downloadCandidateProfilePdf({ name: "Amara Mensah", headline: "Senior Product Designer", location: "London, United Kingdom", email: "amara.mensah@email.com", phone: "+44 7700 900 112", noticePeriod, overallExperience: "6 years", relevantExperience: "5 years", skills, links }); }

  return <WorkspaceShell workspace="candidate" active="profile" title="Your professional profile" description="The details recruiters see only when you choose to apply or share your profile." actions={<div className="profile-heading-actions"><Button onClick={() => setSaved(true)}>{saved ? "Changes saved" : "Save changes"}</Button><button className="profile-download-button" type="button" onClick={downloadProfile} aria-label="Download profile as PDF" title="Download profile as PDF">⇩</button></div>}>
    {saved && <div className="creation-success">Your profile has been updated. Recruiters only see the information available on a role you apply to.</div>}
    <section className="profile-hero panel"><label className="profile-image-upload">{profileImage ? <img src={profileImage} alt="Your profile"/> : <span>AM</span>}<input type="file" accept="image/*" onChange={(event) => addProfileImage(event.target.files?.[0])}/><b>Change</b></label><div><h2>Amara Mensah <Badge tone="green">Profile visible</Badge></h2><p>Senior Product Designer · London, United Kingdom</p><div className="profile-hero-meta"><span>6 years overall experience</span><span>5 years relevant experience</span><span>Open to hybrid roles</span></div></div><div className="profile-completion"><strong>82%</strong><span>Profile complete</span><Meter value={82}/></div></section>
    <div className="profile-layout profile-layout-expanded"><div className="stack">
      <section className="panel"><SectionTitle eyebrow="Personal information" title="How recruiters identify you" action={<Button variant="quiet">Edit</Button>}/><div className="profile-detail-grid"><Detail label="Full name" value="Amara Mensah"/><Detail label="Professional headline" value="Senior Product Designer"/><Detail label="Email address" value="am••••@email.com" privateDetail/><Detail label="Contact number" value="+44 •••• 900 112" privateDetail/><Detail label="Current location" value="London, United Kingdom"/><label className="profile-select"><span>Notice period</span><select value={noticePeriod} onChange={(event) => setNoticePeriod(event.target.value)}><option>Immediately available</option><option>15 days</option><option>30 days</option><option>60 days</option><option>90 days</option></select></label></div><p className="profile-private-note">Email and mobile are masked here and are never displayed publicly.</p></section>
      <section className="panel"><SectionTitle eyebrow="Experience" title="Work history" action={<Button variant="quiet">+ Add experience</Button>}/><div className="experience-summary"><div><strong>6 years</strong><span>Overall experience</span></div><div><strong>5 years</strong><span>Relevant experience</span></div><div><strong>{noticePeriod}</strong><span>Notice period</span></div></div><div className="profile-timeline"><Timeline role="Senior Product Designer" company="Northstar Labs" start="January 2022" end="Present" copy="Leading end-to-end design for an analytics platform used by more than 20,000 customers. Own research, product strategy and the core design system."/><Timeline role="Product Designer" company="Halcyon Studio" start="June 2019" end="December 2021" copy="Designed B2B workflows and a scalable interface library for enterprise teams, partnering with product managers and engineers."/></div></section>
      <section className="panel"><SectionTitle eyebrow="Education" title="Academic background" action={<Button variant="quiet">+ Add education</Button>}/><div className="education-table"><div className="education-head"><span>College / University</span><span>Course</span><span>Year</span><span>Grade</span></div><div><strong>University of the Arts London</strong><span>BA Interaction Design</span><span>2016 – 2019</span><span>First class</span></div><div><strong>Harris Academy</strong><span>A-levels, Art &amp; Design</span><span>2014 – 2016</span><span>AAB</span></div></div></section>
      <section className="panel"><SectionTitle eyebrow="Credentials" title="Certifications" action={<Button variant="quiet">+ Add certificate</Button>}/><div className="certificate-grid"><article><span>IxDF</span><div><strong>UX Management</strong><p>Interaction Design Foundation · Issued 2023</p><small>Credential ID: UX-23918</small></div><b>✓</b></article><article><span>GA</span><div><strong>Google Analytics Certification</strong><p>Google · Issued 2024</p><small>Expires May 2027</small></div><b>✓</b></article></div></section>
    </div>
    <aside className="stack">
      {domainCategory === "TECH" && <section className="panel domain-profile-fields"><SectionTitle eyebrow="Technical focus" title="Developer profile"/><p className="section-helper">These fields help us surface roles that fit your technical work.</p><label className="domain-profile-input"><span>GitHub URL</span><input value={githubUrl} onChange={(event) => setGithubUrl(event.target.value)} placeholder="github.com/your-handle"/></label><label className="domain-profile-input"><span>Programming languages</span><div><input value={programmingLanguage} onChange={(event) => setProgrammingLanguage(event.target.value)} onKeyDown={(event) => { if (event.key === "Enter") { event.preventDefault(); addProgrammingLanguage(); } }} placeholder="e.g. TypeScript"/><Button variant="secondary" onClick={addProgrammingLanguage}>Add</Button></div></label>{programmingLanguages.length > 0 && <div className="domain-profile-tags">{programmingLanguages.map((language) => <button type="button" key={language} onClick={() => setProgrammingLanguages(programmingLanguages.filter((item) => item !== language))}>{language} <span aria-label={`Remove ${language}`}>×</span></button>)}</div>}</section>}
      {domainCategory === "NON_TECH" && <section className="panel domain-profile-fields"><SectionTitle eyebrow="Business focus" title="Professional portfolio"/><p className="section-helper">These fields help us recommend roles that value your strategic strengths.</p><label className="domain-profile-input"><span>Portfolio link</span><input value={portfolioUrl} onChange={(event) => setPortfolioUrl(event.target.value)} placeholder="yourportfolio.com"/></label><label className="domain-profile-input"><span>Core competencies</span><div><input value={coreCompetency} onChange={(event) => setCoreCompetency(event.target.value)} onKeyDown={(event) => { if (event.key === "Enter") { event.preventDefault(); addCoreCompetency(); } }} placeholder="e.g. Product strategy"/><Button variant="secondary" onClick={addCoreCompetency}>Add</Button></div></label>{coreCompetencies.length > 0 && <div className="domain-profile-tags">{coreCompetencies.map((competency) => <button type="button" key={competency} onClick={() => setCoreCompetencies(coreCompetencies.filter((item) => item !== competency))}>{competency} <span aria-label={`Remove ${competency}`}>×</span></button>)}</div>}</section>}
      <section className="panel"><SectionTitle eyebrow="Your work" title="Projects &amp; work links" action={<Button variant="quiet" onClick={() => setShowLinkForm(!showLinkForm)}>+ Add link</Button>}/><p className="section-helper">Add GitHub, LeetCode, CodeChef, Dribbble, portfolio or any platform. You choose the label.</p>{showLinkForm && <div className="inline-add-form"><input value={newLink.label} onChange={(event) => setNewLink({ ...newLink, label: event.target.value })} placeholder="Platform name"/><input value={newLink.value} onChange={(event) => setNewLink({ ...newLink, value: event.target.value })} placeholder="Paste the link"/><Button onClick={addLink}>Add</Button></div>}<div className="link-list">{links.map((link) => <a href={`https://${link.value.replace(/^https?:\/\//, "")}`} target="_blank" rel="noreferrer" key={`${link.label}-${link.value}`}><span>{link.icon}</span><div><strong>{link.label}</strong><small>{link.value}</small></div><b>↗</b></a>)}</div></section>
      <section className="panel"><SectionTitle eyebrow="Expertise" title="Skills &amp; ratings" action={<Button variant="quiet" onClick={() => setShowSkillForm(!showSkillForm)}>+ Add skill</Button>}/><p className="section-helper">Rate how confidently you use each skill. These ratings help us match relevant roles.</p>{showSkillForm && <div className="inline-add-form skill-add"><input list="skill-options" value={newSkill.name} onChange={(event) => setNewSkill({ ...newSkill, name: event.target.value })} placeholder="Select or add a skill"/><datalist id="skill-options"><option value="Product strategy"/><option value="Figma"/><option value="User research"/><option value="HTML / CSS"/><option value="Data analysis"/></datalist><select value={newSkill.rating} onChange={(event) => setNewSkill({ ...newSkill, rating: Number(event.target.value) })}>{[1, 2, 3, 4, 5].map((rating) => <option value={rating} key={rating}>{rating} / 5</option>)}</select><Button onClick={addSkill}>Add</Button></div>}<div className="skill-ratings">{skills.map((skill) => <div className="skill-rating" key={skill.name}><span>{skill.name}</span><div role="group" aria-label={`${skill.name} rating`}>{[1, 2, 3, 4, 5].map((rating) => <button className={rating <= skill.rating ? "active" : ""} onClick={() => changeRating(skill.name, rating)} key={rating} aria-label={`Set ${skill.name} to ${rating} out of 5`}>★</button>)}</div><small>{skill.rating}/5</small></div>)}</div></section>
    </aside></div>
  </WorkspaceShell>;
}

function Detail({ label, value, privateDetail = false }: { label: string; value: string; privateDetail?: boolean }) { return <div className="profile-detail"><span>{label} {privateDetail && <em>Private</em>}</span><strong>{value}</strong></div>; }
function Timeline({ role, company, start, end, copy }: { role: string; company: string; start: string; end: string; copy: string }) { return <article><span className="timeline-dot"/><div><strong>{role}</strong><p>{company} · {start} – {end}</p><small>{copy}</small></div></article>; }
