import { expect, test } from "@playwright/test";

const now = new Date().toISOString();

test("recruiters can save searches and run interviews from the Recruitment Workspace", async ({ page }) => {
  let savedSearch: { id: string; name: string; criteria: { expression: string }; alertFrequency: string; updatedAt: string } | null = null;
  const poolMembers: Array<{ candidateId: string; fullName: string; headline: string; location: string; tags: string[]; ownerName: string | null; reminderAt: string | null; note: string | null; nextAction: string; experienceYears: number; expectedSalaryLakhs: number; noticePeriodDays: number; skills: string[]; emailVerified: boolean; mobileVerified: boolean; lastActiveAt: string; profileUpdatedAt: string; updatedAt: string }> = [{ candidateId: "candidate-1", fullName: "Asha Kumar", headline: "Senior backend engineer", location: "Bengaluru", tags: ["Priority"], ownerName: "Alex Recruiter", reminderAt: null, note: "@Sam review portfolio", nextAction: "Phone screen", experienceYears: 6, expectedSalaryLakhs: 24, noticePeriodDays: 30, skills: ["Node.js", "TypeScript"], emailVerified: true, mobileVerified: true, lastActiveAt: now, profileUpdatedAt: now, updatedAt: now }];
  const campaigns: Array<{ id: string; name: string; subject: string; status: string; recipientCount: number; sentCount: number; repliedCount: number; optedOutCount: number; replyRate: number; jobId: string | null; jobTitle: string | null; updatedAt: string }> = [];
  const interviews: Array<{ id: string; applicationId: string; candidateName: string; jobTitle: string; platformName: string; meetingLink: string; scheduledAt: string; durationMinutes: number; status: string; scorecards: Array<{ id: string; recruiterName: string; recommendation: string; score: number; feedback: string; submittedAt: string }> }> = [];
  await page.route("**/api/auth/csrf", (route) => route.fulfill({ status: 200, json: { token: "test-csrf" } }));
  await page.route("**/api/recruiter/pipeline**", (route) => route.fulfill({ status: 200, json: { content: [{ applicationId: "2fbd4be4-1bf2-4a1d-918d-500000000001", candidateId: "candidate-1", fullName: "Asha Kumar", headline: "Senior backend engineer", jobId: "SWX-100", jobTitle: "Backend Engineer", pipelineStage: "INTERVIEWING" }] } }));
  await page.route("**/api/recruiter/jobs**", (route) => route.fulfill({ status: 200, json: { content: [{ jobId: "SWX-100", title: "Backend Engineer", status: "ACTIVE", location: "Bengaluru" }] } }));
  await page.route("**/api/recruiter/sourcing/search", (route) => route.fulfill({ status: 200, json: { content: [{ candidateId: "candidate-2", fullName: "Mira Patel", headline: "Platform engineer", location: "Pune", overallExperienceYears: 5, expectedSalaryLakhs: 22, noticePeriodDays: 30, skills: "Java, AWS", emailVerified: true, mobileVerified: true, profileLastUpdatedAt: now, lastActiveAt: now, relevanceScore: 0.91 }] } }));
  await page.route("**/api/recruiter/interviews", async (route) => {
    const request = route.request().postDataJSON() as { applicationId: string; platformName: string; meetingLink: string; scheduledAt: string; durationMinutes: number };
    interviews.push({ id: "interview-1", applicationId: request.applicationId, candidateName: "Asha Kumar", jobTitle: "Backend Engineer", platformName: request.platformName, meetingLink: request.meetingLink, scheduledAt: request.scheduledAt, durationMinutes: request.durationMinutes, status: "SCHEDULED", scorecards: [] });
    return route.fulfill({ status: 201, json: interviews[0] });
  });
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
    if (path.endsWith("/talent-pools")) return route.fulfill({ status: 200, json: [{ id: "pool-1", name: "Platform shortlist", description: "Shared backend candidates", jobId: "SWX-100", jobTitle: "Backend Engineer", candidateCount: poolMembers.length, updatedAt: now }] });
    if (path.endsWith("/talent-pools/pool-1/members")) {
      if (method === "PUT") {
        const request = route.request().postDataJSON() as { candidateId: string; tags: string[]; nextAction: string };
        poolMembers.push({ candidateId: request.candidateId, fullName: "Mira Patel", headline: "Platform engineer", location: "Pune", tags: request.tags, ownerName: null, reminderAt: null, note: null, nextAction: request.nextAction, experienceYears: 5, expectedSalaryLakhs: 22, noticePeriodDays: 30, skills: ["Java", "AWS"], emailVerified: true, mobileVerified: true, lastActiveAt: now, profileUpdatedAt: now, updatedAt: now });
        return route.fulfill({ status: 200, json: poolMembers.at(-1) });
      }
      return route.fulfill({ status: 200, json: poolMembers });
    }
    if (path.endsWith("/campaigns")) {
      if (method === "POST") { const request = route.request().postDataJSON() as { name: string; subject: string; candidateIds: string[]; jobId: string }; campaigns.push({ id: "campaign-1", name: request.name, subject: request.subject, status: "DRAFT", recipientCount: request.candidateIds.length, sentCount: 0, repliedCount: 0, optedOutCount: 0, replyRate: 0, jobId: request.jobId, jobTitle: "Backend Engineer", updatedAt: now }); return route.fulfill({ status: 201, json: campaigns[0] }); }
      return route.fulfill({ status: 200, json: campaigns });
    }
    if (path.endsWith("/campaigns/campaign-1/launch")) { campaigns[0].status = "SENT"; campaigns[0].sentCount = campaigns[0].recipientCount; return route.fulfill({ status: 200, json: campaigns[0] }); }
    if (path.endsWith("/interviews")) return route.fulfill({ status: 200, json: interviews });
    if (path.endsWith("/interview-scorecards") && method === "POST") {
      const request = route.request().postDataJSON() as { interviewId: string; recommendation: string; score: number; feedback: string };
      interviews[0].scorecards = [{ id: "scorecard-1", recruiterName: "Alex Recruiter", recommendation: request.recommendation, score: request.score, feedback: request.feedback, submittedAt: now }];
      return route.fulfill({ status: 201, json: interviews[0].scorecards[0] });
    }
    if (path.includes("/interviews/interview-1") && method === "PATCH") { const request = route.request().postDataJSON() as { scheduledAt?: string; status?: string }; if (request.scheduledAt) interviews[0].scheduledAt = request.scheduledAt; if (request.status) interviews[0].status = request.status; return route.fulfill({ status: 200, json: interviews[0] }); }
    if (path.endsWith("/analytics")) return route.fulfill({ status: 200, json: { savedSearches: 0, talentPools: 1, candidatesInPools: poolMembers.length, activeCampaigns: campaigns.length, campaignsSent: campaigns.reduce((total, campaign) => total + campaign.sentCount, 0), interviewsThisWeek: interviews.length, scorecardsSubmitted: interviews.reduce((total, interview) => total + interview.scorecards.length, 0), dueReminders: 1, campaignReplies: 0, pendingScorecards: interviews.filter((interview) => !interview.scorecards.length).length, upcomingInterviews: interviews.length } });
    if (path.endsWith("/organisation-controls")) return route.fulfill({ status: 200, json: { currentUserRole: "ORG_ADMIN", candidateRetentionDays: 365, auditRetentionDays: 730, savedSearchAlertsEnabled: true, campaignsEnabled: true, updatedAt: now, members: [{ recruiterId: "recruiter-1", fullName: "Alex Recruiter", officialEmail: "alex@example.test", workspaceRole: "ORG_ADMIN" }] } });
    return route.fulfill({ status: 404, json: { detail: "Unexpected workflow request" } });
  });

  await page.goto("/recruiter/workbench");

  await expect(page.getByRole("heading", { name: "Recruitment workspace" })).toBeVisible();
  await expect(page.getByRole("link", { name: "Recruitment Workspace" })).toBeVisible();
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
  await expect(page.getByLabel("Candidate from sourcing")).toBeVisible();
  await expect(page.getByText("Candidate ID from sourcing")).toHaveCount(0);
  await page.getByLabel("Candidate from sourcing").selectOption("candidate-2");
  await page.getByLabel("Candidate next action").fill("Review AWS depth");
  await page.getByRole("button", { name: "Add to pool" }).click();
  await expect(page.getByText("Mira Patel", { exact: true })).toBeVisible();

  await page.getByRole("tab", { name: "Campaigns" }).click();
  await page.getByLabel("Campaign hiring role").selectOption("SWX-100");
  await page.getByLabel("Campaign name").fill("Platform outreach");
  await page.getByLabel("Subject").fill("Backend Engineer opportunity");
  await page.getByLabel("Message").fill("Hi {{first_name}}, your profile matches our platform role.");
  await page.getByRole("button", { name: "Create campaign" }).click();
  await expect(page.getByText("Platform outreach", { exact: true })).toBeVisible();

  await page.getByRole("link", { name: "Interviews" }).click();
  await expect(page).toHaveURL(/\/recruiter\/workbench#interviews/);
  await expect(page.getByRole("heading", { name: "Schedule interview" })).toBeVisible();
  await page.getByLabel("Candidate application").selectOption("2fbd4be4-1bf2-4a1d-918d-500000000001");
  await page.getByLabel("Interview format").selectOption("Google Meet");
  await page.getByLabel("Interview date and time").fill(new Date(Date.now() + 86_400_000).toISOString().slice(0, 16));
  await page.getByLabel("Meeting link or location").fill("https://meet.example.com/asha");
  await page.getByRole("button", { name: "Schedule and notify candidate" }).click();
  await expect(page.getByText("Interview scheduled. The candidate has been notified and the meeting is now in your workspace.")).toBeVisible();
  await expect(page.getByRole("link", { name: "Join meeting" })).toHaveAttribute("href", "https://meet.example.com/asha");
  await page.getByLabel("Feedback").fill("Strong systems evidence and clear trade-off decisions.");
  await page.getByRole("button", { name: "Save scorecard" }).click();
  await expect(page.getByText("Interview scorecard saved.")).toBeVisible();
  await expect(page.getByText("1 scorecard submitted")).toBeVisible();
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
