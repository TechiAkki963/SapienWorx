export type RecruiterSearchState = {
  anyKeywords: string;
  allKeywords: string;
  excludeKeywords: string;
  booleanQuery: string;
  minExperience: string;
  maxExperience: string;
  minSalary: string;
  maxSalary: string;
  company: string;
  designation: string;
  departmentRole: string;
  industry: string;
  location: string;
  ugMode: "any" | "specific" | "none";
  qualification: string;
  institution: string;
  educationTypes: string[];
  gender: "" | "female" | "male" | "non-binary";
  requireGithub: boolean;
  requireLeetcode: boolean;
  requirePortfolio: boolean;
  activeStatus: "ONE_DAY" | "THREE_DAYS" | "SEVEN_DAYS" | "FIFTEEN_DAYS" | "THIRTY_DAYS" | "SIXTY_DAYS" | "NINETY_DAYS" | "ONE_YEAR" | "ALL";
};

export const defaultRecruiterSearch: RecruiterSearchState = {
  anyKeywords: "", allKeywords: "Figma", excludeKeywords: "", booleanQuery: "", minExperience: "", maxExperience: "", minSalary: "", maxSalary: "",
  company: "", designation: "", departmentRole: "", industry: "", location: "", ugMode: "any", qualification: "", institution: "", educationTypes: [], gender: "",
  requireGithub: false, requireLeetcode: false, requirePortfolio: false,
  activeStatus: "SEVEN_DAYS",
};

export function keywordList(value: string) {
  return value.split(/[\n,]+/).map((item) => item.trim()).filter(Boolean);
}

export function stateFromSearchParams(params: Pick<URLSearchParams, "get">): RecruiterSearchState {
  const string = (name: keyof RecruiterSearchState) => params.get(name) ?? "";
  const bool = (name: "requireGithub" | "requireLeetcode" | "requirePortfolio") => params.get(name) === "true";
  const ugMode = params.get("ugMode");
  const gender = params.get("gender");
  const activeStatus = params.get("activeStatus");
  return {
    ...defaultRecruiterSearch,
    anyKeywords: string("anyKeywords"), allKeywords: string("allKeywords"), excludeKeywords: string("excludeKeywords"), booleanQuery: string("booleanQuery"),
    minExperience: string("minExperience"), maxExperience: string("maxExperience"), minSalary: string("minSalary"), maxSalary: string("maxSalary"),
    company: string("company"), designation: string("designation"), departmentRole: string("departmentRole"), industry: string("industry"), location: string("location"), qualification: string("qualification"), institution: string("institution"),
    educationTypes: params.get("educationTypes")?.split(",").filter(Boolean) ?? [],
    ugMode: ugMode === "specific" || ugMode === "none" ? ugMode : "any",
    gender: gender === "female" || gender === "male" || gender === "non-binary" ? gender : "",
    requireGithub: bool("requireGithub"), requireLeetcode: bool("requireLeetcode"), requirePortfolio: bool("requirePortfolio"),
    activeStatus: activeStatus === "ONE_DAY" || activeStatus === "THREE_DAYS" || activeStatus === "SEVEN_DAYS" || activeStatus === "FIFTEEN_DAYS" || activeStatus === "THIRTY_DAYS" || activeStatus === "SIXTY_DAYS" || activeStatus === "NINETY_DAYS" || activeStatus === "ONE_YEAR" || activeStatus === "ALL" ? activeStatus : "SEVEN_DAYS",
  };
}

export function searchParamsFor(state: RecruiterSearchState) {
  const params = new URLSearchParams();
  (Object.entries(state) as Array<[keyof RecruiterSearchState, RecruiterSearchState[keyof RecruiterSearchState]]>).forEach(([key, value]) => {
    if (Array.isArray(value) && value.length) params.set(key, value.join(","));
    else if (typeof value === "boolean" && value) params.set(key, "true");
    else if (typeof value === "string" && value) params.set(key, value);
  });
  return params;
}

export function sourceRequest(state: RecruiterSearchState, page: number, pageSize: number, refinements: { activeInLast15Days?: boolean; maximumNoticePeriodDays?: number | null; minimumSalaryLakhs?: number | null; maximumSalaryLakhs?: number | null } = {}) {
  return {
    anyKeywords: keywordList(state.anyKeywords),
    allKeywords: keywordList(state.allKeywords),
    excludeKeywords: keywordList(state.excludeKeywords),
    booleanQuery: state.booleanQuery || null,
    minimumExperienceYears: state.minExperience ? Number(state.minExperience) : null,
    maximumExperienceYears: state.maxExperience ? Number(state.maxExperience) : null,
    minimumSalaryLakhs: refinements.minimumSalaryLakhs ?? (state.minSalary ? Number(state.minSalary) : null),
    maximumSalaryLakhs: refinements.maximumSalaryLakhs ?? (state.maxSalary ? Number(state.maxSalary) : null),
    location: state.location || null,
    company: state.company || null,
    designation: state.designation || null,
    departmentRole: state.departmentRole || null,
    industry: state.industry || null,
    qualification: state.ugMode === "specific" ? state.qualification || null : null,
    bachelorsInstitution: state.institution || null,
    mastersInstitution: null,
    educationTypes: state.educationTypes,
    gender: state.gender || null,
    maximumNoticePeriodDays: refinements.maximumNoticePeriodDays ?? null,
    activeStatus: refinements.activeInLast15Days ? "FIFTEEN_DAYS" : state.activeStatus,
    requireGithub: state.requireGithub,
    requireLeetcode: state.requireLeetcode,
    requirePortfolio: state.requirePortfolio,
    page,
    pageSize,
  };
}
