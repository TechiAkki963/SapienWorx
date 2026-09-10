"use client";

import { useEffect, useMemo, useState, type ReactNode } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import {
  defaultRecruiterSearch,
  keywordList,
  searchParamsFor,
  stateFromSearchParams,
  type RecruiterSearchState,
} from "../lib/recruiter-search";
import { apiClient } from "../lib/api-client";
import { Button, WorkspaceShell } from "./ui";

type SearchRecord = { id: string; name: string; state: RecruiterSearchState };

const RECENT_SEARCHES_KEY = "sapienworx-recent-sourcing-searches";
const SAVED_SEARCHES_KEY = "sapienworx-saved-sourcing-searches";
const experienceYears = Array.from({ length: 21 }, (_, index) => String(index));
const salaryOptions = [5, 10, 15, 20, 25, 30, 40, 50];

function emptySearch(): RecruiterSearchState {
  return { ...defaultRecruiterSearch, allKeywords: "", gender: "" };
}

function isSearchState(value: unknown): value is RecruiterSearchState {
  return Boolean(
    value &&
      typeof value === "object" &&
      "anyKeywords" in value &&
      "allKeywords" in value &&
      "activeStatus" in value,
  );
}

function readRecords(key: string): SearchRecord[] {
  try {
    const parsed: unknown = JSON.parse(window.localStorage.getItem(key) ?? "[]");
    if (!Array.isArray(parsed)) return [];
    return parsed
      .filter(
        (item): item is SearchRecord =>
          Boolean(
            item &&
              typeof item === "object" &&
              "id" in item &&
              typeof item.id === "string" &&
              "name" in item &&
              typeof item.name === "string" &&
              "state" in item &&
              isSearchState(item.state),
          ),
      )
      .map((item): SearchRecord => ({ ...item, state: { ...item.state, gender: "" as const } }))
      .slice(0, 5);
  } catch {
    return [];
  }
}

function expressionFor(search: RecruiterSearchState) {
  const mandatory = keywordList(search.allKeywords);
  const optional = keywordList(search.anyKeywords);
  const quote = (value: string) => (value.includes(" ") ? `"${value}"` : value);
  const all = mandatory.map(quote).join(" AND ");
  const any = optional.map(quote).join(" OR ");
  return all && any ? `${all} AND (${any})` : all || any;
}

function searchName(search: RecruiterSearchState) {
  const keywords = search.booleanQuery || [...keywordList(search.allKeywords), ...keywordList(search.anyKeywords)].join(", ");
  const details = [keywords, search.location, search.minExperience && search.maxExperience ? `${search.minExperience}-${search.maxExperience} years` : ""]
    .filter(Boolean)
    .join(" · ");
  return details || "Candidate search";
}

function Field({ label, children, hint }: { label: string; children: ReactNode; hint?: string }) {
  return (
    <label className="resdex-field">
      <span>{label}</span>
      {children}
      {hint && <small>{hint}</small>}
    </label>
  );
}

function SearchHistory({ title, records, onFill, onSearch }: { title: string; records: SearchRecord[]; onFill: (record: SearchRecord) => void; onSearch: (record: SearchRecord) => void }) {
  return (
    <section>
      <h2>{title}</h2>
      {records.length ? (
        records.map((record) => (
          <article key={record.id}>
            <strong>{record.name}</strong>
            <div>
              <button type="button" onClick={() => onFill(record)}>Edit search</button>
              <button type="button" onClick={() => onSearch(record)}>Run search</button>
            </div>
          </article>
        ))
      ) : (
        <p className="muted">Nothing here yet.</p>
      )}
    </section>
  );
}

