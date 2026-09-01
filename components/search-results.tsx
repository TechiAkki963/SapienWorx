"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { apiClient } from "../lib/api-client";
import { keywordList, searchParamsFor, sourceRequest, stateFromSearchParams, type RecruiterSearchState } from "../lib/recruiter-search";
import { trackProductEvent } from "../lib/telemetry";
import { highlightKeywords } from "./keyword-highlight";
import { Button, WorkspaceShell } from "./ui";

type ApiCandidate = {
  candidateId: string;
  fullName: string;
  headline: string | null;
  currentCompany: string | null;
  highestEducation: string | null;
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
  id: string; name: string; initials: string; headline: string; company: string; education: string; location: string; experience: number;
  salary: string; salaryLakhs: number; noticeDays: number; skills: string[]; activeDays: number; updatedDays: number; relevanceScore?: number;
};

const previewCandidates: Candidate[] = [
  { id: "preview-1", name: "Amara Mensah", initials: "AM", headline: "Senior Product Designer", company: "Northstar Studio", education: "M.Des · Royal College of Art", location: "London · Hybrid", experience: 6, salary: "£72k", salaryLakhs: 72, noticeDays: 30, skills: ["Figma", "Design systems", "Research"], activeDays: 1, updatedDays: 0 },
  { id: "preview-2", name: "Nia Okafor", initials: "NO", headline: "Product Designer", company: "Harbour & Co.", education: "B.Des · University of Leeds", location: "London · Remote", experience: 5, salary: "£64k", salaryLakhs: 64, noticeDays: 15, skills: ["Figma", "Prototyping", "B2B SaaS"], activeDays: 1, updatedDays: 0 },
  { id: "preview-3", name: "Eleanor Chen", initials: "EC", headline: "Senior Product Designer", company: "Vertex Systems", education: "M.Des · Glasgow School of Art", location: "Manchester · Hybrid", experience: 7, salary: "£76k", salaryLakhs: 76, noticeDays: 30, skills: ["Design systems", "Accessibility", "Figma"], activeDays: 3, updatedDays: 1 },
  { id: "preview-4", name: "Lina Patel", initials: "LP", headline: "UX Designer", company: "Acorn Digital", education: "B.Des · University of Bristol", location: "Bristol · Remote", experience: 4, salary: "£58k", salaryLakhs: 58, noticeDays: 0, skills: ["User research", "Figma", "Workshops"], activeDays: 3, updatedDays: 1 },
  { id: "preview-5", name: "Aarav Mehta", initials: "AM", headline: "Frontend Engineer", company: "Nexora Technologies", education: "B.Tech · IIT Delhi", location: "London · Hybrid", experience: 6, salary: "£70k", salaryLakhs: 70, noticeDays: 60, skills: ["React", "TypeScript", "GitHub"], activeDays: 7, updatedDays: 2 },
  { id: "preview-6", name: "Sofia Martin", initials: "SM", headline: "Senior UX Designer", company: "Horizon Labs", education: "B.A. · University of Leeds", location: "Leeds · Remote", experience: 8, salary: "£78k", salaryLakhs: 78, noticeDays: 30, skills: ["Accessibility", "Research", "Prototyping"], activeDays: 7, updatedDays: 2 },
  { id: "preview-7", name: "David Okoro", initials: "DO", headline: "Design Lead", company: "Nexora Technologies", education: "M.Des · University of the Arts London", location: "London · On-site", experience: 9, salary: "£88k", salaryLakhs: 88, noticeDays: 90, skills: ["Design systems", "Leadership", "Figma"], activeDays: 15, updatedDays: 3 },
  { id: "preview-8", name: "Ivy Williams", initials: "IW", headline: "Product Designer", company: "Studio Field", education: "B.Des · Birmingham City University", location: "Birmingham · Hybrid", experience: 5, salary: "£63k", salaryLakhs: 63, noticeDays: 30, skills: ["Prototyping", "Research", "Mobile"], activeDays: 15, updatedDays: 4 },
  { id: "preview-9", name: "Maya Singh", initials: "MS", headline: "UX Researcher", company: "Nexora Technologies", education: "M.A. · Goldsmiths, University of London", location: "London · Hybrid", experience: 5, salary: "£66k", salaryLakhs: 66, noticeDays: 15, skills: ["Research", "Figma", "Analytics"], activeDays: 30, updatedDays: 7 },
  { id: "preview-10", name: "Jon Bell", initials: "JB", headline: "Product Designer", company: "Orbit Works", education: "B.Des · University for the Creative Arts", location: "Remote · UK", experience: 3, salary: "£50k", salaryLakhs: 50, noticeDays: 0, skills: ["Figma", "UI design", "HTML"], activeDays: 30, updatedDays: 7 },
  { id: "preview-11", name: "Priya Shah", initials: "PS", headline: "Senior Product Designer", company: "Vertex Systems", education: "M.Des · National Institute of Design", location: "London · Hybrid", experience: 7, salary: "£77k", salaryLakhs: 77, noticeDays: 30, skills: ["Figma", "Research", "Leadership"], activeDays: 45, updatedDays: 9 },
  { id: "preview-12", name: "Chloe Grant", initials: "CG", headline: "UX Researcher", company: "Harbour & Co.", education: "M.Sc · University of Edinburgh", location: "London · Remote", experience: 6, salary: "£70k", salaryLakhs: 70, noticeDays: 90, skills: ["Research", "Analytics", "Workshops"], activeDays: 60, updatedDays: 14 },
];

