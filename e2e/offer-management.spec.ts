import { expect, test } from "@playwright/test";

const applicant = {
  applicationId: "application-1", candidateId: "candidate-1", jobId: "SWX_NT_201", jobTitle: "Platform Engineer",
  fullName: "Taylor Tech", headline: "Backend Engineer", currentCompany: "Sapienworx Labs", previousRole: "Software Engineer",
  previousCompany: "QA Platform Services", departmentRole: "Engineering", industry: "Software product", highestEducation: "B.Tech · QA Institute 2024",
  location: "Bengaluru", preferredLocations: ["Bengaluru", "Remote"], overallExperienceYears: 4, expectedSalaryLakhs: 18,
  noticePeriodDays: 30, skills: ["Java", "Spring Boot", "RabbitMQ"], workLinks: [], profileSummary: "Backend engineer.",
  emailVerified: true, mobileVerified: true, cvAvailable: true, maskedEmail: "t••••@sapienworx.qa", maskedMobile: "+••••••021",
  pipelineStage: "OFFER", applicationSource: "DIRECT", referralCode: null, appliedAt: "2026-08-20T08:00:00Z",
  applicationUpdatedAt: "2026-08-30T08:00:00Z", lastActiveAt: "2026-08-30T07:00:00Z", profileLastUpdatedAt: "2026-08-28T07:00:00Z",
  postingRecruiterId: "recruiter-1", postingRecruiterName: "Alex Recruiter", assignedRecruiterId: "recruiter-1",
  assignedRecruiterName: "Alex Recruiter", currentUserCanManage: true,
  organisationMembers: [{ recruiterId: "recruiter-1", fullName: "Alex Recruiter", designation: "Senior Recruiter" }, { recruiterId: "recruiter-2", fullName: "Sam Recruiter", designation: "Talent Partner" }],
  decisionReadiness: { requiredApprovals: 1, expectedReviewers: 1, submittedScorecards: 1, positiveApprovals: 1, averageScore: 4, missingReviewerNames: [], conflictingRecommendations: false, offerReady: true, blockers: [] },
  recentNotes: [], timeline: [], interviews: [],
};

const baseOffer = {
  offerId: "offer-1", applicationId: "application-1", jobId: "SWX_NT_201", jobTitle: "Platform Engineer", candidateName: "Taylor Tech",
  status: "DRAFT", version: 1, designation: "Platform Engineer", joiningDate: "2026-09-14", workplaceModel: "HYBRID", probationMonths: 6,
  noticeBuyout: false, expiresAt: "2026-09-03T12:00:00Z", currency: "INR", annualFixedAmount: 1800000, annualVariableAmount: 200000,
  joiningBonus: 0, retentionBonus: 0, otherCompensation: "Health cover", candidateMessage: "We would be delighted to have you join us.",
  termsText: "Subject to successful joining checks.", sentAt: null, respondedAt: null, responseNote: null, editable: true, submittable: true,
  sendable: false, withdrawable: false, approvable: false, approvals: [], versions: [{ version: 1, designation: "Platform Engineer", currency: "INR", totalCompensation: 2000000, createdBy: "Alex Recruiter", createdAt: "2026-08-31T01:00:00Z" }],
};

const entitlement = { planName: "STARTER", maximumApprovers: 1, advancedApprovals: false, customBranding: false, auditExport: false };