export function RecruiterSourcingV2() {
  const router = useRouter();
  const params = useSearchParams();
  const [search, setSearch] = useState<RecruiterSearchState>(emptySearch);
  const [booleanMode, setBooleanMode] = useState(false);
  const [advancedOpen, setAdvancedOpen] = useState(false);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [recent, setRecent] = useState<SearchRecord[]>([]);
  const [saved, setSaved] = useState<SearchRecord[]>([]);
  const [status, setStatus] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const controller = new AbortController();
    setRecent(readRecords(RECENT_SEARCHES_KEY));
    setSaved(readRecords(SAVED_SEARCHES_KEY));
    void apiClient<Array<{ id: string; name: string; criteria: unknown }>>(
      "/api/recruiter/workflow/saved-searches",
      { signal: controller.signal },
    )
      .then((records) => {
        const remote: SearchRecord[] = records
          .filter((record) => isSearchState(record.criteria))
          .map((record) => ({
            id: record.id,
            name: record.name,
            state: { ...(record.criteria as RecruiterSearchState), gender: "" as const },
          }));
        if (remote.length) setSaved(remote.slice(0, 5));
      })
      .catch(() => undefined);
    return () => controller.abort();
  }, []);

  useEffect(() => {
    if (!params.size) return;
    const next = stateFromSearchParams(params);
    setSearch(next);
    setBooleanMode(Boolean(next.booleanQuery));
    if (
      next.company ||
      next.designation ||
      next.departmentRole ||
      next.industry ||
      next.qualification ||
      next.institution ||
      next.educationTypes.length ||
      next.requireGithub ||
      next.requireLeetcode ||
      next.requirePortfolio
    ) {
      setAdvancedOpen(true);
    }
  }, [params]);

  const appliedFilters = useMemo(
    () =>
      [
        search.location && `Location: ${search.location}`,
        (search.minExperience || search.maxExperience) && `Experience: ${search.minExperience || "0"}-${search.maxExperience || "Any"} years`,
        (search.minSalary || search.maxSalary) && `Salary: ₹${search.minSalary || "0"}-${search.maxSalary || "Any"} LPA`,
        search.company && `Company: ${search.company}`,
        search.industry && `Industry: ${search.industry}`,
        search.activeStatus !== "ALL" && `Active: ${search.activeStatus.replaceAll("_", " ").toLowerCase()}`,
      ].filter(Boolean) as string[],
    [search],
  );

  const update = <K extends keyof RecruiterSearchState>(key: K, value: RecruiterSearchState[K]) => {
    setSearch((current) => ({ ...current, [key]: value, gender: "" }));
  };

  const storeRecord = (key: string, record: SearchRecord) => {
    const safeRecord: SearchRecord = { ...record, state: { ...record.state, gender: "" as const } };
    const next: SearchRecord[] = [safeRecord, ...readRecords(key).filter((item) => item.name !== safeRecord.name)].slice(0, 5);
    window.localStorage.setItem(key, JSON.stringify(next));
    if (key === RECENT_SEARCHES_KEY) setRecent(next);
    else setSaved(next);
  };

  const runSearch = (state = search) => {
    const safeState: RecruiterSearchState = { ...state, gender: "" as const };
    storeRecord(RECENT_SEARCHES_KEY, {
      id: crypto.randomUUID(),
      name: searchName(safeState),
      state: safeState,
    });
    const query = searchParamsFor(safeState).toString();
    router.push(`/search/results${query ? `?${query}` : ""}`);
  };

  const fillSearch = (record: SearchRecord) => {
    const safeState: RecruiterSearchState = { ...record.state, gender: "" as const };
    setSearch(safeState);
    setBooleanMode(Boolean(safeState.booleanQuery));
    setHistoryOpen(false);
    setStatus("Search loaded. Review the filters before running it.");
  };

  const saveCurrent = async () => {
    const safeState: RecruiterSearchState = { ...search, gender: "" as const };
    const name = searchName(safeState);
    setSaving(true);
    setStatus("");
    try {
      const response = await apiClient<{ id?: string }>("/api/recruiter/workflow/saved-searches", {
        method: "POST",
        body: JSON.stringify({ name, criteria: safeState, alertFrequency: "DAILY" }),
      });
      storeRecord(SAVED_SEARCHES_KEY, {
        id: response.id || crypto.randomUUID(),
        name,
        state: safeState,
      });
      setStatus("Search saved to your recruiter workspace.");
    } catch (reason) {
      setStatus(reason instanceof Error ? reason.message : "We couldn't save this search. Your search criteria have not changed.");
    } finally {
      setSaving(false);
    }
  };

  const reset = () => {
    setSearch(emptySearch());
    setBooleanMode(false);
    setAdvancedOpen(false);
    setStatus("Filters reset.");
  };

  return (
    <WorkspaceShell
      workspace="recruiter"
      active="sourcing"
      title="Search talent"
      description="Use structured filters or Boolean search. Protected personal attributes are not used for sourcing or ranking."
    >
      <div className="sourcing-reference">
        <form className="resdex-form" onSubmit={(event) => { event.preventDefault(); runSearch(); }}>
          {status && <p className="resdex-status" role="status">{status}</p>}

          <section className="sourcing-depth-picker" aria-labelledby="sourcing-heading">
            <div>
              <span className="eyebrow">Candidate sourcing</span>
              <h2 id="sourcing-heading">Start with the essentials.</h2>
              <p>Keep the common filters visible and open advanced filters only when the role needs more precision.</p>
            </div>
            <div role="group" aria-label="Sourcing utilities">
              <button type="button" aria-expanded={historyOpen} onClick={() => setHistoryOpen((value) => !value)}>Recent & saved</button>
              <button type="button" className={advancedOpen ? "selected" : ""} aria-expanded={advancedOpen} onClick={() => setAdvancedOpen((value) => !value)}>More filters {appliedFilters.length ? `(${appliedFilters.length})` : ""}</button>
            </div>
          </section>

          <div className="resdex-keyword-title">
            <span>Search query</span>
            <label className="resdex-toggle">
              <input
                type="checkbox"
                checked={booleanMode}
                onChange={(event) => {
                  const enabled = event.target.checked;
                  setBooleanMode(enabled);
                  update("booleanQuery", enabled ? expressionFor(search) : "");
                }}
              />
              <i />
              <em>{booleanMode ? "Boolean search" : "Structured search"}</em>
            </label>
          </div>

          {booleanMode ? (
            <div className="resdex-query-input">
              <input
                aria-label="Boolean keyword expression"
                value={search.booleanQuery}
                onChange={(event) => update("booleanQuery", event.target.value)}
                placeholder='e.g. (Java OR Kotlin) AND "Spring Boot"'
              />
              <button type="button" onClick={() => update("booleanQuery", "")}>Clear</button>
            </div>
          ) : (
            <>
              <Field label="Any of these skills, titles or keywords">
                <input
                  aria-label="Add a keyword"
                  value={search.anyKeywords}
                  onChange={(event) => update("anyKeywords", event.target.value)}
                  placeholder="Java, Spring Boot, Backend Engineer"
                />
              </Field>
              <Field label="Must include" hint="Separate multiple terms with commas.">
                <input
                  aria-label="Required keywords"
                  value={search.allKeywords}
                  onChange={(event) => update("allKeywords", event.target.value)}
                  placeholder="PostgreSQL, AWS"
                />
              </Field>
              <Field label="Exclude keywords">
                <input
                  aria-label="Excluded keywords"
                  value={search.excludeKeywords}
                  onChange={(event) => update("excludeKeywords", event.target.value)}
                  placeholder="Intern, fresher"
                />
              </Field>
            </>
          )}

          <Field label="Current location">
            <input
              aria-label="Current location"
              value={search.location}
              onChange={(event) => update("location", event.target.value)}
              placeholder="Mumbai, Pune, Bengaluru"
            />
          </Field>

          <Field label="Experience">
            <span className="resdex-inline-fields">
              <select aria-label="Minimum experience" value={search.minExperience} onChange={(event) => update("minExperience", event.target.value)}>
                <option value="">Min</option>
                {experienceYears.map((year) => <option value={year} key={year}>{year}</option>)}
              </select>
              <i>to</i>
              <select aria-label="Maximum experience" value={search.maxExperience} onChange={(event) => update("maxExperience", event.target.value)}>
                <option value="">Max</option>
                {experienceYears.map((year) => <option value={year} key={year}>{year}</option>)}
              </select>
              <em>years</em>
            </span>
          </Field>

          <Field label="Profile activity">
            <select aria-label="Active in" value={search.activeStatus} onChange={(event) => update("activeStatus", event.target.value as RecruiterSearchState["activeStatus"])}>
              <option value="ONE_DAY">Last 24 hours</option>
              <option value="THREE_DAYS">Last 3 days</option>
              <option value="SEVEN_DAYS">Last 7 days</option>
              <option value="FIFTEEN_DAYS">Last 15 days</option>
              <option value="THIRTY_DAYS">Last 30 days</option>
              <option value="SIXTY_DAYS">Last 60 days</option>
              <option value="NINETY_DAYS">Last 90 days</option>
              <option value="ONE_YEAR">Last year</option>
              <option value="ALL">Any time</option>
            </select>
          </Field>

          {appliedFilters.length > 0 && (
            <div className="resdex-filter-keywords" aria-label="Applied filters">
              <span>Applied filters</span>
              <div>{appliedFilters.map((filter) => <span className="resdex-chip resdex-chip-selected" key={filter}>{filter}</span>)}</div>
            </div>
          )}

          {advancedOpen && (
            <div className="sourcing-advanced-fields" id="advanced-sourcing-filters">
              <section className="resdex-section">
                <header><h2>Employment</h2></header>
                <Field label="Current or previous company"><input value={search.company} onChange={(event) => update("company", event.target.value)} placeholder="Company name" /></Field>
                <Field label="Designation"><input value={search.designation} onChange={(event) => update("designation", event.target.value)} placeholder="Current or previous title" /></Field>
                <Field label="Department / role"><input aria-label="Department and Role" value={search.departmentRole} onChange={(event) => update("departmentRole", event.target.value)} placeholder="Engineering, Data, Product" /></Field>
                <Field label="Industry"><input aria-label="Industry" value={search.industry} onChange={(event) => update("industry", event.target.value)} placeholder="Fintech, SaaS, Healthcare" /></Field>
              </section>

              <section className="resdex-section">
                <header><h2>Compensation</h2></header>
                <Field label="Annual salary">
                  <span className="resdex-inline-fields resdex-salary">
                    <select aria-label="Minimum salary" value={search.minSalary} onChange={(event) => update("minSalary", event.target.value)}>
                      <option value="">Min</option>
                      {salaryOptions.map((value) => <option value={value} key={value}>{value}</option>)}
                    </select>
                    <i>to</i>
                    <select aria-label="Maximum salary" value={search.maxSalary} onChange={(event) => update("maxSalary", event.target.value)}>
                      <option value="">Max</option>
                      {salaryOptions.map((value) => <option value={value} key={value}>{value}</option>)}
                    </select>
                    <em>LPA</em>
                  </span>
                </Field>
              </section>

              <section className="resdex-section">
                <header><h2>Education</h2></header>
                <Field label="Qualification"><input value={search.qualification} onChange={(event) => { update("qualification", event.target.value); update("ugMode", event.target.value ? "specific" : "any"); }} placeholder="B.Tech, MBA, M.Sc" /></Field>
                <Field label="Institution"><input value={search.institution} onChange={(event) => update("institution", event.target.value)} placeholder="University or institute" /></Field>
              </section>

              <section className="resdex-section">
                <header><h2>Professional profile links</h2></header>
                <label className="resdex-checkline"><input type="checkbox" checked={search.requireGithub} onChange={(event) => update("requireGithub", event.target.checked)} />Has GitHub profile</label>
                <label className="resdex-checkline"><input type="checkbox" checked={search.requireLeetcode} onChange={(event) => update("requireLeetcode", event.target.checked)} />Has LeetCode profile</label>
                <label className="resdex-checkline"><input type="checkbox" checked={search.requirePortfolio} onChange={(event) => update("requirePortfolio", event.target.checked)} />Has portfolio / work samples</label>
              </section>

              <p className="resdex-status" role="note">Sensitive personal attributes such as gender, age, disability, religion or other protected characteristics are intentionally excluded from normal sourcing and ranking.</p>
            </div>
          )}

          {historyOpen && (
            <aside className="resdex-history" aria-label="Search history">
              <SearchHistory title="Recent searches" records={recent} onFill={fillSearch} onSearch={(record) => runSearch(record.state)} />
              <SearchHistory title="Saved searches" records={saved} onFill={fillSearch} onSearch={(record) => runSearch(record.state)} />
            </aside>
          )}

          <div className="resdex-sticky-actions">
            <button type="button" onClick={reset}>Reset</button>
            <Button type="button" variant="secondary" onClick={() => void saveCurrent()} disabled={saving}>{saving ? "Saving…" : "Save search"}</Button>
            <Button type="submit">Search candidates</Button>
          </div>
        </form>
      </div>
    </WorkspaceShell>
  );
}