function mapApiCandidate(candidate: ApiCandidate): Candidate {
  const initials = candidate.fullName.split(/\s+/).map((part) => part[0]).join("").slice(0, 2).toUpperCase();
  const activeDays = candidate.lastActiveAt ? Math.max(0, Math.round((Date.now() - Date.parse(candidate.lastActiveAt)) / 86_400_000)) : 365;
  const updatedDays = candidate.profileLastUpdatedAt ? Math.max(0, Math.round((Date.now() - Date.parse(candidate.profileLastUpdatedAt)) / 86_400_000)) : 365;
  return { id: candidate.candidateId, name: candidate.fullName, initials, headline: candidate.headline || "Current role not provided", company: candidate.currentCompany || "Company not provided", education: candidate.highestEducation || "Education not provided", location: candidate.location || "Location not provided", experience: candidate.overallExperienceYears ?? 0, salary: candidate.expectedSalaryLakhs == null ? "Not shared" : `₹${candidate.expectedSalaryLakhs}L`, salaryLakhs: candidate.expectedSalaryLakhs ?? 0, noticeDays: candidate.noticePeriodDays ?? 365, skills: candidate.skills ? candidate.skills.split(", ").filter(Boolean) : [], activeDays, updatedDays, relevanceScore: candidate.relevanceScore ?? 0 };
}

function matchesPreview(candidate: Candidate, state: RecruiterSearchState, activeOnly: boolean, maximumNotice: number | null, salary: string) {
  const corpus = `${candidate.name} ${candidate.headline} ${candidate.company} ${candidate.location} ${candidate.skills.join(" ")}`.toLowerCase();
  const contains = (term: string) => corpus.includes(term.toLowerCase().replaceAll('"', "").trim());
  const any = keywordList(state.anyKeywords);
  const all = keywordList(state.allKeywords);
  const exclude = keywordList(state.excludeKeywords);
  const [minimumSalary, maximumSalary] = salary === "50-70" ? [50, 70] : salary === "70+" ? [70, Infinity] : [0, Infinity];
  return (!any.length || any.some(contains)) && all.every(contains) && !exclude.some(contains)
    && (!state.location || candidate.location.toLowerCase().includes(state.location.toLowerCase()))
    && (!state.minExperience || candidate.experience >= Number(state.minExperience))
    && (!state.maxExperience || candidate.experience <= Number(state.maxExperience))
    && (!activeOnly || candidate.activeDays <= 15)
    && (maximumNotice == null || candidate.noticeDays <= maximumNotice)
    && candidate.salaryLakhs >= minimumSalary && candidate.salaryLakhs <= maximumSalary;
}

