export type CandidateDomainCategory = "TECH" | "NON_TECH" | "MIXED_AMBIGUOUS" | "UNASSIGNED";

export type CandidateDomainResponse = {
  domainCategory: CandidateDomainCategory;
};

const apiBaseUrl = (process.env.NEXT_PUBLIC_API_BASE_URL ?? "").replace(/\/$/, "");

function endpoint(path: string) {
  return `${apiBaseUrl}${path}`;
}

function csrfToken() {
  if (typeof document === "undefined") return undefined;
  return document.cookie
    .split("; ")
    .find((cookie) => cookie.startsWith("XSRF-TOKEN="))
    ?.split("=")[1];
}

async function responseError(response: Response) {
  const detail = await response.json().catch(() => null) as { detail?: string; message?: string } | null;
  return new Error(detail?.detail ?? detail?.message ?? "We could not verify your profile domain. Please try again.");
}

export async function getCandidateDomain(signal?: AbortSignal): Promise<CandidateDomainResponse> {
  const response = await fetch(endpoint("/api/candidate/domain"), {
    credentials: "include",
    cache: "no-store",
    signal,
  });
  if (!response.ok) throw await responseError(response);
  return response.json() as Promise<CandidateDomainResponse>;
}

export async function resolveCandidateDomain(domainCategory: "TECH" | "NON_TECH"): Promise<CandidateDomainResponse> {
  const token = csrfToken();
  const response = await fetch(endpoint("/api/candidate/domain"), {
    method: "PATCH",
    credentials: "include",
    headers: {
      "Content-Type": "application/json",
      ...(token ? { "X-XSRF-TOKEN": decodeURIComponent(token) } : {}),
    },
    body: JSON.stringify({ domainCategory }),
  });
  if (!response.ok) throw await responseError(response);
  return response.json() as Promise<CandidateDomainResponse>;
}
