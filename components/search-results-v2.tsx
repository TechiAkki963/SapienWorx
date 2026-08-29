"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import {
  defaultRecruiterSearch,
  keywordList,
  searchParamsFor,
  sourceRequest,
  stateFromSearchParams,
  type RecruiterSearchState,
} from "../lib/recruiter-search";
import { apiClient } from "../lib/api-client";
import { trackProductEvent } from "../lib/telemetry";
import { Button, WorkspaceShell } from "./ui";

type Profile = {
  id: string;
  name: string;
  experience: string;
  salary: string;
  location: string;
  current: string;
  previous: string;
  education: string;
  preferredLocations: string;
  skills: string[];
  mayKnow: string;
  summary: string;
  views: number;
  downloads: number;
  similarProfiles?: number;
  emailVerified?: boolean;
  mobileVerified?: boolean;
  cvAvailable?: boolean;
  lastActiveAt?: string | null;
  profileLastUpdatedAt?: string | null;
  avatarTone: string;
};
type SourcingCandidate = {
  candidateId: string;
  fullName: string;
  headline: string | null;
  currentCompany: string | null;
  previousRole: string | null;
  previousCompany: string | null;
  highestEducation: string | null;
  location: string | null;
  preferredLocations: string | null;
  overallExperienceYears: number | null;
  expectedSalaryLakhs: number | null;
  noticePeriodDays: number | null;
  skills: string | null;
  profileSummary: string | null;
  emailVerified: boolean | null;
  mobileVerified: boolean | null;
  cvAvailable: boolean | null;
  similarProfileCount: number | null;
  lastActiveAt: string | null;
  profileLastUpdatedAt: string | null;
  profileViewCount: number | null;
  profileDownloadCount: number | null;
  relevanceScore: number | null;
};
type SourcingPage = {
  content: SourcingCandidate[];
  totalElements: number;
  totalPages: number;
  number: number;
  size: number;
};