function contextTags(state: RecruiterSearchState) {
  const tags = [
    ...keywordList(state.allKeywords).map((value) => `All: ${value}`), ...keywordList(state.anyKeywords).map((value) => `Any: ${value}`),
    state.location && `Location: ${state.location}`, state.designation && `Role: ${state.designation}`, state.qualification && `Degree: ${state.qualification}`,
  ].filter(Boolean) as string[];
  return tags.length ? tags : ["All searchable candidates"];
}

export function SearchResults() {
  const params = useSearchParams();
  const resultsParamsRef = useRef(params.toString());
  const state = useMemo(() => stateFromSearchParams(params), [params]);
  const uiState = useMemo(() => {
    const noticeParameter = params.get("maximumNotice");
    const noticeValue = noticeParameter == null ? Number.NaN : Number(noticeParameter);
    const salaryValue = params.get("salaryRange");
    const sizeValue = Number(params.get("pageSize"));
    const pageValue = Number(params.get("page"));
    return {
      activeInLast15Days: params.get("activeInLast15Days") === "true",
      maximumNotice: [0, 15, 30, 60].includes(noticeValue) ? noticeValue : null,
      salaryRange: salaryValue === "50-70" || salaryValue === "70+" ? salaryValue : "any",
      sortBy: params.get("sortBy") === "updated" ? "updated" : "relevance",
      pageSize: [10, 20, 40].includes(sizeValue) ? sizeValue : 40,
      page: Number.isInteger(pageValue) && pageValue > 0 ? pageValue : 0,
    };
  }, [params]);
  const [activeInLast15Days, setActiveInLast15Days] = useState(uiState.activeInLast15Days);
  const [maximumNotice, setMaximumNotice] = useState<number | null>(uiState.maximumNotice);
  const [salaryRange, setSalaryRange] = useState(uiState.salaryRange);
  const [sortBy, setSortBy] = useState(uiState.sortBy);
  const [pageSize, setPageSize] = useState(uiState.pageSize);
  const [page, setPage] = useState(uiState.page);
  const [remotePage, setRemotePage] = useState<ApiPage | null>(null);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<string[]>([]);
  const [modalOpen, setModalOpen] = useState(false);
  const [saved, setSaved] = useState<string[]>([]);
  const [message, setMessage] = useState("");
  const selectionScope = [state.anyKeywords, state.allKeywords, state.excludeKeywords, state.location, state.designation, state.qualification, state.minExperience, state.maxExperience, activeInLast15Days, maximumNotice, salaryRange, page, pageSize].join("|");
  const selectionScopeRef = useRef<string | null>(null);

  useEffect(() => {
    resultsParamsRef.current = params.toString();
    setActiveInLast15Days(uiState.activeInLast15Days);
    setMaximumNotice(uiState.maximumNotice);
    setSalaryRange(uiState.salaryRange);
    setSortBy(uiState.sortBy);
    setPageSize(uiState.pageSize);
    setPage(uiState.page);
  }, [uiState]);

  const salaryValues = salaryRange === "50-70" ? { minimumSalaryLakhs: 50, maximumSalaryLakhs: 70 } : salaryRange === "70+" ? { minimumSalaryLakhs: 70, maximumSalaryLakhs: null } : {};
  useEffect(() => {
    setLoading(true);
    if (selectionScopeRef.current !== null && selectionScopeRef.current !== selectionScope) setSelected([]);
    selectionScopeRef.current = selectionScope;
    void apiClient<ApiPage>("/api/recruiter/sourcing/search", { method: "POST", body: JSON.stringify(sourceRequest(state, page, pageSize, { activeInLast15Days, maximumNoticePeriodDays: maximumNotice, ...salaryValues })) })
      .then((response) => setRemotePage(response))
      .catch(() => setRemotePage(null))
      .finally(() => setLoading(false));
  }, [state, page, pageSize, activeInLast15Days, maximumNotice, salaryRange, selectionScope]);

  const preview = useMemo(() => previewCandidates.filter((candidate) => matchesPreview(candidate, state, activeInLast15Days, maximumNotice, salaryRange)), [state, activeInLast15Days, maximumNotice, salaryRange]);
  const candidates = remotePage ? remotePage.content.map(mapApiCandidate) : preview;
  const sortedCandidates = useMemo(() => [...candidates].sort((left, right) => sortBy === "updated" ? left.updatedDays - right.updatedDays : (right.relevanceScore ?? 0) - (left.relevanceScore ?? 0)), [candidates, sortBy]);
  const total = remotePage?.totalElements ?? sortedCandidates.length;
  const pageCandidateIds = sortedCandidates.map((candidate) => candidate.id);
  const keywords = [...keywordList(state.anyKeywords), ...keywordList(state.allKeywords)];
  const allSelected = pageCandidateIds.length > 0 && pageCandidateIds.every((id) => selected.includes(id));
  const modifyHref = `/recruiter/sourcing?${searchParamsFor(state).toString()}`;
  const currentResultsParams = resultsParamsRef.current;
  const resultsHref = `/search/results${currentResultsParams ? `?${currentResultsParams}` : ""}`;
  const relaxedExperienceParams = new URLSearchParams(currentResultsParams);
  relaxedExperienceParams.delete("minExperience");
  relaxedExperienceParams.delete("maxExperience");
  relaxedExperienceParams.delete("page");
  const relaxedExperienceHref = `/search/results${relaxedExperienceParams.size ? `?${relaxedExperienceParams.toString()}` : ""}`;
  const updateResultsUi = (changes: Record<string, string | undefined>) => {
    const next = new URLSearchParams(resultsParamsRef.current);
    for (const [key, value] of Object.entries(changes)) value ? next.set(key, value) : next.delete(key);
    resultsParamsRef.current = next.toString();
    window.history.replaceState(null, "", `/search/results${next.size ? `?${next.toString()}` : ""}`);
  };
  const toggleCandidate = (id: string) => setSelected((current) => current.includes(id) ? current.filter((item) => item !== id) : [...current, id]);
  const toggleAll = () => setSelected(allSelected ? [] : pageCandidateIds);
  const saveCandidate = (candidate: Candidate) => {
    const next = saved.includes(candidate.id) ? saved.filter((id) => id !== candidate.id) : [...saved, candidate.id];
    setSaved(next);
    window.localStorage.setItem("sapienworx-saved-candidates", JSON.stringify(next));
  };

  return <WorkspaceShell workspace="recruiter" active="sourcing" title="Candidate search results" description="Review matching profiles and coordinate your next outreach.">
    <section className="results-context-bar" aria-label="Active search parameters"><div>{contextTags(state).map((tag) => <span key={tag}>{tag}</span>)}</div><a href={modifyHref}>Modify search</a></section>
    <div className="results-workspace">
      <aside className="results-facets" aria-label="Refine candidate results"><div><span className="eyebrow">Quick refinements</span><h2>Focus the list</h2></div><label><input type="checkbox" checked={activeInLast15Days} onChange={(event) => { setActiveInLast15Days(event.target.checked); setPage(0); updateResultsUi({ activeInLast15Days: event.target.checked ? "true" : undefined, page: undefined }); }} /> Active in last 15 days</label><label><span>Notice period</span><select value={maximumNotice ?? ""} onChange={(event) => { const next = event.target.value ? Number(event.target.value) : null; setMaximumNotice(next); setPage(0); updateResultsUi({ maximumNotice: event.target.value || undefined, page: undefined }); }}><option value="">Any notice period</option><option value="0">Immediate</option><option value="15">Up to 15 days</option><option value="30">Up to 30 days</option><option value="60">Up to 60 days</option></select></label><label><span>Salary range</span><select value={salaryRange} onChange={(event) => { setSalaryRange(event.target.value); setPage(0); updateResultsUi({ salaryRange: event.target.value === "any" ? undefined : event.target.value, page: undefined }); }}><option value="any">Any salary</option><option value="50-70">₹50L – ₹70L</option><option value="70+">₹70L+</option></select></label><button type="button" className="results-clear-filters" onClick={() => { setActiveInLast15Days(false); setMaximumNotice(null); setSalaryRange("any"); setPage(0); updateResultsUi({ activeInLast15Days: undefined, maximumNotice: undefined, salaryRange: undefined, page: undefined }); }}>Clear refinements</button></aside>
      <main className="results-feed">
        <header className="results-action-bar"><label className="results-master-select"><input type="checkbox" checked={allSelected} onChange={toggleAll} /> Select all on this page</label><div className="results-toolbar-controls"><label>Sort by<select value={sortBy} onChange={(event) => { setSortBy(event.target.value); setPage(0); updateResultsUi({ sortBy: event.target.value === "relevance" ? undefined : event.target.value, page: undefined }); }}><option value="relevance">Relevance</option><option value="updated">Date updated</option></select></label><label>Show<select value={pageSize} onChange={(event) => { setPageSize(Number(event.target.value)); setPage(0); updateResultsUi({ pageSize: event.target.value === "40" ? undefined : event.target.value, page: undefined }); }}><option value="10">10 per page</option><option value="20">20 per page</option><option value="40">40 per page</option></select></label><Button disabled={!selected.length} onClick={() => { trackProductEvent("recruiter_bulk_email_opened", { candidateCount: selected.length, resultSource: remotePage ? "live" : "preview" }); setModalOpen(true); }}>Send Email{selected.length ? ` (${selected.length})` : ""}</Button></div></header>
        <div className="results-summary"><div><strong>{total} candidates</strong><span>{loading ? "Refreshing results…" : remotePage ? "Live database results" : "Preview data while the protected API is unavailable"}</span></div>{saved.length > 0 && <span role="status">{saved.length} saved</span>}</div>
        <div className="results-card-list">{sortedCandidates.map((candidate) => <CandidateResultCard key={candidate.id} candidate={candidate} selected={selected.includes(candidate.id)} onSelect={() => toggleCandidate(candidate.id)} onSave={() => saveCandidate(candidate)} saved={saved.includes(candidate.id)} keywords={keywords} onDownload={() => setMessage("CV downloads are available from the candidate’s secured profile.")} profileHref={`/recruiter/candidates/${encodeURIComponent(candidate.id)}?returnTo=${encodeURIComponent(resultsHref)}`} />)}</div>
        {!loading && !sortedCandidates.length && <div className="empty-state results-empty"><span aria-hidden="true">⌕</span><h3>No candidates match these refinements</h3><p>{state.minExperience || state.maxExperience ? "This search may be too narrow. Try widening the experience range before changing your keywords." : "Clear a quick refinement or modify the original search criteria to broaden the list."}</p>{state.minExperience || state.maxExperience ? <a className="button button-primary" href={relaxedExperienceHref}>Remove experience filter</a> : <a className="button button-primary" href={modifyHref}>Modify search</a>}</div>}
        {remotePage && remotePage.totalPages > 1 && <nav className="pagination" aria-label="Search result pages"><button type="button" disabled={page === 0} onClick={() => { setPage(page - 1); updateResultsUi({ page: page === 1 ? undefined : String(page - 1) }); }}>← Previous</button><span>Page {page + 1} of {remotePage.totalPages}</span><button type="button" disabled={page + 1 >= remotePage.totalPages} onClick={() => { setPage(page + 1); updateResultsUi({ page: String(page + 1) }); }}>Next →</button></nav>}
        {message && <p className="results-inline-status" role="status">{message}</p>}
      </main>
    </div>
    {modalOpen && <BulkEmailModal candidateIds={selected} isPreview={!remotePage} onClose={() => setModalOpen(false)} onQueued={(queuedCount) => { trackProductEvent("recruiter_bulk_email_queued", { candidateCount: queuedCount }); setMessage(`${queuedCount} individual email${queuedCount === 1 ? "" : "s"} queued securely.`); setModalOpen(false); }} />}
  </WorkspaceShell>;
}

