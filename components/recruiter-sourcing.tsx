"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { apiClient } from "../lib/api-client";
import { defaultRecruiterSearch, keywordList, searchParamsFor, sourceRequest, stateFromSearchParams } from "../lib/recruiter-search";
import { Badge, Button, WorkspaceShell } from "./ui";

const keywordLimit = 500;
const sourcingSchema = z.object({
  anyKeywords: z.string().max(keywordLimit),
  allKeywords: z.string().max(keywordLimit),
  excludeKeywords: z.string().max(keywordLimit),
  booleanQuery: z.string().max(1000),
  minExperience: z.string(),
  maxExperience: z.string(),
  minSalary: z.string(),
  maxSalary: z.string(),
  company: z.string().max(160),
  designation: z.string().max(160),
  departmentRole: z.string().max(180),
  industry: z.string().max(180),
  location: z.string().max(160),
  ugMode: z.enum(["any", "specific", "none"]),
  qualification: z.string().max(180),
  institution: z.string().max(200),
  educationTypes: z.array(z.string()),
  gender: z.enum(["", "female", "male", "non-binary"]),
  requireGithub: z.boolean(),
  requireLeetcode: z.boolean(),
  requirePortfolio: z.boolean(),
  activeStatus: z.enum(["ONE_DAY", "THREE_DAYS", "SEVEN_DAYS", "FIFTEEN_DAYS", "THIRTY_DAYS", "SIXTY_DAYS", "NINETY_DAYS", "ONE_YEAR", "ALL"]),
});

type SourcingFormValues = z.infer<typeof sourcingSchema>;
type ApiCandidate = {
  candidateId: string;
  fullName: string;
  headline: string | null;
  location: string | null;
  overallExperienceYears: number | null;
  expectedSalaryLakhs: number | null;
  noticePeriodDays: number | null;
  skills: string;
  lastActiveAt: string | null;
  profileLastUpdatedAt: string | null;
  relevanceScore: number | null;
};
type ApiPage = { content: ApiCandidate[]; totalElements: number; totalPages: number; number: number };
type Candidate = {
  id: string;
  name: string;
  initials: string;
  role: string;
  location: string;
  experience: number;
  salary: string;
  education: string;
  skills: string[];
  activeDays: number;
  notice: string;
  source: "preview" | "live";
};

const previewCandidates: Candidate[] = [
  { id: "preview-1", name: "Amara Mensah", initials: "AM", role: "Senior Product Designer", location: "London · Hybrid", experience: 6, salary: "£72k", education: "M.Des", skills: ["Figma", "Design systems", "Research"], activeDays: 1, notice: "30 days", source: "preview" },
  { id: "preview-2", name: "Nia Okafor", initials: "NO", role: "Product Designer", location: "London · Remote", experience: 5, salary: "£64k", education: "B.Des", skills: ["Figma", "Prototyping", "B2B SaaS"], activeDays: 1, notice: "15 days", source: "preview" },
  { id: "preview-3", name: "Eleanor Chen", initials: "EC", role: "Senior Product Designer", location: "Manchester · Hybrid", experience: 7, salary: "£76k", education: "M.Des", skills: ["Design systems", "Accessibility", "Figma"], activeDays: 3, notice: "30 days", source: "preview" },
  { id: "preview-4", name: "Lina Patel", initials: "LP", role: "UX Designer", location: "Bristol · Remote", experience: 4, salary: "£58k", education: "B.Des", skills: ["User research", "Figma", "Workshops"], activeDays: 3, notice: "Immediate", source: "preview" },
  { id: "preview-5", name: "Aarav Mehta", initials: "AM", role: "Frontend Engineer", location: "London · Hybrid", experience: 6, salary: "£70k", education: "B.Tech", skills: ["React", "TypeScript", "GitHub"], activeDays: 7, notice: "60 days", source: "preview" },
  { id: "preview-6", name: "Sofia Martin", initials: "SM", role: "Senior UX Designer", location: "Leeds · Remote", experience: 8, salary: "£78k", education: "B.A.", skills: ["Accessibility", "Research", "Prototyping"], activeDays: 7, notice: "30 days", source: "preview" },
  { id: "preview-7", name: "David Okoro", initials: "DO", role: "Design Lead", location: "London · On-site", experience: 9, salary: "£88k", education: "M.Des", skills: ["Design systems", "Leadership", "Figma"], activeDays: 15, notice: "90 days", source: "preview" },
  { id: "preview-8", name: "Ivy Williams", initials: "IW", role: "Product Designer", location: "Birmingham · Hybrid", experience: 5, salary: "£63k", education: "B.Des", skills: ["Prototyping", "Research", "Mobile"], activeDays: 15, notice: "30 days", source: "preview" },
  { id: "preview-9", name: "Maya Singh", initials: "MS", role: "UX Researcher", location: "London · Hybrid", experience: 5, salary: "£66k", education: "M.A.", skills: ["Research", "Figma", "Analytics"], activeDays: 30, notice: "15 days", source: "preview" },
  { id: "preview-10", name: "Jon Bell", initials: "JB", role: "Product Designer", location: "Remote · UK", experience: 3, salary: "£50k", education: "B.Des", skills: ["Figma", "UI design", "HTML"], activeDays: 30, notice: "Immediate", source: "preview" },
  { id: "preview-11", name: "Priya Shah", initials: "PS", role: "Senior Product Designer", location: "London · Hybrid", experience: 7, salary: "£77k", education: "M.Des", skills: ["Figma", "Research", "Leadership"], activeDays: 45, notice: "30 days", source: "preview" },
  { id: "preview-12", name: "Chloe Grant", initials: "CG", role: "UX Researcher", location: "London · Remote", experience: 6, salary: "£70k", education: "M.Sc", skills: ["Research", "Analytics", "Workshops"], activeDays: 60, notice: "90 days", source: "preview" },
];

