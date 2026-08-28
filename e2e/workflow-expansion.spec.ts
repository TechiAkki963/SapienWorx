import { expect, test } from "@playwright/test";

const now = new Date().toISOString();

test("recruiters can save searches and navigate the shared talent workspace", async ({ page }) => {
  let savedSearch: { id: string; name: string; criteria: { expression: string }; alertFrequency: string; updatedAt: string } | null = null;
  await page.route("**/api/auth/csrf", (route) => route.fulfill({ status: 200, json: { token: "test-csrf" } }));
  await page.route("**/api/recruiter/workflow/**", async (route) => {
    const path = new URL(route.request().url()).pathname;
    const method = route.request().method();
    if (path.endsWith("/saved-searches")) {
      if (method === "POST") {
        savedSearch = { id: "search-1", name: "Backend engineers", criteria: { expression: "Node.js AND TypeScript" }, alertFrequency: "DAILY", updatedAt: now };
        return route.fulfill({ status: 201, json: savedSearch });
      }
      return route.fulfill({ status: 200, json: savedSearch ? [savedSearch] : [] });
    }
    if (path.endsWith("/talent-pools")) return route.fulfill({ status: 200, json: [{ id: "pool-1", name: "Platform shortlist", description: "Shared backend candidates", candidateCount: 1, updatedAt: now }] });
    if (path.endsWith("/talent-pools/pool-1/members")) return route.fulfill({ status: 200, json: [{ candidateId: "candidate-1", fullName: "Asha Kumar", headline: "Senior backend engineer", location: "Bengaluru", tags: ["Priority"], ownerName: "Alex Recruiter", reminderAt: null, note: "@Sam review portfolio", updatedAt: now }] });
    if (path.endsWith("/campaigns")) return route.fulfill({ status: 200, json: [] });
    if (path.endsWith("/interviews")) return route.fulfill({ status: 200, json: [] });
    if (path.endsWith("/analytics")) return route.fulfill({ status: 200, json: { savedSearches: 0, talentPools: 1, candidatesInPools: 1, activeCampaigns: 0, campaignsSent: 0, interviewsThisWeek: 0, scorecardsSubmitted: 0 } });
    if (path.endsWith("/organisation-controls")) return route.fulfill({ status: 200, json: { currentUserRole: "ORG_ADMIN", candidateRetentionDays: 365, auditRetentionDays: 730, savedSearchAlertsEnabled: true, campaignsEnabled: true, updatedAt: now, members: [] } });
    return route.fulfill({ status: 404, json: { detail: "Unexpected workflow request" } });
  });

  await page.goto("/recruiter/workbench");

  await expect(page.getByRole("heading", { name: "Recruitment workspace" })).toBeVisible();
  await expect(page.getByText("People in pools", { exact: true })).toBeVisible();
  await page.getByLabel("Search name").fill("Backend engineers");
  await page.getByLabel("Search criteria").fill("Node.js AND TypeScript");
  await page.getByRole("button", { name: "Save search" }).click();
  await expect(page.getByText("Saved search created. Alerts will use its stored criteria.", { exact: true })).toBeVisible();
  await expect(page.getByText("Backend engineers", { exact: true })).toBeVisible();

  await page.getByRole("tab", { name: "Talent pools" }).click();
  await expect(page.getByRole("heading", { name: "Talent pools" })).toBeVisible();
  await expect(page.getByText("Asha Kumar", { exact: true })).toBeVisible();
  await expect(page.getByText("@Sam review portfolio", { exact: true })).toBeVisible();
});