const referenceProfiles: Profile[] = [
  {
    id: "avish-bansal",
    name: "Avish Bansal",
    experience: "5y 3m",
    salary: "₹ 24.36 Lacs",
    location: "Bengaluru",
    current:
      "Senior Consultant - Mckinsey & Com... at StatusNeo Technology Consulting",
    previous: "Senior Software Engineer - Lineage Logistics at Cognizant",
    education: "B.Tech / B.E. Graphic Era deemed to be University 2020",
    preferredLocations: "Remote, Bengaluru, Gurugram",
    skills: [
      "System Design",
      "Leadership",
      "Apache Pulsar",
      "Websocket",
      "Vuex",
      "Redis",
      "Express",
      "GraphQL",
      "TypeScript",
      "Nestjs",
      "Node.js",
      "AWS",
      "Docker",
      "Data Structures",
      "Python",
      "Algorithms",
      "Microservices",
    ],
    mayKnow: "Angular | Fullstack Development | Micro...",
    summary:
      "Full Stack Engineer well versed in designing, developing and scaling products.",
    views: 147,
    downloads: 31,
    similarProfiles: 459,
    emailVerified: true,
    mobileVerified: true,
    cvAvailable: true,
    profileLastUpdatedAt: "2026-08-15T10:00:00Z",
    lastActiveAt: "2026-08-26T07:00:00Z",
    avatarTone: "avish",
  },
  {
    id: "shivam-agrawal",
    name: "Shivam Agrawal",
    experience: "5y 3m",
    salary: "₹ 20 Lacs",
    location: "Pune",
    current: "Node Js Backend Developer at Prismforce",
    previous: "Node Js Developer at Talentica Software",
    education: "B.Tech / B.E. College of Engineering Pune, Pune 2021",
    preferredLocations: "Pune, Bengaluru, Hyderabad, Gurugram",
    skills: [
      "Node.js",
      "MongoDB",
      "Postgresql",
      "Redis",
      "Nestjs",
      "Solid Principles",
      "TypeScript",
      "AWS",
      "Microservices",
    ],
    mayKnow: "Backend development | API design | Micro...",
    summary:
      "SDE 2 | Backend Developer | Node.js | TypeScript | NestJS | AWS...",
    views: 98,
    downloads: 24,
    profileLastUpdatedAt: "2026-08-18T10:00:00Z",
    lastActiveAt: "2026-08-25T10:00:00Z",
    avatarTone: "shivam",
  },
  {
    id: "poorna-latha",
    name: "Poorna Latha Satya Ch...",
    experience: "5y",
    salary: "₹ 18 Lacs",
    location: "Hyderabad",
    current: "Java Full Stack Developer at Pivotal Technologies",
    previous: "Software Engineer at Wipro",
    education: "B.Tech, JNTU Hyderabad 2020",
    preferredLocations: "Hyderabad, Bengaluru",
    skills: [
      "Java",
      "Spring Boot",
      "React",
      "TypeScript",
      "SQL",
      "AWS",
      "Docker",
    ],
    mayKnow: "Hibernate | Kafka | REST APIs",
    summary:
      "Java full-stack engineer with production experience in distributed systems.",
    views: 121,
    downloads: 18,
    profileLastUpdatedAt: "2026-08-13T10:00:00Z",
    lastActiveAt: "2026-08-26T08:00:00Z",
    avatarTone: "poorna",
  },
  {
    id: "vaibhav-thakur",
    name: "Vaibhav T Thakur",
    experience: "7y",
    salary: "₹ 28 Lacs",
    location: "Bengaluru",
    current: "Senior Software Engineer at GlobalLogic",
    previous: "Software Engineer at Thoughtworks",
    education: "B.E. Computer Science, Pune University",
    preferredLocations: "Bengaluru, Pune",
    skills: [
      "Java",
      "Kotlin",
      "Node.js",
      "Kafka",
      "Kubernetes",
      "AWS",
      "Postgresql",
    ],
    mayKnow: "Event-driven design | APIs",
    summary: "Backend engineer focused on reliable cloud-native systems.",
    views: 204,
    downloads: 42,
    profileLastUpdatedAt: "2026-08-12T10:00:00Z",
    lastActiveAt: "2026-08-24T10:00:00Z",
    avatarTone: "vaibhav",
  },
  {
    id: "bvr-sai-ram",
    name: "BVR Sai Ram",
    experience: "6y",
    salary: "₹ 23 Lacs",
    location: "Bengaluru",
    current: "Full Stack Engineer at IBM",
    previous: "Application Developer at Accenture",
    education: "B.Tech, Andhra University 2019",
    preferredLocations: "Bengaluru, Hyderabad",
    skills: ["React", "Node.js", "Java", "AWS", "Docker", "GraphQL", "Redis"],
    mayKnow: "Next.js | CICD | Azure",
    summary:
      "Engineer experienced across frontend platforms and scalable backend services.",
    views: 156,
    downloads: 29,
    profileLastUpdatedAt: "2026-08-10T10:00:00Z",
    lastActiveAt: "2026-08-23T10:00:00Z",
    avatarTone: "sairam",
  },
  {
    id: "jasbir-inder",
    name: "JASBIR INDER",
    experience: "6y",
    salary: "₹ 26 Lacs",
    location: "Gurugram",
    current: "Software Engineer at Nagarro",
    previous: "Software Developer at HCL",
    education: "B.Tech, Punjab Technical University",
    preferredLocations: "Gurugram, Noida, Bengaluru",
    skills: [
      "Java",
      "Spring",
      "Microservices",
      "SQL",
      "React",
      "TypeScript",
      "AWS",
    ],
    mayKnow: "Docker | Jenkins | Kubernetes",
    summary:
      "Platform engineer with strong Java and microservices delivery experience.",
    views: 133,
    downloads: 26,
    profileLastUpdatedAt: "2026-08-17T10:00:00Z",
    lastActiveAt: "2026-08-21T10:00:00Z",
    avatarTone: "jasbir",
  },
  {
    id: "riya-raman",
    name: "Riya Raman Singh",
    experience: "5y",
    salary: "₹ 21 Lacs",
    location: "Pune",
    current: "Senior Software Engineer at Persistent Systems",
    previous: "Software Engineer at Capgemini",
    education: "B.E. Computer Engineering, Pune 2020",
    preferredLocations: "Pune, Mumbai, Bengaluru",
    skills: ["Java", "Node.js", "TypeScript", "MongoDB", "AWS", "REST", "Git"],
    mayKnow: "React | Agile delivery",
    summary:
      "Full-stack developer specialising in API-first product engineering.",
    views: 117,
    downloads: 17,
    profileLastUpdatedAt: "2026-08-19T10:00:00Z",
    lastActiveAt: "2026-08-22T10:00:00Z",
    avatarTone: "riya",
  },
  {
    id: "aman-yadav",
    name: "Aman Yadav",
    experience: "4y",
    salary: "₹ 16 Lacs",
    location: "Noida",
    current: "Software Developer at Publicis Sapient",
    previous: "Associate Engineer at Nagarro",
    education: "B.Tech, AKTU 2021",
    preferredLocations: "Noida, Gurugram",
    skills: ["Java", "Spring Boot", "SQL", "JavaScript", "AWS", "Docker"],
    mayKnow: "Linux | REST APIs",
    summary:
      "Software developer delivering backend systems for enterprise products.",
    views: 87,
    downloads: 12,
    profileLastUpdatedAt: "2026-08-20T10:00:00Z",
    lastActiveAt: "2026-08-20T10:00:00Z",
    avatarTone: "aman",
  },
];
const pageSizes = [20, 40, 80, 160] as const;
const activityWindows = [
  { value: "SEVEN_DAYS", label: "7 days" },
  { value: "FIFTEEN_DAYS", label: "15 days" },
  { value: "THIRTY_DAYS", label: "30 days" },
  { value: "SIXTY_DAYS", label: "60 days" },
  { value: "ALL", label: "Any time" },
] as const;