const companySuggestions = ["Nexora Technologies", "Northstar Studio", "Harbour & Co.", "Vertex Systems"];
const designationSuggestions = ["Senior Product Designer", "Product Designer", "UX Researcher", "Frontend Engineer", "Design Lead"];
const educationTypes = ["Full time", "Part time", "Correspondence"];
const numericOptions = Array.from({ length: 21 }, (_, value) => String(value));
const sourcingDefaultValues: SourcingFormValues = defaultRecruiterSearch;
const clearedSourcingValues: SourcingFormValues = { ...sourcingDefaultValues, allKeywords: "" };

function matchesTerms(candidate: Candidate, values: SourcingFormValues) {
  const source = `${candidate.name} ${candidate.role} ${candidate.location} ${candidate.skills.join(" ")}`.toLowerCase();
  const includes = (term: string) => source.includes(term.toLowerCase().replaceAll('"', "").trim());
  const any = keywordList(values.anyKeywords);
  const all = keywordList(values.allKeywords);
  const excluded = keywordList(values.excludeKeywords);
  const minExperience = values.minExperience ? Number(values.minExperience) : undefined;
  const maxExperience = values.maxExperience ? Number(values.maxExperience) : undefined;
  return (!any.length || any.some(includes))
    && all.every(includes)
    && !excluded.some(includes)
    && (!minExperience || candidate.experience >= minExperience)
    && (!maxExperience || candidate.experience <= maxExperience)
    && (!values.location || candidate.location.toLowerCase().includes(values.location.toLowerCase()))
    && (!values.designation || candidate.role.toLowerCase().includes(values.designation.toLowerCase()))
    && (values.ugMode !== "specific" || !values.qualification || candidate.education.toLowerCase().includes(values.qualification.toLowerCase()));
}

function mapApiCandidate(candidate: ApiCandidate): Candidate {
  const initials = candidate.fullName.split(/\s+/).map((part) => part[0]).join("").slice(0, 2).toUpperCase();
  return {
    id: candidate.candidateId,
    name: candidate.fullName,
    initials,
    role: candidate.headline || "Candidate",
    location: candidate.location || "Location not listed",
    experience: candidate.overallExperienceYears ?? 0,
    salary: candidate.expectedSalaryLakhs == null ? "Not shared" : `₹${candidate.expectedSalaryLakhs}L`,
    education: "Education available",
    skills: candidate.skills ? candidate.skills.split(", ").filter(Boolean) : [],
    activeDays: candidate.lastActiveAt ? Math.max(0, Math.round((Date.now() - Date.parse(candidate.lastActiveAt)) / 86_400_000)) : 365,
    notice: candidate.noticePeriodDays == null ? "Not shared" : `${candidate.noticePeriodDays} days`,
    source: "live",
  };
}

