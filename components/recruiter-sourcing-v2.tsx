"use client";

import { useEffect, useState, type ReactNode } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { defaultRecruiterSearch, keywordList, searchParamsFor, stateFromSearchParams, type RecruiterSearchState } from "../lib/recruiter-search";
import { WorkspaceShell } from "./ui";

type SearchRecord = { id: string; name: string; state: RecruiterSearchState };

const RECENT_SEARCHES_KEY = "sapienworx-recent-sourcing-searches";
const SAVED_SEARCHES_KEY = "sapienworx-saved-sourcing-searches";
const years = Array.from({ length: 21 }, (_, index) => String(index));

function startingSearch(): RecruiterSearchState {
  return {
    ...defaultRecruiterSearch,
    anyKeywords: "Node.Js, Node",
    allKeywords: "",
    booleanQuery: '("Node.Js" OR "Node")',
    minExperience: "5",
    maxExperience: "8",
    minSalary: "20",
    maxSalary: "25",
  };
}

const initialRecent: SearchRecord[] = [
  { id: "recent-1", name: '("Node.Js" or "Node") | 5-8 years | 20-25 Lacs', state: startingSearch() },
  { id: "recent-2", name: "9940535707", state: { ...startingSearch(), booleanQuery: "9940535707" } },
  { id: "recent-3", name: "9994941352", state: { ...startingSearch(), booleanQuery: "9994941352" } },
  { id: "recent-4", name: "7550083171", state: { ...startingSearch(), booleanQuery: "7550083171" } },
  { id: "recent-5", name: '("Node.Js" or "Node") | 5-8 years | 20-25 Lacs', state: startingSearch() },
];

const initialSaved: SearchRecord[] = [
  { id: "saved-1", name: "DevOps App Support", state: { ...startingSearch(), anyKeywords: "AWS, DevOps, Datadog", booleanQuery: "AWS OR DevOps OR Datadog", minExperience: "6", maxExperience: "9" } },
  { id: "saved-2", name: "ETL", state: { ...startingSearch(), anyKeywords: "ETL, SQL queries, Airflow", booleanQuery: "ETL OR \"SQL queries\" OR Airflow", minExperience: "5", maxExperience: "10" } },
  { id: "saved-3", name: "backend", state: startingSearch() },
];

function readRecords(key: string): SearchRecord[] {
  try {
    const parsed: unknown = JSON.parse(window.localStorage.getItem(key) ?? "[]");
    return Array.isArray(parsed) ? parsed.filter((item): item is SearchRecord => Boolean(item && typeof item === "object" && "name" in item && "state" in item)).slice(0, 5) : [];
  } catch { return []; }
}

function expressionFor(search: RecruiterSearchState) {
  const mandatory = keywordList(search.allKeywords);
  const optional = keywordList(search.anyKeywords);
  const quote = (value: string) => value.includes(" ") ? `"${value}"` : value;
  const all = mandatory.map(quote).join(" AND ");
  const any = optional.map(quote).join(" OR ");
  return all && any ? `${all} AND (${any})` : all || any;
}

function Chip({ children, selected = false, onClick }: { children: ReactNode; selected?: boolean; onClick?: () => void }) {
  return <button className={selected ? "resdex-chip resdex-chip-selected" : "resdex-chip"} type="button" onClick={onClick}>{children}</button>;
}

function Field({ label, children, helper }: { label: string; children: ReactNode; helper?: ReactNode }) {
  return <label className="resdex-field"><span>{label}</span>{children}{helper && <small>{helper}</small>}</label>;
}

function ResdexSection({ title, badge, children }: { title: string; badge?: string; children: ReactNode }) {
  return <section className="resdex-section"><header><h2>{title}</h2>{badge && <b>{badge}</b>}<span aria-hidden="true">⌃</span></header>{children}</section>;
}