test("candidates can inspect their timeline and exercise privacy controls", async ({ page }) => {
  let privacy = { profileSearchable: true, automationConsent: false, outreachOptOut: false, dataExportRequestedAt: null as string | null, deletionRequestedAt: null as string | null, updatedAt: now };
  await page.addInitScript(() => localStorage.setItem("sapienworx.local-candidate-domain", "TECH"));
  await page.route("**/api/auth/csrf", (route) => route.fulfill({ status: 200, json: { token: "test-csrf" } }));
  await page.route("**/api/candidate/applications/summary", (route) => route.fulfill({ status: 200, json: { totalApplications: 1, activeApplications: 1, interviewApplications: 1, offerApplications: 0 } }));
  await page.route("**/api/candidate/applications/application-1/timeline", (route) => route.fulfill({ status: 200, json: { applicationId: "application-1", stage: "INTERVIEWING", nextStep: "Choose an interview time with the hiring team.", events: [{ type: "APPLICATION_SUBMITTED", summary: "Application submitted to Nexora Cloud", occurredAt: now }], interviews: [{ id: "interview-1", platformName: "Google Meet", meetingLink: "https://meet.example.test/interview-1", scheduledAt: now, durationMinutes: 45, status: "SCHEDULED" }] } }));
  await page.route("**/api/candidate/applications?page=0", (route) => route.fulfill({ status: 200, json: { content: [{ applicationId: "application-1", jobId: "SWX-100", title: "Senior Backend Engineer", companyName: "Nexora Cloud", location: "Bengaluru", recruiterName: "Alex Recruiter", recruiterTitle: "Talent Partner", stage: "INTERVIEWING", appliedAt: now, updatedAt: now }], totalPages: 1, totalElements: 1, number: 0, first: true, last: true } }));
  await page.route("**/api/candidate/privacy**", async (route) => {
    const path = new URL(route.request().url()).pathname;
    if (route.request().method() === "GET") return route.fulfill({ status: 200, json: privacy });
    if (path.endsWith("/data-export")) privacy = { ...privacy, dataExportRequestedAt: now };
    if (route.request().method() === "PATCH") privacy = { ...privacy, ...route.request().postDataJSON() };
    return route.fulfill({ status: 200, json: privacy });
  });

  await page.goto("/candidate/applications");
  await page.getByRole("button", { name: "View timeline" }).click();
  await expect(page.locator(".candidate-application-next-step")).toContainText("Choose an interview time");
  await expect(page.getByRole("link", { name: "Open meeting link" })).toBeVisible();

  await page.goto("/candidate/settings");
  await expect(page.getByRole("heading", { name: "Settings and privacy" })).toBeVisible();
  await page.getByRole("button", { name: /Download my data/ }).click();
  await expect(page.getByRole("status")).toContainText("data export request has been recorded");
  await expect(page.getByText("Export requested", { exact: true })).toBeVisible();
});

test("candidate and recruiter reports expose role-specific conversion data", async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem("sapienworx.local-candidate-domain", "TECH"));
  await page.route("**/api/candidate/reports?**", (route) => route.fulfill({ status: 200, json: {
    rangeDays: 90, candidate: "Asha Kumar", generatedAt: now,
    metrics: { profileViews: 18, resumeDownloads: 5, applications: 4, interviews: 2, offers: 1, referralsShared: 2, successfulReferrals: 1, profileCompleteness: 90, applicationToInterviewRate: 50, interviewToOfferRate: 50 },
    funnel: [{ stage: "APPLIED", count: 1, percent: 25 }, { stage: "INTERVIEWING", count: 2, percent: 50 }, { stage: "OFFER", count: 1, percent: 25 }],
    applicationTrend: [{ period: "24 Aug", value: 4 }], engagementTrend: [],
    recentApplications: [{ id: "application-1", jobId: "SWX-100", title: "Senior Backend Engineer", organisation: "Nexora Cloud", stage: "INTERVIEWING", appliedAt: now, updatedAt: now }],
    insights: ["Keep your availability current."],
  } }));
  await page.goto("/candidate/reports");
  await expect(page.getByRole("heading", { name: "My reports" })).toBeVisible();
  await expect(page.getByText("Senior Backend Engineer", { exact: true })).toBeVisible();
  await expect(page.getByText("90%", { exact: true })).toBeVisible();

  await page.route("**/api/recruiter/reports?**", (route) => route.fulfill({ status: 200, json: {
    rangeDays: 90, recruiter: "Alex Recruiter", organisation: "Nexora Cloud", generatedAt: now,
    metrics: { activeJobs: 3, applications: 20, interviews: 8, offers: 3, onboarded: 2, candidateProfilesViewed: 40, resumesDownloaded: 12, outreachSent: 30, outreachReplies: 8, applicationToOfferRate: 15, offerToHireRate: 67, outreachReplyRate: 27, averagePipelineUpdateHours: 8.5 },
    funnel: [{ stage: "APPLIED", count: 10, percent: 50 }, { stage: "INTERVIEWING", count: 7, percent: 35 }, { stage: "OFFER", count: 3, percent: 15 }],
    applicationTrend: [{ period: "24 Aug", applications: 20, offers: 3 }],
    jobPerformance: [{ jobId: "SWX-100", title: "Senior Backend Engineer", status: "ACTIVE", publishedAt: now, applicants: 20, offers: 3, hires: 2 }],
    campaigns: [{ id: "campaign-1", name: "Backend shortlist", status: "COMPLETED", recipients: 30, delivered: 30, replies: 8, updatedAt: now }],
    insights: ["Monitor response time each week."],
  } }));
  await page.goto("/recruiter/reports");
  await expect(page.getByRole("heading", { name: "Hiring reports" })).toBeVisible();
  await expect(page.getByText("Backend shortlist", { exact: true })).toBeVisible();
  await expect(page.getByText("27%", { exact: true })).toBeVisible();
});