function Accordion({ title, helper, open, onToggle, children }: { title: string; helper: string; open: boolean; onToggle: () => void; children: React.ReactNode }) {
  return <section className="sourcing-accordion">
    <button className="sourcing-accordion-trigger" type="button" onClick={onToggle} aria-expanded={open}>
      <span><strong>{title}</strong><small>{helper}</small></span><span aria-hidden="true" className={open ? "sourcing-chevron open" : "sourcing-chevron"}>⌄</span>
    </button>
    {open && <div className="sourcing-accordion-content">{children}</div>}
  </section>;
}

function Pill({ active, onClick, children, multi = false }: { active: boolean; onClick: () => void; children: React.ReactNode; multi?: boolean }) {
  return <button type="button" className={active ? "sourcing-pill active" : "sourcing-pill"} aria-pressed={active} onClick={onClick}>
    {multi && <span className="sourcing-pill-icon" aria-hidden="true">{active ? "✓" : "+"}</span>}{children}
  </button>;
}

export function RecruiterSourcing() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [openSections, setOpenSections] = useState({ employment: true, education: false, diversity: false });
  const [remoteCandidates, setRemoteCandidates] = useState<Candidate[] | null>(null);
  const [remoteStatus, setRemoteStatus] = useState<"idle" | "searching" | "live" | "preview">("idle");
  const [page, setPage] = useState(1);
  const [savedMessage, setSavedMessage] = useState("");
  const { register, handleSubmit, watch, setValue, reset, formState: { errors } } = useForm<SourcingFormValues>({
    resolver: zodResolver(sourcingSchema),
    defaultValues: sourcingDefaultValues,
  });
  const values = watch();

  useEffect(() => {
    if (searchParams.size) reset(stateFromSearchParams(searchParams));
  }, [searchParams, reset]);

  const previewResults = useMemo(() => previewCandidates.filter((candidate) => matchesTerms(candidate, values)), [values]);
  const candidates = remoteCandidates ?? previewResults;
  const totalPages = Math.max(1, Math.ceil(candidates.length / 10));
  const visibleCandidates = candidates.slice((page - 1) * 10, page * 10);

  const runSearch = async (formValues: SourcingFormValues) => {
    setRemoteStatus("searching");
    setPage(1);
    try {
      const response = await apiClient<ApiPage>("/api/recruiter/sourcing/search", {
        method: "POST",
        body: JSON.stringify(sourceRequest(formValues, 0, 40)),
      });
      setRemoteCandidates(response.content.map(mapApiCandidate));
      setRemoteStatus("live");
    } catch {
      setRemoteCandidates(null);
      setRemoteStatus("preview");
    }
  };

  useEffect(() => {
    const timer = window.setTimeout(() => { void runSearch(values); }, 600);
    return () => window.clearTimeout(timer);
    // A 600 ms delay is deliberately longer than the 500 ms API safeguard in the specification.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [values.anyKeywords, values.allKeywords, values.excludeKeywords]);

  const toggleEducationType = (type: string) => {
    const next = values.educationTypes.includes(type) ? values.educationTypes.filter((item) => item !== type) : [...values.educationTypes, type];
    setValue("educationTypes", next, { shouldDirty: true });
  };
  const clearSearch = () => {
    reset(clearedSourcingValues);
    setRemoteCandidates(null);
    setRemoteStatus("idle");
    setPage(1);
  };
  const saveSearch = () => {
    window.localStorage.setItem("sapienworx-sourcing-search", JSON.stringify(values));
    setSavedMessage("Search saved in this browser.");
  };

  return <WorkspaceShell workspace="recruiter" active="sourcing" title="Source candidates" description="Build precise talent searches with transparent, structured filters." actions={<Button variant="secondary" onClick={saveSearch}>Save search</Button>}>
    <div className="sourcing-tabs" role="tablist" aria-label="Candidate search modes"><button className="active" role="tab" aria-selected="true">Advanced search</button><button role="tab" aria-selected="false">Saved searches <Badge tone="neutral">1</Badge></button></div>
    {savedMessage && <p className="sourcing-saved" role="status">{savedMessage}</p>}
    <div className="sourcing-advanced-layout">
      <form className="sourcing-advanced-form" onSubmit={handleSubmit((formValues) => router.push(`/search/results?${searchParamsFor(formValues).toString()}`))} noValidate>
        <section className="sourcing-query-card">
          <div><span className="eyebrow">Keyword sourcing</span><h2>Build the shortlist</h2><p>Use a new line or comma to add another term. Quotation marks keep a phrase together.</p></div>
          <label className="form-field"><span>Any of these keywords</span><textarea {...register("anyKeywords")} placeholder={'e.g. "product design", Figma, research'} /><small>Matches candidates with at least one term.</small></label>
          <label className="form-field"><span>All of these keywords</span><textarea {...register("allKeywords")} placeholder={'e.g. Figma, "design systems"'} /><small>Every term is required. This is debounced by 600 ms.</small></label>
          <label className="form-field"><span>Exclude candidates who mention these keywords</span><input {...register("excludeKeywords")} placeholder="e.g. agency, internship" /><small>Exclude terms are applied as a separate safe filter.</small></label>
          {Object.keys(errors).length > 0 && <p className="sourcing-validation" role="alert">Please keep every search field within its allowed length.</p>}
        </section>

        <Accordion title="Employment details" helper="Experience, pay and recent roles" open={openSections.employment} onToggle={() => setOpenSections((current) => ({ ...current, employment: !current.employment }))}>
          <div className="sourcing-field-grid">
            <label className="form-field"><span>Experience from</span><select {...register("minExperience")}><option value="">No minimum</option>{numericOptions.map((item) => <option value={item} key={item}>{item} years</option>)}</select></label>
            <label className="form-field"><span>Experience to</span><select {...register("maxExperience")}><option value="">No maximum</option>{numericOptions.map((item) => <option value={item} key={item}>{item} years</option>)}</select></label>
            <label className="form-field"><span>Salary from</span><select {...register("minSalary")}><option value="">Any</option>{[5, 8, 10, 12, 15, 20, 30, 40, 50].map((item) => <option value={item} key={item}>₹{item}L</option>)}</select></label>
            <label className="form-field"><span>Salary to</span><select {...register("maxSalary")}><option value="">Any</option>{[10, 12, 15, 20, 30, 40, 50, 75, 100].map((item) => <option value={item} key={item}>₹{item}L</option>)}</select></label>
          </div>
          <div className="sourcing-field-grid">
            <label className="form-field"><span>Current or previous company</span><input {...register("company")} list="sourcing-companies" placeholder="Start typing a company" /><datalist id="sourcing-companies">{companySuggestions.map((item) => <option value={item} key={item} />)}</datalist></label>
            <label className="form-field"><span>Designation</span><input {...register("designation")} list="sourcing-designations" placeholder="Start typing a designation" /><datalist id="sourcing-designations">{designationSuggestions.map((item) => <option value={item} key={item} />)}</datalist></label>
          </div>
          <label className="form-field"><span>Location</span><input {...register("location")} placeholder="e.g. Bengaluru, Remote, London" /></label>
        </Accordion>

        <Accordion title="Education details" helper="Qualifications, institutions and study type" open={openSections.education} onToggle={() => setOpenSections((current) => ({ ...current, education: !current.education }))}>
          <fieldset className="sourcing-fieldset"><legend>Undergraduate qualification</legend><div className="sourcing-pills"><Pill active={values.ugMode === "any"} onClick={() => setValue("ugMode", "any")}>Any UG</Pill><Pill active={values.ugMode === "specific"} onClick={() => setValue("ugMode", "specific")}>Specific UG</Pill><Pill active={values.ugMode === "none"} onClick={() => setValue("ugMode", "none")}>No UG</Pill></div></fieldset>
          {values.ugMode === "specific" && <label className="form-field"><span>Degree</span><select {...register("qualification")}><option value="">Select a degree</option><option>B.Tech</option><option>B.Sc</option><option>B.Des</option><option>B.A.</option><option>B.Com</option></select></label>}
          <label className="form-field"><span>Institute or university</span><input {...register("institution")} placeholder="e.g. Indian Institute of Technology" /></label>
          <fieldset className="sourcing-fieldset"><legend>Education type</legend><div className="sourcing-pills">{educationTypes.map((type) => <Pill key={type} multi active={values.educationTypes.includes(type)} onClick={() => toggleEducationType(type)}>{type}</Pill>)}</div></fieldset>
        </Accordion>

        <Accordion title="Diversity hiring" helper="Optional inclusive sourcing preferences" open={openSections.diversity} onToggle={() => setOpenSections((current) => ({ ...current, diversity: !current.diversity }))}>
          <fieldset className="sourcing-fieldset"><legend>Gender</legend><div className="sourcing-pills"><Pill active={!values.gender} onClick={() => setValue("gender", "")}>Any</Pill><Pill active={values.gender === "female"} onClick={() => setValue("gender", "female")}>Women</Pill><Pill active={values.gender === "male"} onClick={() => setValue("gender", "male")}>Men</Pill><Pill active={values.gender === "non-binary"} onClick={() => setValue("gender", "non-binary")}>Non-binary</Pill></div></fieldset>
          <fieldset className="sourcing-fieldset"><legend>Portfolio evidence</legend><div className="sourcing-pills"><Pill multi active={values.requireGithub} onClick={() => setValue("requireGithub", !values.requireGithub)}>GitHub</Pill><Pill multi active={values.requireLeetcode} onClick={() => setValue("requireLeetcode", !values.requireLeetcode)}>LeetCode</Pill><Pill multi active={values.requirePortfolio} onClick={() => setValue("requirePortfolio", !values.requirePortfolio)}>Portfolio</Pill></div></fieldset>
        </Accordion>
        <div className="sourcing-form-actions"><Button type="submit">Search candidates</Button><Button variant="quiet" onClick={clearSearch}>Clear all</Button></div>
      </form>

      <section className="sourcing-advanced-results" aria-live="polite">
        <header><div><span className="eyebrow">Search results</span><h2>{candidates.length} matching candidates</h2></div><span className={remoteStatus === "live" ? "sourcing-data-state live" : "sourcing-data-state"}>{remoteStatus === "searching" ? "Refreshing…" : remoteStatus === "live" ? "Live database" : "Preview data"}</span></header>
        <p className="sourcing-results-description">{remoteStatus === "live" ? "Results are ranked by the matching profile evidence." : "Sign in as a recruiter to query the protected candidate database; this preview shows the active filters."}</p>
        <div className="sourcing-advanced-candidate-list">{visibleCandidates.map((candidate) => <CandidateResult candidate={candidate} key={candidate.id} />)}</div>
        {!visibleCandidates.length && <div className="empty-state sourcing-empty"><span aria-hidden="true">⌕</span><h3>No candidates match this search</h3><p>Relax a required term or clear a filter to widen the results.</p><Button onClick={clearSearch}>Clear filters</Button></div>}
        {totalPages > 1 && <nav className="pagination" aria-label="Candidate result pages"><button type="button" disabled={page === 1} onClick={() => setPage((current) => current - 1)}>← Previous</button>{Array.from({ length: totalPages }, (_, index) => <button type="button" className={page === index + 1 ? "active" : ""} onClick={() => setPage(index + 1)} key={index}>{index + 1}</button>)}<button type="button" disabled={page === totalPages} onClick={() => setPage((current) => current + 1)}>Next →</button></nav>}
      </section>
    </div>
  </WorkspaceShell>;
}

function CandidateResult({ candidate }: { candidate: Candidate }) {
  const activeLabel = candidate.activeDays <= 1 ? "today" : candidate.activeDays >= 365 ? "over a year ago" : `${candidate.activeDays}d ago`;
  return <article className="sourcing-advanced-candidate">
    <span className="result-avatar">{candidate.initials}</span><div><h3>{candidate.name}</h3><p>{candidate.role} · {candidate.location}</p><div className="result-tags">{candidate.skills.slice(0, 4).map((skill) => <span key={skill}>{skill}</span>)}</div><div className="result-meta"><span>{candidate.experience} years experience</span><span>{candidate.education}</span><span>{candidate.notice} notice</span><span>{candidate.salary}</span></div></div>
    <div className="sourcing-candidate-actions"><Badge tone={candidate.activeDays <= 7 ? "green" : "neutral"}>Active {activeLabel}</Badge><Button variant="secondary">View profile</Button></div>
  </article>;
}