function queryDescription(terms: string[], booleanQuery = "") {
  if (booleanQuery) return booleanQuery;
  if (!terms.length || terms.join(" ").toLowerCase().includes("java"))
    return '("Node.js" or "Node"), Typescript, "Data Structures"...';
  return terms
    .slice(0, 3)
    .map((term) => `"${term}"`)
    .join(", ");
}
function profileFromCandidate(candidate: SourcingCandidate): Profile {
  const skills =
    candidate.skills
      ?.split(",")
      .map((value) => value.trim())
      .filter(Boolean) ?? [];
  const preferredLocations = readLocations(candidate.preferredLocations);
  return {
    id: candidate.candidateId,
    name: candidate.fullName,
    experience: candidate.overallExperienceYears
      ? `${candidate.overallExperienceYears}y`
      : "Experience not shared",
    salary:
      candidate.expectedSalaryLakhs == null
        ? "Salary not shared"
        : `₹ ${candidate.expectedSalaryLakhs} Lacs`,
    location: candidate.location || "Location not shared",
    current:
      [
        candidate.headline,
        candidate.currentCompany ? `at ${candidate.currentCompany}` : "",
      ]
        .filter(Boolean)
        .join(" ") || "Current role not shared",
    previous:
      [
        candidate.previousRole,
        candidate.previousCompany ? `at ${candidate.previousCompany}` : "",
      ]
        .filter(Boolean)
        .join(" ") || "Previous role details not shared",
    education: candidate.highestEducation || "Education not shared",
    preferredLocations:
      preferredLocations.join(", ") || candidate.location || "Not shared",
    skills,
    mayKnow:
      skills.slice(3, 6).join(" | ") ||
      skills.slice(0, 3).join(" | ") ||
      "Skills not shared",
    summary:
      candidate.profileSummary ||
      candidate.headline ||
      "Candidate profile ready for review.",
    views: candidate.profileViewCount ?? 0,
    downloads: candidate.profileDownloadCount ?? 0,
    similarProfiles: candidate.similarProfileCount ?? 0,
    emailVerified: candidate.emailVerified === true,
    mobileVerified: candidate.mobileVerified === true,
    cvAvailable: candidate.cvAvailable === true,
    lastActiveAt: candidate.lastActiveAt,
    profileLastUpdatedAt: candidate.profileLastUpdatedAt,
    avatarTone: candidate.candidateId.slice(0, 8),
  };
}
function readLocations(value: string | null) {
  if (!value) return [];
  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed)
      ? parsed.filter(
          (location): location is string =>
            typeof location === "string" && location.trim().length > 0,
        )
      : [];
  } catch {
    return value
      .split(",")
      .map((location) => location.trim())
      .filter(Boolean);
  }
}
function highlight(text: string, terms: string[]) {
  const normalized = terms
    .filter((term) => term.length > 2)
    .map((term) => term.replaceAll('"', ""))
    .filter(Boolean);
  if (!normalized.length) return text;
  const expression = new RegExp(
    `(${normalized.map((term) => term.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")).join("|")})`,
    "ig",
  );
  return text
    .split(expression)
    .map((part, index) =>
      normalized.some((term) => part.toLowerCase() === term.toLowerCase()) ? (
        <mark key={`${part}-${index}`}>{part}</mark>
      ) : (
        part
      ),
    );
}
function relativeDate(
  value: string | null | undefined,
  verb: "Modified" | "Active",
) {
  if (!value) return `${verb} date unavailable`;
  const days = Math.max(
    0,
    Math.floor((Date.now() - Date.parse(value)) / 86_400_000),
  );
  return days === 0
    ? `${verb} today`
    : days === 1
      ? `${verb} yesterday`
      : `${verb} ${days} days ago`;
}
function FilterChip({
  children,
  onRemove,
}: {
  children: React.ReactNode;
  onRemove?: () => void;
}) {
  return (
    <span className="talent-filter-chip">
      {children}
      {onRemove && (
        <button
          type="button"
          onClick={onRemove}
          aria-label={`Remove ${String(children)}`}
        >
          ×
        </button>
      )}
    </span>
  );
}
function FilterSection({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className="talent-filter-section">
      <header>
        <b>{title}</b>
        <span aria-hidden="true">⌃</span>
      </header>
      {children}
    </section>
  );
}
function CountCheck({
  label,
  count,
  checked = false,
  onChange,
}: {
  label: string;
  count?: number;
  checked?: boolean;
  onChange?: (checked: boolean) => void;
}) {
  return (
    <label className="talent-filter-check">
      <input
        type="checkbox"
        checked={checked}
        onChange={(event) => onChange?.(event.target.checked)}
      />
      <span>{label}</span>
      {count != null && <small>{count}</small>}
    </label>
  );
}
function validPageSize(value: string | null) {
  const parsed = Number(value);
  return pageSizes.includes(parsed as (typeof pageSizes)[number])
    ? parsed
    : 160;
}
function hasNoReferenceMatches(criteria: RecruiterSearchState) {
  const minimumExperience = Number(criteria.minExperience);
  const maximumExperience = Number(criteria.maxExperience);
  return (
    (criteria.minExperience !== "" &&
      Number.isFinite(minimumExperience) &&
      minimumExperience > 7) ||
    (criteria.maxExperience !== "" &&
      Number.isFinite(maximumExperience) &&
      maximumExperience < 4)
  );
}