function CandidateResultCard({ candidate, selected, onSelect, onSave, saved, keywords, onDownload, profileHref }: { candidate: Candidate; selected: boolean; onSelect: () => void; onSave: () => void; saved: boolean; keywords: string[]; onDownload: () => void; profileHref: string }) {
  const active = candidate.activeDays <= 1 ? "Active today" : `Active ${candidate.activeDays}d ago`;
  return <article className="result-detail-card"><div className="result-card-select"><input id={`candidate-${candidate.id}`} type="checkbox" checked={selected} onChange={onSelect} /><label htmlFor={`candidate-${candidate.id}`}>Select {candidate.name}</label></div><header><div><h3>{candidate.name}</h3><div className="result-card-meta"><span>{candidate.experience} years experience</span><span>{candidate.salary}</span><span>{candidate.location}</span></div></div><span className="result-card-avatar" aria-hidden="true">{candidate.initials}</span></header><div className="result-card-summary"><p>{highlightKeywords(candidate.headline, keywords)} at {candidate.company}</p><p>{candidate.education}</p><div className="result-tags">{candidate.skills.map((skill) => <span key={skill}>{highlightKeywords(skill, keywords)}</span>)}</div></div><footer><span>{active} · Profile updated {candidate.updatedDays === 0 ? "today" : `${candidate.updatedDays}d ago`}</span><div><Link href={profileHref}>View profile</Link><button type="button" onClick={onDownload}>Download CV</button><button type="button" onClick={onSave}>{saved ? "Saved" : "Save Candidate"}</button></div></footer></article>;
}