test("recruiter creates, approves and sends a governed offer", async ({ page }) => {
  let state: Record<string, unknown> | null = null;
  await page.route("**/api/auth/csrf", (route) => route.fulfill({ status: 200, json: { token: "test-csrf" } }));
  await page.route("**/api/recruiter/jobs/SWX_NT_201/applications/application-1", (route) => route.fulfill({ status: 200, json: applicant }));
  await page.route("**/api/recruiter/applications/application-1/offer", async (route) => {
    if (route.request().method() === "PUT") state = baseOffer;
    await route.fulfill({ status: 200, json: { currentRecruiterId: "recruiter-1", entitlement, offer: state } });
  });
  await page.route("**/api/recruiter/applications/application-1/offer/submit", async (route) => {
    state = { ...baseOffer, status: "APPROVED", submittable: false, sendable: true, withdrawable: true };
    await route.fulfill({ status: 200, json: { currentRecruiterId: "recruiter-1", entitlement, offer: state } });
  });
  await page.route("**/api/recruiter/applications/application-1/offer/send", async (route) => {
    state = { ...baseOffer, status: "SENT", submittable: false, sendable: false, editable: false, withdrawable: true, sentAt: "2026-08-31T02:00:00Z" };
    await route.fulfill({ status: 200, json: { currentRecruiterId: "recruiter-1", entitlement, offer: state } });
  });

  await page.goto("/recruiter/jobs/SWX_NT_201/applications/application-1");
  await expect(page.getByRole("heading", { name: "Create the offer" })).toBeVisible();
  await page.getByRole("button", { name: "Create offer" }).click();
  await expect(page.getByLabel("Designation")).toHaveValue("Platform Engineer");
  await page.getByLabel("Annual variable").fill("200000");
  await page.getByRole("button", { name: "Save private draft" }).click();
  await expect(page.getByText("Offer version 1 saved privately.")).toBeVisible();
  await page.getByRole("button", { name: "Approve offer" }).click();
  await expect(page.getByText("Offer approved and ready to send.")).toBeVisible();
  page.once("dialog", (dialog) => dialog.accept());
  await page.getByRole("button", { name: "Send to candidate" }).click();
  await expect(page.getByText("Offer sent securely to Taylor Tech.")).toBeVisible();
  await expect(page.getByText("Sent", { exact: true })).toBeVisible();
});

test("candidate reviews and accepts the current offer version", async ({ page }) => {
  await page.addInitScript(() => window.localStorage.setItem("sapienworx.local-candidate-domain", "TECH"));
  const candidateOffer = {
    offerId: "offer-1", applicationId: "application-1", jobTitle: "Platform Engineer", organisationName: "Sapienworx QA Organisation",
    status: "SENT", version: 1, designation: "Platform Engineer", joiningDate: "2026-09-14", workplaceModel: "HYBRID",
    probationMonths: 6, noticeBuyout: false, expiresAt: "2026-09-03T12:00:00Z", currency: "INR", annualFixedAmount: 1800000,
    annualVariableAmount: 200000, joiningBonus: 0, retentionBonus: 0, otherCompensation: "Health cover",
    candidateMessage: "We would be delighted to have you join us.", termsText: "Subject to successful joining checks.",
    sentAt: "2026-08-31T02:00:00Z", respondedAt: null, responseNote: null, canRespond: true,
  };
  const application = { applicationId: "application-1", jobId: "SWX_NT_201", title: "Platform Engineer", companyName: "Sapienworx QA Organisation", location: "Bengaluru", recruiterName: "Alex Recruiter", recruiterTitle: "Senior Recruiter", stage: "OFFER", appliedAt: "2026-08-20T08:00:00Z", updatedAt: "2026-08-31T02:00:00Z" };
  await page.route("**/api/auth/csrf", (route) => route.fulfill({ status: 200, json: { token: "test-csrf" } }));
  await page.route("**/api/candidate/applications?page=0", (route) => route.fulfill({ status: 200, json: { content: [application], totalPages: 1, totalElements: 1, number: 0, first: true, last: true } }));
  await page.route("**/api/candidate/applications/summary", (route) => route.fulfill({ status: 200, json: { totalApplications: 1, activeApplications: 1, interviewApplications: 0, offerApplications: 1 } }));
  await page.route("**/api/candidate/applications/application-1/offer", (route) => route.fulfill({ status: 200, json: { offer: candidateOffer } }));
  await page.route("**/api/candidate/applications/application-1/offer/response", (route) => route.fulfill({ status: 200, json: { offer: { ...candidateOffer, status: "ACCEPTED", canRespond: false, respondedAt: "2026-08-31T03:00:00Z", responseNote: "Excited to join." } } }));

  await page.goto("/candidate/applications");
  await page.getByRole("button", { name: "Review offer" }).click();
  await expect(page.getByRole("heading", { name: "Platform Engineer", level: 4 })).toBeVisible();
  await expect(page.getByText("₹20,00,000")).toBeVisible();
  await page.getByLabel("Optional note to the hiring team").fill("Excited to join.");
  page.once("dialog", (dialog) => dialog.accept());
  await page.getByRole("button", { name: "Accept offer" }).click();
  await expect(page.getByText("Your acceptance is confirmed and the hiring team has been notified.")).toBeVisible();
  await expect(page.getByText("Offer accepted", { exact: true })).toBeVisible();
});