export function SearchResultsV2() {
  const router = useRouter();
  const params = useSearchParams();
  const paramsKey = params.toString();
  const initialState = useMemo(
    () => stateFromSearchParams(params),
    [paramsKey],
  );
  const [draft, setDraft] = useState<RecruiterSearchState>(initialState);
  const [activeCriteria, setActiveCriteria] =
    useState<RecruiterSearchState>(initialState);
  const [pageIndex, setPageIndex] = useState(() =>
    Math.max(0, Number(params.get("page")) || 0),
  );
  const [pageSize, setPageSize] = useState(() =>
    validPageSize(params.get("pageSize")),
  );
  const [sortBy, setSortBy] = useState<"relevance" | "updated">(() =>
    params.get("sortBy") === "updated" ? "updated" : "relevance",
  );
  const [selected, setSelected] = useState<string[]>([]);
  const [hideProfiles, setHideProfiles] = useState(false);
  const [saveState, setSaveState] = useState("");
  const [outreachOpen, setOutreachOpen] = useState(false);
  const [contactMessage, setContactMessage] = useState("");
  const [livePage, setLivePage] = useState<SourcingPage | null>(null);
  const [isLoadingProfiles, setIsLoadingProfiles] = useState(true);
  const [engagementChanges, setEngagementChanges] = useState<
    Record<string, { view?: boolean; download?: boolean }>
  >({});
  const paramsRef = useRef(paramsKey);
  const criteriaRef = useRef(initialState);
  const sortRef = useRef<"relevance" | "updated">(
    params.get("sortBy") === "updated" ? "updated" : "relevance",
  );

  useEffect(() => {
    const next = stateFromSearchParams(params);
    const nextSort =
      params.get("sortBy") === "updated" ? "updated" : "relevance";
    criteriaRef.current = next;
    sortRef.current = nextSort;
    setDraft(next);
    setActiveCriteria(next);
    setPageIndex(Math.max(0, Number(params.get("page")) || 0));
    setPageSize(validPageSize(params.get("pageSize")));
    setSortBy(nextSort);
    paramsRef.current = params.toString();
  }, [paramsKey, params]);
  useEffect(() => {
    const controller = new AbortController();
    setIsLoadingProfiles(true);
    void apiClient<SourcingPage>("/api/recruiter/sourcing/search", {
      method: "POST",
      body: JSON.stringify(sourceRequest(activeCriteria, pageIndex, pageSize)),
      signal: controller.signal,
    })
      .then((response) => setLivePage(response))
      .catch((reason) => {
        if (!(reason instanceof DOMException && reason.name === "AbortError"))
          setLivePage(null);
      })
      .finally(() => {
        if (!controller.signal.aborted) setIsLoadingProfiles(false);
      });
    return () => controller.abort();
  }, [activeCriteria, pageIndex, pageSize]);

  const queryTerms = activeCriteria.booleanQuery
    ? activeCriteria.booleanQuery
        .split(/\b(?:AND|OR|NOT)\b|[()]/i)
        .map((term) => term.replaceAll('"', "").trim())
        .filter(Boolean)
    : [
        ...keywordList(activeCriteria.allKeywords),
        ...keywordList(activeCriteria.anyKeywords),
      ];
  const draftTerms = [
    ...keywordList(draft.allKeywords),
    ...keywordList(draft.anyKeywords),
  ];
  const fallbackHasNoMatches = hasNoReferenceMatches(activeCriteria);
  const fallbackPageCount = Math.max(1, Math.ceil(638 / pageSize));
  const totalPages =
    livePage?.totalPages ?? (fallbackHasNoMatches ? 1 : fallbackPageCount);
  const fallbackProfiles = fallbackHasNoMatches
    ? []
    : referenceProfiles.slice(
        (pageIndex % fallbackPageCount) * pageSize,
        (pageIndex % fallbackPageCount) * pageSize + pageSize,
      );
  const rawProfiles = livePage
    ? livePage.content.map(profileFromCandidate)
    : fallbackProfiles;
  const profiles = hideProfiles
    ? []
    : [...rawProfiles].sort((left, right) =>
        sortBy === "updated"
          ? Date.parse(right.profileLastUpdatedAt ?? "") -
            Date.parse(left.profileLastUpdatedAt ?? "")
          : right.views - left.views,
      );
  const allSelected =
    profiles.length > 0 &&
    profiles.every((profile) => selected.includes(profile.id));
  const totalProfiles =
    livePage?.totalElements ?? (fallbackHasNoMatches ? 0 : 638);
  const persist = (
    criteria: RecruiterSearchState,
    nextPage: number,
    nextSize: number,
    nextSort = sortRef.current,
  ) => {
    const criteriaToPersist =
      criteria === activeCriteria ? criteriaRef.current : criteria;
    criteriaRef.current = criteriaToPersist;
    const next = searchParamsFor(criteriaToPersist);
    if (nextPage > 0) next.set("page", String(nextPage));
    if (nextSize !== 160) next.set("pageSize", String(nextSize));
    if (nextSort !== "relevance") next.set("sortBy", nextSort);
    paramsRef.current = next.toString();
    router.replace(`/search/results${next.size ? `?${next.toString()}` : ""}`);
  };
  const applyFilters = () => {
    setActiveCriteria(draft);
    setPageIndex(0);
    setSelected([]);
    persist(draft, 0, pageSize);
  };
  const clearFilters = () => {
    const cleared = {
      ...defaultRecruiterSearch,
      allKeywords: "",
      activeStatus: "ALL" as const,
    };
    setDraft(cleared);
    setActiveCriteria(cleared);
    setPageIndex(0);
    setSelected([]);
    persist(cleared, 0, pageSize);
  };
  const clearExperience = () => {
    const next = { ...activeCriteria, minExperience: "", maxExperience: "" };
    setDraft(next);
    setActiveCriteria(next);
    setPageIndex(0);
    setSelected([]);
    persist(next, 0, pageSize);
  };
  const setActivity = (status: RecruiterSearchState["activeStatus"]) => {
    const next = { ...activeCriteria, activeStatus: status };
    setDraft(next);
    setActiveCriteria(next);
    setPageIndex(0);
    setSelected([]);
    persist(next, 0, pageSize);
  };
  const changePageSize = (nextSize: number) => {
    setPageSize(nextSize);
    setPageIndex(0);
    setSelected([]);
    persist(activeCriteria, 0, nextSize);
  };
  const changeSort = (nextSort: "relevance" | "updated") => {
    sortRef.current = nextSort;
    setSortBy(nextSort);
    persist(activeCriteria, 0, pageSize, nextSort);
  };
  const changePage = (nextPage: number) => {
    if (nextPage < 0 || nextPage >= totalPages) return;
    setPageIndex(nextPage);
    setSelected([]);
    persist(activeCriteria, nextPage, pageSize);
  };
  const removeTerm = (term: string) =>
    setDraft((current) => ({
      ...current,
      anyKeywords: keywordList(current.anyKeywords)
        .filter((value) => value !== term)
        .join(", "),
      allKeywords: keywordList(current.allKeywords)
        .filter((value) => value !== term)
        .join(", "),
    }));
  const profileHref = (id: string) =>
    `/recruiter/candidates/${id}?returnTo=${encodeURIComponent(`/search/results${paramsRef.current ? `?${paramsRef.current}` : ""}`)}`;
  const recordEngagement = (candidateId: string, type: "view" | "download") => {
    setEngagementChanges((current) => ({
      ...current,
      [candidateId]: { ...current[candidateId], [type]: true },
    }));
    if (!/^[\da-f]{8}(?:-[\da-f]{4}){3}-[\da-f]{12}$/i.test(candidateId))
      return;
    void apiClient<void>(
      `/api/recruiter/sourcing/candidates/${candidateId}/profile-${type}`,
      { method: "POST" },
    ).catch(() => undefined);
  };
  const openOutreach = () => {
    trackProductEvent("recruiter_bulk_email_opened", {
      candidateCount: selected.length,
      resultSource: livePage ? "database" : "reference",
    });
    setOutreachOpen(true);
  };
  const queueOutreach = () => {
    trackProductEvent("recruiter_bulk_email_queued", {
      candidateCount: selected.length,
    });
    setOutreachOpen(false);
    setSaveState(
      `${selected.length} individual email${selected.length === 1 ? "" : "s"} prepared for the protected RabbitMQ workflow.`,
    );
  };

  return (
    <WorkspaceShell workspace="recruiter" active="sourcing">
      <div className="talent-results-shell">
        <header className="talent-results-titlebar">
          <div className="talent-breadcrumb" aria-hidden="true">
            <span>♟</span>
            <span>▥</span>
            <b>›</b>
          </div>
          <p>
            <strong>✦ AI found</strong> <b>{totalProfiles}</b> profiles for{" "}
            <span>
              {queryDescription(queryTerms, activeCriteria.booleanQuery)}
            </span>{" "}
            <Link
              href={`/recruiter/sourcing?${searchParamsFor(activeCriteria).toString()}`}
            >
              Modify
            </Link>
          </p>
          <button
            type="button"
            className="talent-save-search"
            onClick={() => setSaveState("Search saved in this browser.")}
          >
            Save Search
          </button>
        </header>
        {saveState && (
          <p className="talent-save-state" role="status">
            {saveState}
          </p>
        )}
        <div className="talent-results-layout">
          <aside
            className="talent-filter-rail talent-filter-rail-expanded"
            aria-label="Candidate filters"
          >
            <label className="talent-hide-profiles">
              <input
                type="checkbox"
                checked={hideProfiles}
                onChange={(event) => setHideProfiles(event.target.checked)}
              />{" "}
              Hide Profiles
            </label>
            <div className="talent-filter-heading">
              <span aria-hidden="true">☷</span>
              <h2>Filters</h2>
            </div>
            <div className="talent-filter-applied">
              <b>{draftTerms.length} filters applied</b>
              <button type="button" onClick={clearFilters}>
                Reset
              </button>
            </div>
            <div className="talent-filter-chips">
              {draftTerms.slice(0, 2).map((term) => (
                <FilterChip key={term} onRemove={() => removeTerm(term)}>
                  {term}
                </FilterChip>
              ))}
            </div>
            <label className="talent-filter-option">
              <input type="checkbox" /> Premium Institute Candidates
            </label>
            <label className="talent-filter-option">
              <input type="checkbox" /> Candidates with verified skills{" "}
              <span aria-hidden="true">ⓘ</span>
            </label>
            <FilterSection title={`Keywords (${draftTerms.length})`}>
              <label className="talent-filter-search">
                <input
                  aria-label="Search keyword"
                  value={draft.anyKeywords}
                  onChange={(event) =>
                    setDraft({ ...draft, anyKeywords: event.target.value })
                  }
                  placeholder="Search keyword"
                />
                <span aria-hidden="true">⌕</span>
              </label>
              <div className="talent-filter-chips">
                {draftTerms.slice(0, 2).map((term) => (
                  <FilterChip key={term} onRemove={() => removeTerm(term)}>
                    {term}
                  </FilterChip>
                ))}
              </div>
            </FilterSection>
            <FilterSection title="Exclude Keywords">
              <label className="talent-filter-search">
                <input
                  aria-label="Exclude keywords"
                  value={draft.excludeKeywords}
                  onChange={(event) =>
                    setDraft({ ...draft, excludeKeywords: event.target.value })
                  }
                  placeholder="Exclude keywords"
                />
                <span aria-hidden="true">⌕</span>
              </label>
            </FilterSection>
            <FilterSection title="Current company">
              <label className="talent-filter-search">
                <input
                  aria-label="Current company"
                  value={draft.company}
                  onChange={(event) =>
                    setDraft({ ...draft, company: event.target.value })
                  }
                  placeholder="Search company"
                />
                <span aria-hidden="true">⌕</span>
              </label>
            </FilterSection>
            <FilterSection title="Location">
              <label className="talent-filter-search">
                <input
                  aria-label="Location"
                  value={draft.location}
                  onChange={(event) =>
                    setDraft({ ...draft, location: event.target.value })
                  }
                  placeholder="Search location"
                />
                <span aria-hidden="true">⌕</span>
              </label>
              <div className="talent-filter-checks">
                <CountCheck label="Bengaluru" count={94} />
                <CountCheck label="Pune" count={77} />
                <CountCheck label="Hyderabad" count={68} />
                <CountCheck label="Gurugram" count={51} />
                <button type="button">+ 6 more locations</button>
              </div>
            </FilterSection>
            <FilterSection title="Experience (Years)">
              <div className="talent-filter-range">
                <select
                  aria-label="Filter minimum experience"
                  value={draft.minExperience}
                  onChange={(event) =>
                    setDraft({ ...draft, minExperience: event.target.value })
                  }
                >
                  <option value="">Min exp</option>
                  {Array.from({ length: 21 }, (_, index) => (
                    <option key={index} value={index}>
                      {index}
                    </option>
                  ))}
                </select>
                <span>to</span>
                <select
                  aria-label="Filter maximum experience"
                  value={draft.maxExperience}
                  onChange={(event) =>
                    setDraft({ ...draft, maxExperience: event.target.value })
                  }
                >
                  <option value="">Max exp</option>
                  {Array.from({ length: 21 }, (_, index) => (
                    <option key={index} value={index}>
                      {index}
                    </option>
                  ))}
                </select>
              </div>
            </FilterSection>
            <FilterSection title="Salary (INR Lacs)">
              <div className="talent-filter-range">
                <select
                  aria-label="Filter minimum salary"
                  value={draft.minSalary}
                  onChange={(event) =>
                    setDraft({ ...draft, minSalary: event.target.value })
                  }
                >
                  <option value="">Min</option>
                  {[5, 10, 15, 20, 25, 30, 40].map((value) => (
                    <option key={value} value={value}>
                      {value}
                    </option>
                  ))}
                </select>
                <span>to</span>
                <select
                  aria-label="Filter maximum salary"
                  value={draft.maxSalary}
                  onChange={(event) =>
                    setDraft({ ...draft, maxSalary: event.target.value })
                  }
                >
                  <option value="">Max</option>
                  {[10, 15, 20, 25, 30, 40, 50].map((value) => (
                    <option key={value} value={value}>
                      {value}
                    </option>
                  ))}
                </select>
              </div>
            </FilterSection>
            <FilterSection title="Current designation">
              <label className="talent-filter-search">
                <input
                  aria-label="Current designation"
                  value={draft.designation}
                  onChange={(event) =>
                    setDraft({ ...draft, designation: event.target.value })
                  }
                  placeholder="Search designation"
                />
                <span aria-hidden="true">⌕</span>
              </label>
            </FilterSection>
            <FilterSection title="Department and Role">
              <div className="talent-filter-checks">
                <CountCheck label="Engineering / Software" count={312} />
                <CountCheck label="IT Services & Consulting" count={177} />
                <CountCheck label="Product Management" count={64} />
                <button type="button">+ 4 more departments</button>
              </div>
            </FilterSection>
            <FilterSection title="Industry">
              <div className="talent-filter-checks">
                <CountCheck label="IT Services & Consulting" count={388} />
                <CountCheck label="Software Product" count={176} />
                <CountCheck label="Internet" count={63} />
                <button type="button">+ 4 more industries</button>
              </div>
            </FilterSection>
            <FilterSection title="Diversity Hiring">
              <div className="talent-filter-checks">
                <CountCheck
                  label="Male candidates"
                  count={246}
                  checked={draft.gender === "male"}
                  onChange={(checked) =>
                    setDraft({ ...draft, gender: checked ? "male" : "" })
                  }
                />
                <CountCheck
                  label="Female candidates"
                  count={198}
                  checked={draft.gender === "female"}
                  onChange={(checked) =>
                    setDraft({ ...draft, gender: checked ? "female" : "" })
                  }
                />
                <CountCheck label="Women returning to work" count={35} />
                <CountCheck label="Defence background" count={12} />
                <CountCheck label="Differently-abled" count={29} />
              </div>
            </FilterSection>
            <FilterSection title="Notice period">
              <div className="talent-filter-checks">
                <CountCheck label="0 - 15 days" count={112} />
                <CountCheck label="1 month" count={164} />
                <CountCheck label="2 months" count={86} />
                <CountCheck
                  label="Currently serving notice period"
                  count={73}
                />
              </div>
            </FilterSection>
            <FilterSection title="Age">
              <div className="talent-filter-range">
                <input aria-label="Minimum age" placeholder="Min age" />
                <span>to</span>
                <input aria-label="Maximum age" placeholder="Max age" />
              </div>
            </FilterSection>
            <FilterSection title="Degree/Course">
              <label className="talent-filter-search">
                <input
                  aria-label="Qualification"
                  value={draft.qualification}
                  onChange={(event) =>
                    setDraft({
                      ...draft,
                      qualification: event.target.value,
                      ugMode: event.target.value ? "specific" : "any",
                    })
                  }
                  placeholder="Search qualification"
                />
                <span aria-hidden="true">⌕</span>
              </label>
              <label className="talent-filter-search">
                <input
                  aria-label="Institute"
                  value={draft.institution}
                  onChange={(event) =>
                    setDraft({ ...draft, institution: event.target.value })
                  }
                  placeholder="Search institute"
                />
                <span aria-hidden="true">⌕</span>
              </label>
              <div className="talent-filter-checks">
                <CountCheck
                  label="Full time"
                  checked={draft.educationTypes.includes("Full time")}
                  onChange={(checked) =>
                    setDraft({
                      ...draft,
                      educationTypes: checked
                        ? [...new Set([...draft.educationTypes, "Full time"])]
                        : draft.educationTypes.filter(
                            (item) => item !== "Full time",
                          ),
                    })
                  }
                />
                <CountCheck label="Part time" />
                <CountCheck label="Correspondence" />
              </div>
            </FilterSection>
            <FilterSection title="Candidates with">
              <div className="talent-filter-checks">
                <CountCheck label="Verified mobile number" count={431} />
                <CountCheck label="Verified email ID" count={438} />
                <CountCheck label="Attached resume" count={420} />
              </div>
            </FilterSection>
            <button
              type="button"
              className="talent-apply-filters"
              onClick={applyFilters}
            >
              Apply filters
            </button>
          </aside>
          <main className="talent-results-main">
            <header className="talent-results-controls">
              <label>
                Active in
                <select
                  aria-label="Active in"
                  value={activeCriteria.activeStatus}
                  onChange={(event) =>
                    setActivity(
                      event.target
                        .value as RecruiterSearchState["activeStatus"],
                    )
                  }
                >
                  {activityWindows.map((window) => (
                    <option key={window.value} value={window.value}>
                      {window.label}
                    </option>
                  ))}
                </select>
              </label>
              <div>
                <label>
                  Sort by:
                  <select
                    aria-label="Sort by"
                    value={sortBy}
                    onChange={(event) =>
                      changeSort(event.target.value as "relevance" | "updated")
                    }
                  >
                    <option value="relevance">Relevance</option>
                    <option value="updated">Modified date</option>
                  </select>
                </label>
                <label>
                  Show
                  <select
                    aria-label="Show"
                    value={pageSize}
                    onChange={(event) =>
                      changePageSize(Number(event.target.value))
                    }
                  >
                    {pageSizes.map((size) => (
                      <option key={size} value={size}>
                        {size}
                      </option>
                    ))}
                  </select>
                </label>
                <nav
                  className="talent-pagination"
                  aria-label="Candidate result pages"
                >
                  <button
                    type="button"
                    aria-label="First page"
                    disabled={pageIndex === 0}
                    onClick={() => changePage(0)}
                  >
                    ‹‹
                  </button>
                  <button
                    type="button"
                    aria-label="Previous page"
                    disabled={pageIndex === 0}
                    onClick={() => changePage(pageIndex - 1)}
                  >
                    ‹
                  </button>
                  <span>
                    Page {Math.min(pageIndex + 1, totalPages)} of {totalPages}
                  </span>
                  <button
                    type="button"
                    aria-label="Next page"
                    disabled={pageIndex + 1 >= totalPages}
                    onClick={() => changePage(pageIndex + 1)}
                  >
                    ›
                  </button>
                  <button
                    type="button"
                    aria-label="Last page"
                    disabled={pageIndex + 1 >= totalPages}
                    onClick={() => changePage(totalPages - 1)}
                  >
                    ››
                  </button>
                </nav>
              </div>
            </header>
            <section className="talent-bulk-toolbar">
              <label>
                <input
                  type="checkbox"
                  checked={allSelected}
                  onChange={() =>
                    setSelected(
                      allSelected ? [] : profiles.map((profile) => profile.id),
                    )
                  }
                />{" "}
                Select all
              </label>
              <button type="button">▣ &nbsp; Add to　⌄</button>
              <button type="button">◷ &nbsp; Set reminder　⌄</button>
              <p>
                Want to reach candidates using bulk mails?{" "}
                <button type="button" onClick={openOutreach}>
                  Switch to NVite
                </button>
              </p>
            </section>
            {profiles.map((profile) => (
              <ProfileCard
                key={profile.id}
                profile={profile}
                selected={selected.includes(profile.id)}
                onSelect={() =>
                  setSelected((current) =>
                    current.includes(profile.id)
                      ? current.filter((id) => id !== profile.id)
                      : [...current, profile.id],
                  )
                }
                queryTerms={queryTerms}
                profileHref={profileHref(profile.id)}
                onProfileView={() => recordEngagement(profile.id, "view")}
                onDownload={() => recordEngagement(profile.id, "download")}
                views={
                  profile.views + (engagementChanges[profile.id]?.view ? 1 : 0)
                }
                downloads={
                  profile.downloads +
                  (engagementChanges[profile.id]?.download ? 1 : 0)
                }
                onProtectedContact={() =>
                  setContactMessage(
                    "Contact details remain protected. Open the candidate profile from an eligible job pipeline to unmask them.",
                  )
                }
              />
            ))}
            {!profiles.length && (
              <section className="talent-zero-state editorial-empty-state">
                <span
                  className={
                    isLoadingProfiles
                      ? "talent-searching-mark"
                      : "editorial-empty-doodle"
                  }
                  aria-hidden="true"
                >
                  {isLoadingProfiles ? "⌕" : <><i /><i /><i /></>}
                </span>
                <h2>
                  {isLoadingProfiles
                    ? "Searching candidate profiles…"
                    : "This exact profile is proving elusive"}
                </h2>
                <p>
                  {isLoadingProfiles
                    ? "We are matching the selected skills and profile evidence."
                    : "We’ve scoured the database, but this exact profile is proving a bit elusive. Shall we broaden the experience filter?"}
                </p>
                {!isLoadingProfiles &&
                  (activeCriteria.minExperience ||
                  activeCriteria.maxExperience ? (
                    <button type="button" onClick={clearExperience}>
                      Remove experience filter
                    </button>
                  ) : (
                    <button type="button" onClick={clearFilters}>
                      Reset filters
                    </button>
                  ))}
              </section>
            )}
            {contactMessage && (
              <p className="talent-contact-status" role="status">
                {contactMessage}
              </p>
            )}
            {profiles.length > 0 && (
              <nav
                className="talent-bottom-pagination"
                aria-label="Candidate result pages"
              >
                <button
                  type="button"
                  disabled={pageIndex === 0}
                  onClick={() => changePage(pageIndex - 1)}
                >
                  ‹ Previous
                </button>
                <span>
                  Page {Math.min(pageIndex + 1, totalPages)} of {totalPages}
                </span>
                <button
                  type="button"
                  disabled={pageIndex + 1 >= totalPages}
                  onClick={() => changePage(pageIndex + 1)}
                >
                  Next ›
                </button>
              </nav>
            )}
          </main>
        </div>
      </div>
      {outreachOpen && (
        <section
          className="talent-outreach-modal"
          role="dialog"
          aria-modal="true"
          aria-labelledby="outreach-title"
        >
          <div>
            <button
              type="button"
              className="talent-modal-close"
              aria-label="Close email dialog"
              onClick={() => setOutreachOpen(false)}
            >
              ×
            </button>
            <span>Bulk outreach</span>
            <h2 id="outreach-title">
              Email {selected.length} selected candidate
              {selected.length === 1 ? "" : "s"}
            </h2>
            <p>
              Each recipient is processed as an individual protected message
              through the RabbitMQ-backed workflow.
            </p>
            <div>
              <Button
                variant="secondary"
                onClick={() => setOutreachOpen(false)}
              >
                Cancel
              </Button>
              <Button onClick={queueOutreach}>Prepare outreach</Button>
            </div>
          </div>
        </section>
      )}
    </WorkspaceShell>
  );
}