function HistoryRail({ recent, saved, onFill, onSearch }: { recent: SearchRecord[]; saved: SearchRecord[]; onFill: (record: SearchRecord) => void; onSearch: (record: SearchRecord) => void }) {
  const recentRecords = recent.length ? recent : initialRecent;
  const savedRecords = saved.length ? saved : initialSaved;
  return <aside className="resdex-history" aria-label="Search history">
    <section><h2>◷ &nbsp; Recent Searches</h2>{recentRecords.map((record) => <article key={record.id}><strong>{record.name}</strong><div><button type="button" onClick={() => onFill(record)}>Fill this search</button><button type="button" onClick={() => onSearch(record)}>Search profiles</button></div></article>)}</section>
    <section><header><h2>◷ &nbsp; Saved Searches</h2><button type="button">View all</button></header>{savedRecords.map((record) => <article key={record.id}><strong>{record.name}</strong><p>{record.name === "DevOps App Support" ? 'SRE, Site Reliability Engineer | "Datadog", AWS, Devops, "Support" | 6-9 years |10-15 Lacs' : record.name === "ETL" ? '"ETL", "SQL queries", "Airflow" | 5-10 years' : '("Node.Js" or "Node") | 5-8 years |20-25 Lacs'}</p><div><button type="button" onClick={() => onFill(record)}>Fill this search</button><button type="button" onClick={() => onSearch(record)}>100+ new profiles</button></div></article>)}</section>
  </aside>;
}