test("Master Access groups alerts, approvals, releases, integrations and billing", async ({ page }) => {
  await page.route("**/api/admin/master/**", (route) => {
    const path = new URL(route.request().url()).pathname;
    if (path.endsWith("/dashboard")) return route.fulfill({ status: 200, json: { candidates: 10, recruiters: 4, organisations: 2, jobs: 6, auditEvents: 20, activeJobs: 3, openSupportTickets: 1, privacyRequests: 0, deadLetters: 0 } });
    if (path.endsWith("/controls")) return route.fulfill({ status: 200, json: { maintenanceMode: false, candidateSignupEnabled: true, recruiterSignupEnabled: true, cvParsingEnabled: true, campaignsEnabled: true, updatedAt: now } });
    if (path.endsWith("/data-quality") || path.endsWith("/security")) return route.fulfill({ status: 200, json: {} });
    return route.fulfill({ status: 200, json: [] });
  });
  await page.route("**/api/admin/governance", (route) => route.fulfill({ status: 200, json: {
    currentAdmin: { id: "admin-1", displayName: "Platform Owner", email: "owner@example.test", role: "OWNER", permissions: ["*"], active: true, lastSignedInAt: now },
    admins: [{ id: "admin-1", displayName: "Platform Owner", email: "owner@example.test", role: "OWNER", permissions: ["*"], active: true, lastSignedInAt: now }],
    approvals: [], alerts: [{ key: "candidate-profile-quality", severity: "LOW", title: "Candidate profile quality", description: "3 profiles need attention.", source: "Data quality", status: "OPEN", note: "", updatedAt: "" }],
    securityPolicy: { adminMfaRequired: true, suspiciousLoginDetectionEnabled: true, ipAllowlistEnabled: false, allowedIpRanges: "", minimumPasswordLength: 12, sessionDurationMinutes: 480, maximumFailedAttempts: 5, supportAccessRequiresConsent: true, updatedAt: now },
    moderationCases: [], featureFlags: [{ key: "candidate_reports", label: "Candidate reports", description: "Candidate reporting.", enabled: true, rolloutPercent: 100, organisationId: "", organisation: "", scheduledAt: "", updatedAt: now }],
    integrations: [{ id: "integration-1", name: "ATS gateway", kind: "WEBHOOK", status: "CONFIGURED", endpoint: "", secretReference: "env://ATS_SECRET", lastCheckedAt: now, lastError: "" }],
    billingPlans: [{ organisationId: "organisation-1", organisation: "Nexora Cloud", planName: "BUSINESS", recruiterSeatLimit: 10, seatsUsed: 4, monthlyJobCreditLimit: 50, jobsThisMonth: 6, invoiceStatus: "CURRENT", renewalAt: now, updatedAt: now }],
    supportAccess: [], business: { candidateActivationRate: 82, recruiterActivationRate: 100, applicationToOfferRate: 15, offerToOnboardRate: 67 },
  } }));

  await page.goto("/admin#advanced");
  await expect(page.getByRole("heading", { name: "Control, assurance, and commercial operations" })).toBeVisible();
  await expect(page.getByText("Candidate profile quality", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Releases & integrations" }).click();
  await expect(page.getByText("Candidate reports", { exact: true })).toBeVisible();
  await expect(page.getByText("ATS gateway", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Business & billing" }).click();
  await expect(page.getByText("Nexora Cloud", { exact: true })).toBeVisible();
});
