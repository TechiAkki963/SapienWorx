import "server-only";

import { headers } from "next/headers";
import { cache } from "react";

const apiOrigin = (process.env.SAPIENWORX_API_URL ?? process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:8080").replace(/\/$/, "");

export type ApiPage<T> = { content: T[]; totalElements: number; totalPages: number; number: number };
export type ApiJob = {
  jobId: string; title: string; organisationName: string; location: string; department: string;
  minimumExperienceYears: number; maximumExperienceYears: number; minimumSalaryLakhs: number | null; maximumSalaryLakhs: number | null;
  salaryVisible: boolean; descriptionHtml: string; skills: string[]; status: string; publicPath: string; publishedAt: string | null;
};
export type CandidateDashboardSnapshot = {
  profile: { fullName: string; headline: string | null; domainCategory: string; profileSearchable: boolean; profileLastUpdatedAt: string | null; lastActiveAt: string | null };
  performance: { rangeDays: number; profileAppearances: number; recruiterActions: number; profileViews: number; resumeDownloads: number; profileAppearancesInRange: number; recruiterActionsInRange: number; appearanceChangePercent: number; actionChangePercent: number; profileCompleteness: number; activityLevel: "HIGH" | "MEDIUM" | "BUILDING" };
  recruiterActivity: Array<{ recruiterName: string; recruiterTitle: string | null; organisationName: string; action: "PROFILE_VIEWED" | "RESUME_DOWNLOADED"; occurredAt: string }>;
  applications: Array<{ applicationId: string; title: string; companyName: string; stage: string; updatedAt: string }>;
};
export type RecruiterDashboardSnapshot = {
  openPositions: number; activeApplications: number; draftJobs: number;
  funnel: Record<string, number>;
  upcomingInterviews: Array<{ candidateName: string; jobTitle: string; platformName: string; meetingLink: string; scheduledAt: string; durationMinutes: number }>;
};

async function serverFetch<T>(path: string, authenticated = false): Promise<T | null> {
  try {
    const requestHeaders = authenticated ? await headers() : undefined;
    const cookie = requestHeaders?.get("cookie");
    const response = await fetch(`${apiOrigin}${path}`, {
      headers: cookie ? { cookie } : undefined,
      cache: "no-store",
    });
    if (!response.ok) return null;
    return response.json() as Promise<T>;
  } catch {
    // The UI retains its graceful empty state while infrastructure is starting.
    return null;
  }
}

export async function getPublicJobs(keywords = "") {
  return serverFetch<ApiPage<ApiJob>>(`/api/public/jobs${keywords ? `?keywords=${encodeURIComponent(keywords)}` : ""}`);
}

export const getPublicJob = cache(async (jobId: string) => {
  return serverFetch<ApiJob>(`/api/public/jobs/${encodeURIComponent(jobId)}`);
});

export async function getCandidateDashboardSnapshot(): Promise<CandidateDashboardSnapshot | null> {
  return serverFetch<CandidateDashboardSnapshot>("/api/candidate/dashboard?rangeDays=90", true);
}

export async function getRecruiterDashboardSnapshot() {
  return serverFetch<RecruiterDashboardSnapshot>("/api/recruiter/dashboard", true);
}