function messageAsHtml(text: string) {
  return `<p>${text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/\n/g, "<br />")}</p>`;
}

function BulkEmailModal({ candidateIds, isPreview, onClose, onQueued }: { candidateIds: string[]; isPreview: boolean; onClose: () => void; onQueued: (queuedCount: number) => void }) {
  const [subject, setSubject] = useState("A role that may interest you");
  const [body, setBody] = useState("Hello,\n\nI came across your profile and would like to discuss a relevant opportunity. Please let me know a suitable time to connect.\n\nBest regards");
  const [error, setError] = useState("");
  const [queueing, setQueueing] = useState(false);
  const count = candidateIds.length;
  const queueEmail = async () => {
    if (isPreview || queueing) return;
    setQueueing(true);
    setError("");
    try {
      const queued = await apiClient<string[]>("/api/recruiter/communications/bulk-email", { method: "POST", body: JSON.stringify({ candidateIds, subject, htmlContent: messageAsHtml(body) }) });
      onQueued(queued.length);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "The emails could not be queued.");
    } finally {
      setQueueing(false);
    }
  };
  return <div className="results-modal-backdrop" role="presentation"><section className="results-modal" role="dialog" aria-modal="true" aria-labelledby="bulk-email-title"><button className="results-modal-close" type="button" onClick={onClose} aria-label="Close email dialog">×</button><span className="eyebrow">Bulk communication</span><h2 id="bulk-email-title">Email {count} selected candidate{count === 1 ? "" : "s"}</h2><p>Each recipient receives an individual message through the queued email workflow—never a shared recipient list.</p>{isPreview ? <div className="results-modal-note">Sign in to the recruiter workspace to review recipients and queue the email securely.</div> : <><div className="results-modal-note">The selected candidate IDs are ready for protected background delivery.</div><label className="results-modal-field">Subject<input value={subject} onChange={(event) => setSubject(event.target.value)} maxLength={200} required /></label><label className="results-modal-field">Message<textarea value={body} onChange={(event) => setBody(event.target.value)} maxLength={10_000} required /></label>{error && <p className="results-modal-error" role="alert">{error}</p>}</>}<div className="results-modal-actions"><Button variant="secondary" onClick={onClose}>Cancel</Button><Button disabled={isPreview || queueing || !subject.trim() || !body.trim()} onClick={() => void queueEmail()}>{queueing ? "Queueing…" : "Queue email"}</Button></div></section></div>;
}