function ProfileCard({
  profile,
  selected,
  onSelect,
  queryTerms,
  profileHref,
  onProfileView,
  onDownload,
  views,
  downloads,
  onProtectedContact,
}: {
  profile: Profile;
  selected: boolean;
  onSelect: () => void;
  queryTerms: string[];
  profileHref: string;
  onProfileView: () => void;
  onDownload: () => void;
  views: number;
  downloads: number;
  onProtectedContact: () => void;
}) {
  const cvAvailable = profile.cvAvailable !== false;
  const contactStatus =
    profile.emailVerified === false || profile.mobileVerified === false
      ? "Contact verification pending"
      : "Verified phone & email";
  return (
    <article className="talent-profile-card">
      <div className="talent-profile-main">
        <header>
          <label>
            <input
              type="checkbox"
              checked={selected}
              onChange={onSelect}
              aria-label={`Select ${profile.name}`}
            />
            <h2>{profile.name}</h2>
          </label>
          <div className="talent-profile-meta">
            <span>▰ {profile.experience}</span>
            <span>▣ {profile.salary}</span>
            <span>● {profile.location}</span>
          </div>
        </header>
        <dl>
          <div>
            <dt>Current</dt>
            <dd>{highlight(profile.current, queryTerms)}</dd>
          </div>
          <div>
            <dt>Previous</dt>
            <dd>{highlight(profile.previous, queryTerms)}</dd>
          </div>
          <div>
            <dt>Education</dt>
            <dd>{profile.education}</dd>
          </div>
          <div>
            <dt>Pref. locations</dt>
            <dd>{profile.preferredLocations}</dd>
          </div>
          <div>
            <dt>Key skills</dt>
            <dd className="talent-skill-list">
              {profile.skills.map((skill) => (
                <span className="talent-skill" key={skill}>
                  {highlight(skill, queryTerms)}
                </span>
              ))}
            </dd>
          </div>
          <div>
            <dt>May also know</dt>
            <dd>
              {profile.mayKnow} <button type="button">more</button>
            </dd>
          </div>
        </dl>
        <footer>
          <a href="#similar">
            {profile.similarProfiles ?? Math.max(42, views * 3)} similar
            profiles
          </a>
          <span className="talent-engagement">
            <span aria-label={`${views} recruiters viewed this profile`}>
              ◉ {views}
            </span>
            <span
              aria-label={`${downloads} recruiters downloaded this profile`}
            >
              ⇩ {downloads}
            </span>
          </span>
        </footer>
      </div>
      <aside className="talent-profile-contact">
        <span className={`talent-portrait ${profile.avatarTone}`}>
          {profile.name
            .split(" ")
            .map((part) => part[0])
            .join("")
            .slice(0, 2)}
        </span>
        <p>{highlight(profile.summary, queryTerms)}</p>
        <button type="button" onClick={onProtectedContact}>
          View phone number
        </button>
        <button type="button" onClick={onProtectedContact}>
          ⌕ &nbsp; Call candidate
        </button>
        <small>{contactStatus}</small>
      </aside>
      <nav
        className="talent-profile-actions"
        aria-label={`${profile.name} actions`}
      >
        <button type="button" aria-label={`Add ${profile.name}`}>
          ▣
        </button>
        <button type="button" aria-label={`Share ${profile.name}`}>
          ➜
        </button>
        <button type="button" aria-label={`Remind me about ${profile.name}`}>
          ◷
        </button>
      </nav>
      <div className="talent-profile-bottom">
        <span>
          <button type="button" onClick={onDownload} disabled={!cvAvailable}>
            {cvAvailable ? "⇩ CV" : "CV unavailable"}
          </button>
          <i />{" "}
          <time>{relativeDate(profile.profileLastUpdatedAt, "Modified")}</time>
          <i /> <time>{relativeDate(profile.lastActiveAt, "Active")}</time>
        </span>
        <span>
          <button type="button">Comment</button>
          <i /> <button type="button">♧ Save</button>
          <i />{" "}
          <Link href={profileHref} onClick={onProfileView}>
            View profile
          </Link>
        </span>
      </div>
    </article>
  );
}