export function RecruiterSourcingV2() {
  const router = useRouter();
  const params = useSearchParams();
  const [search, setSearch] = useState<RecruiterSearchState>(startingSearch);
  const [booleanMode, setBooleanMode] = useState(true);
  const [filterTerms, setFilterTerms] = useState(["Typescript", '"Data Structures","Algorithm"']);
  const [recent, setRecent] = useState<SearchRecord[]>([]);
  const [saved, setSaved] = useState<SearchRecord[]>([]);
  const [includeRelocation, setIncludeRelocation] = useState(true);
  const [status, setStatus] = useState("");

  useEffect(() => {
    setRecent(readRecords(RECENT_SEARCHES_KEY));
    setSaved(readRecords(SAVED_SEARCHES_KEY));
  }, []);
  useEffect(() => {
    if (!params.size) return;
    const next = stateFromSearchParams(params);
    setSearch(next);
    setBooleanMode(Boolean(next.booleanQuery));
  }, [params]);

  const update = <K extends keyof RecruiterSearchState>(key: K, value: RecruiterSearchState[K]) => setSearch((current) => ({ ...current, [key]: value }));
  const toggleBoolean = (enabled: boolean) => {
    setBooleanMode(enabled);
    update("booleanQuery", enabled ? expressionFor(search) : "");
  };
  const saveRecord = (key: string, record: SearchRecord) => {
    const next = [record, ...readRecords(key).filter((item) => item.name !== record.name)].slice(0, 5);
    window.localStorage.setItem(key, JSON.stringify(next));
    key === RECENT_SEARCHES_KEY ? setRecent(next) : setSaved(next);
  };
  const submit = (state = search) => {
    const name = state.booleanQuery || [...keywordList(state.allKeywords), ...keywordList(state.anyKeywords)].join(", ") || "Candidate search";
    saveRecord(RECENT_SEARCHES_KEY, { id: crypto.randomUUID(), name, state });
    router.push(`/search/results?${searchParamsFor(state).toString()}`);
  };
  const fill = (record: SearchRecord) => {
    setSearch(record.state);
    setBooleanMode(Boolean(record.state.booleanQuery));
    setStatus("Search details filled. You can refine them before searching.");
  };
  const saveCurrent = () => {
    const name = search.booleanQuery || [...keywordList(search.allKeywords), ...keywordList(search.anyKeywords)].join(", ") || "Candidate search";
    saveRecord(SAVED_SEARCHES_KEY, { id: crypto.randomUUID(), name, state: search });
    setStatus("Search saved.");
  };

  return <WorkspaceShell workspace="recruiter" active="sourcing" title="Search candidates" description="Build a precise candidate search using skills, experience and profile evidence.">
    <div className="sourcing-reference">
      <div className="resdex-shell">
      <form className="resdex-form" onSubmit={(event) => { event.preventDefault(); submit(); }}>
        {status && <p className="resdex-status" role="status">{status}</p>}
        <Field label="Client you’re hiring for" helper={<><b>New</b></>}><input placeholder="Add client/company you’re hiring for" /></Field>
        <p className="resdex-ai-tip">✦ &nbsp; Get AI-powered results tailored to your client’s hiring needs</p>
        <div className="resdex-keyword-title"><span>Keywords</span><label className="resdex-toggle"><input type="checkbox" checked={booleanMode} onChange={(event) => toggleBoolean(event.target.checked)} /><i /><em>Boolean {booleanMode ? "on" : "off"}</em></label></div>
        {booleanMode ? <div className="resdex-query-input"><input aria-label="Boolean keyword expression" value={search.booleanQuery} onChange={(event) => update("booleanQuery", event.target.value)} /><button type="button" onClick={() => update("booleanQuery", "")}>Clear all</button></div> : <div className="resdex-query-input"><input aria-label="Add a keyword" value={search.anyKeywords} onChange={(event) => update("anyKeywords", event.target.value)} placeholder="Type another keyword" /><button type="button" onClick={() => update("anyKeywords", "")}>Clear all</button></div>}
        <button className="resdex-scope" type="button">Search keyword in <b>Entire resume</b>　⌄</button>
        <button className="resdex-add-link" type="button">+ Add IT Skills</button>
        <div className="resdex-filter-keywords"><span>Keywords used in filters</span><div>{filterTerms.map((term) => <button type="button" key={term} onClick={() => setFilterTerms((items) => items.filter((item) => item !== term))}>{term}<b>×</b></button>)}</div></div>
        <Field label="Experience"><span className="resdex-inline-fields"><select aria-label="Minimum experience" value={search.minExperience} onChange={(event) => update("minExperience", event.target.value)}>{years.map((year) => <option key={year}>{year}</option>)}</select><i>to</i><select aria-label="Maximum experience" value={search.maxExperience} onChange={(event) => update("maxExperience", event.target.value)}>{years.map((year) => <option key={year}>{year}</option>)}</select><em>Years</em></span></Field>
        <Field label="Current location of candidate"><input aria-label="Current location" value={search.location} onChange={(event) => update("location", event.target.value)} placeholder="Add location" /><span className="resdex-checkline"><input type="checkbox" checked={includeRelocation} onChange={(event) => setIncludeRelocation(event.target.checked)} />Include candidates who prefer to relocate to above locations <button type="button">Change preferred location</button></span><span className="resdex-checkline"><input type="checkbox" />Exclude candidates who have mentioned Anywhere in...　ⓘ</span></Field>
        <Field label="Annual Salary"><span className="resdex-inline-fields resdex-salary"><select aria-label="Currency"><option>INR</option></select><select aria-label="Minimum salary" value={search.minSalary} onChange={(event) => update("minSalary", event.target.value)}>{[5, 10, 15, 20, 25, 30].map((value) => <option key={value}>{value}</option>)}</select><i>to</i><select aria-label="Maximum salary" value={search.maxSalary} onChange={(event) => update("maxSalary", event.target.value)}>{[10, 15, 20, 25, 30, 40].map((value) => <option key={value}>{value}</option>)}</select><em>Lacs</em></span><span className="resdex-checkline"><input type="checkbox" />Include candidates who did not mention their current salary</span></Field>

        <ResdexSection title="Employment Details"><Field label="Department and Role"><input placeholder="Add Department/Role" /></Field><Field label="Industry"><input placeholder="Add industry" /></Field><Field label="Company"><input value={search.company} onChange={(event) => update("company", event.target.value)} placeholder="Add company name" /><button className="resdex-dropdown-label" type="button">Search in Current company　⌄</button><button className="resdex-add-link" type="button">+ Add Exclude Company</button></Field><div className="resdex-keyword-title resdex-designation-title"><span>Designation</span><label className="resdex-toggle"><input type="checkbox" /><i /><em>Boolean off</em></label></div><input value={search.designation} onChange={(event) => update("designation", event.target.value)} placeholder="Add designation" /><button className="resdex-dropdown-label" type="button">Search in Current designation　⌄</button><div className="resdex-pill-row"><span>Notice Period/ Availability to join　ⓘ</span><div><Chip>Any</Chip><Chip selected>0 - 15 days　✓</Chip><Chip selected>1 month　✓</Chip><Chip>2 months　+</Chip><Chip>3 months　+</Chip><Chip>More than 3 months　+</Chip><Chip selected>Currently serving notice period　✓</Chip></div></div></ResdexSection>

        <ResdexSection title="Education Details"><div className="resdex-qualification"><span>UG Qualification</span><div><Chip selected>Any UG qualification</Chip><Chip>Specific UG qualification</Chip><Chip>No UG qualification</Chip></div><small>Any UG - Candidates with any UG qualification will appear in the result</small></div><Field label="Institute"><input value={search.institution} onChange={(event) => update("institution", event.target.value)} placeholder="Select institute" /></Field><div className="resdex-pill-row"><span>Education Type</span><div><Chip selected>Full Time　✓</Chip><Chip>Part Time　+</Chip><Chip>Correspondence　+</Chip></div></div><div className="resdex-year-row"><span>Year of degree completion</span><div><select><option>From</option></select><select><option>To</option></select></div></div><p className="resdex-education-note">ⓘ　 Show candidates with both UG and PG qualification <b>⌄</b></p><div className="resdex-qualification"><span>PG Qualification</span><div><Chip selected>Any PG qualification</Chip><Chip>Specific PG qualification</Chip><Chip>No PG qualification</Chip></div><small>Any PG - Candidates with any PG qualification will appear in the result</small></div><Field label="Institute"><input placeholder="Select institute" /></Field><div className="resdex-pill-row"><span>Education Type</span><div><Chip selected>Full Time　✓</Chip><Chip>Part Time　+</Chip><Chip>Correspondence　+</Chip></div></div><div className="resdex-year-row"><span>Year of degree completion</span><div><select><option>From</option></select><select><option>To</option></select></div></div><div className="resdex-qualification resdex-ppg"><span>PPG Qualification</span><div><Chip>Any PPG qualification</Chip><Chip>Specific PPG qualification</Chip><Chip>No PPG qualification</Chip></div></div></ResdexSection>

        <ResdexSection title="Diversity Hiring" badge="New Add-on"><div className="resdex-diversity"><h3>♟　 Gender</h3><div><Chip selected={search.gender === ""} onClick={() => update("gender", "")}>All candidates</Chip><Chip selected={search.gender === "male"} onClick={() => update("gender", "male")}>Male candidates</Chip><Chip selected={search.gender === "female"} onClick={() => update("gender", "female")}>Female candidates</Chip></div><h3>♟　 Candidates with career break</h3><Chip>Women returning to work</Chip><h3>♿　 Differently-abled</h3><input placeholder="Select differently abled type" /><div className="resdex-compact-pills"><Chip>Any　+</Chip><Chip>Blindness　+</Chip><Chip>Low Vision　+</Chip><Chip>Hearing Impairment　+</Chip><Chip>Speech and Language Disability　+</Chip><Chip>Locomotor Disability　+</Chip><button type="button">+17 more</button></div><h3>♟　 Defence background personnel</h3><div className="resdex-compact-pills"><Chip>Any　+</Chip><Chip>Army　+</Chip><Chip>Navy　+</Chip><Chip>Air Force　+</Chip><Chip>Other Paramilitary Forces　+</Chip></div></div></ResdexSection>

        <ResdexSection title="Additional Details"><h3 className="resdex-subheading">Candidate details</h3><Field label="Candidate Category"><input placeholder="Add candidate category" /></Field><Field label="Candidate Age"><span className="resdex-inline-fields"><input placeholder="Min age" /><i>to</i><input placeholder="Max age" /><em>Years</em></span></Field><h3 className="resdex-subheading">Work details</h3><Field label="Show candidates seeking"><span className="resdex-inline-fields resdex-work-selects"><select><option>Job type</option></select><select><option>Employment type</option></select></span></Field><Field label="Work permit for"><input placeholder="Choose category" /></Field><h3 className="resdex-subheading">Display details</h3><div className="resdex-pill-row"><span>Show</span><div><Chip selected>All candidates</Chip><Chip>New registrations</Chip><Chip>Modified candidates</Chip></div></div><div className="resdex-pill-row"><span>Show only candidates with</span><div><Chip>Verified mobile number　+</Chip><Chip>Verified email ID　+</Chip><Chip>Attached resume　+</Chip></div></div></ResdexSection>
        <footer className="resdex-form-footer"><label className="resdex-active-status">Active in - <select aria-label="Candidate activity period" value={search.activeStatus} onChange={(event) => update("activeStatus", event.target.value as RecruiterSearchState["activeStatus"])}><option value="ONE_DAY">1 day</option><option value="THREE_DAYS">3 days</option><option value="SEVEN_DAYS">7 days</option><option value="FIFTEEN_DAYS">15 days</option><option value="THIRTY_DAYS">30 days</option><option value="SIXTY_DAYS">60 days</option><option value="NINETY_DAYS">90 days</option><option value="ONE_YEAR">1 year</option><option value="ALL">Any time</option></select></label><button type="submit">Search candidates</button></footer>
      </form>
      <HistoryRail recent={recent} saved={saved} onFill={fill} onSearch={(record) => submit(record.state)} />
      </div>
    </div>
  </WorkspaceShell>;
}
