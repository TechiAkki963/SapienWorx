import { expect, test } from "@playwright/test";

const applicant = {
  applicationId: "application-1", candidateId: "candidate-1", jobId: "SWX_NT_201", jobTitle: "Live Product Manager",
  fullName: "Mira Rao", headline: "Staff Product Designer", currentCompany: "Northstar", previousRole: "Senior Product Designer",
  previousCompany: "Fieldnote", departmentRole: "Product Design", industry: "Technology", highestEducation: "M.Des · NID 2021",
  location: "Bengaluru", preferredLocations: ["Bengaluru", "Remote"], overallExperienceYears: 7, expectedSalaryLakhs: 28,
  noticePeriodDays: 30, skills: ["Research", "Product strategy", "Design systems"], workLinks: ["https://portfolio.example.test"],
  profileSummary: "Design leader connecting customer evidence to measurable product outcomes.", emailVerified: true, mobileVerified: true,
  cvAvailable: true, maskedEmail: "m••••@example.test", maskedMobile: "+••••••001", pipelineStage: "SCREENING", applicationSource: "DIRECT",
  referralCode: null, appliedAt: "2026-08-29T08:00:00Z", applicationUpdatedAt: "2026-08-30T08:00:00Z",
  lastActiveAt: "2026-08-30T07:00:00Z", profileLastUpdatedAt: "2026-08-28T07:00:00Z",
  postingRecruiterId: "recruiter-1", postingRecruiterName: "Alex Recruiter", assignedRecruiterId: "recruiter-1",
  assignedRecruiterName: "Alex Recruiter", currentUserCanManage: true,
  organisationMembers: [
    { recruiterId: "recruiter-1", fullName: "Alex Recruiter", designation: "Talent Partner" },
    { recruiterId: "recruiter-2", fullName: "Priya Interviewer", designation: "Design Director" },
  ],
  decisionReadiness: { requiredApprovals: 1, expectedReviewers: 2, submittedScorecards: 0, positiveApprovals: 0, averageScore: null, missingReviewerNames: ["Alex Recruiter", "Priya Interviewer"], conflictingRecommendations: false, offerReady: false, blockers: ["Waiting for feedback from Alex Recruiter, Priya Interviewer.", "Need 1 positive approval; currently 0.", "The average interview score must be at least 3.0/5."] },
  recentNotes: [{ text: "Strong portfolio evidence.", author: "Alex Recruiter", updatedAt: "2026-08-30T09:00:00Z" }],
  timeline: [{ type: "APPLICATION_SUBMITTED", summary: "Mira applied for this role.", actorType: "CANDIDATE", occurredAt: "2026-08-29T08:00:00Z" }],
  interviews: [{ interviewId: "interview-1", platformName: "Google Meet", meetingLink: "https://meet.google.com/existing-room", scheduledAt: "2026-09-01T10:00:00Z", durationMinutes: 45, timeZone: "Asia/Kolkata", agenda: "Portfolio evidence", status: "SCHEDULED", interviewOwnerId: "recruiter-1", interviewOwnerName: "Alex Recruiter", panelRecruiterIds: ["recruiter-2"], panelRecruiterNames: ["Priya Interviewer"], currentUserCanScore: true, scorecards: [] }],
};

test("job applicant workspace keeps actions scoped to the exact application", async ({ page }) => {
  const calls: string[] = [];
  await page.route("**/api/auth/csrf", (route) => route.fulfill({ status: 200, json: { token: "test-csrf" } }));
  await page.route("**/api/recruiter/jobs/SWX_NT_201/applications/application-1", (route) => route.fulfill({ status: 200, json: applicant }));
  await page.route("**/api/recruiter/pipeline/application-1/stage", async (route) => { calls.push(`${route.request().method()}:stage`); await route.fulfill({ status: 200, json: { pipelineStage: "INTERVIEWING", recentNotes: [] } }); });
  await page.route("**/api/recruiter/pipeline/application-1/notes", async (route) => { calls.push(`${route.request().method()}:note`); await route.fulfill({ status: 200, json: { pipelineStage: "INTERVIEWING", recentNotes: ["Discuss case study evidence."] } }); });
  await page.route("**/api/recruiter/jobs/SWX_NT_201/applications/application-1/assignment", async (route) => { calls.push(`${route.request().method()}:assignment`); await route.fulfill({ status: 200, json: { ...applicant, assignedRecruiterId: "recruiter-2", assignedRecruiterName: "Priya Interviewer" } }); });
  await page.route("**/api/recruiter/jobs/SWX_NT_201/applications/application-1/decision-policy", async (route) => { calls.push(`${route.request().method()}:policy`); await route.fulfill({ status: 200, json: { ...applicant, decisionReadiness: { ...applicant.decisionReadiness, requiredApprovals: 2 } } }); });
  await page.route("**/api/recruiter/candidates/candidate-1/contact?channel=EMAIL&jobId=SWX_NT_201", async (route) => { calls.push("GET:contact"); await route.fulfill({ status: 200, json: { value: "mira@example.test" } }); });
  await page.route("**/api/recruiter/interviews", async (route) => { calls.push(`${route.request().method()}:interview`); await route.fulfill({ status: 200, json: { candidateName: "Mira Rao", jobTitle: "Live Product Manager", platformName: "Google Meet", meetingLink: "https://meet.google.com/test-room", scheduledAt: "2026-09-02T10:00:00Z", durationMinutes: 45 } }); });
  await page.route("**/api/recruiter/workflow/interview-scorecards", async (route) => { calls.push(`${route.request().method()}:scorecard`); await route.fulfill({ status: 200, json: { id: "scorecard-1", recruiterName: "Alex Recruiter", recommendation: "YES", score: 4, criteriaScores: { technical: 4, problemSolving: 4, communication: 4, roleFit: 4 }, feedback: "Clear evidence across all dimensions.", submittedAt: "2026-08-30T11:00:00Z" } }); });

  await page.goto("/recruiter/jobs/SWX_NT_201/applications/application-1");
  await expect(page.getByRole("heading", { name: "Mira Rao" })).toBeVisible();
  await expect(page.getByText("m••••@example.test")).toBeVisible();
  await expect(page.getByText("Strong portfolio evidence.")).toBeVisible();
  await expect(page.getByRole("heading", { name: "Application activity" })).toBeVisible();
  await expect(page.getByText("Mira applied for this role.")).toBeVisible();
  await expect(page.getByRole("heading", { name: "Decision readiness" })).toBeVisible();
  await expect(page.getByText("Action needed")).toBeVisible();
  await expect(page.getByRole("option", { name: "Offer · blocked" })).toHaveAttribute("disabled", "");

  await page.getByRole("combobox", { name: "Application owner" }).selectOption("recruiter-2");
  await expect(page.getByText("Application ownership assigned to Priya Interviewer.")).toBeVisible();
  await page.getByRole("combobox", { name: "Required positive approvals" }).selectOption("2");
  await expect(page.getByText("Offer policy updated to 2 required approvals.")).toBeVisible();

  await page.getByRole("combobox", { name: "Pipeline stage" }).selectOption("INTERVIEWING");
  await expect(page.getByText("Mira Rao moved to Interviewing.")).toBeVisible();

  const emailContact = page.locator(".applicant-contact-card>button").filter({ hasText: "Email" });
  await emailContact.click();
  await expect(page.getByText("mira@example.test")).toBeVisible();
  await expect(emailContact).toContainText("Copy");

  await page.getByRole("textbox", { name: "Add a screening note" }).fill("Discuss case study evidence.");
  await page.getByRole("button", { name: "Save note" }).click();
  await expect(page.getByText("Recruiter note saved.")).toBeVisible();

  await page.getByRole("button", { name: "+ Schedule" }).click();
  await page.getByRole("textbox", { name: "Meeting link" }).fill("https://meet.google.com/test-room");
  await page.getByRole("checkbox", { name: /Priya Interviewer/ }).check();
  await page.getByRole("button", { name: "Confirm interview" }).click();
  await expect(page.getByText(/Interview scheduled for/)).toBeVisible();

  await page.getByRole("button", { name: "Add scorecard" }).click();
  await page.getByRole("textbox", { name: "Scorecard feedback" }).fill("Clear evidence across all dimensions.");
  await page.getByRole("button", { name: "Save scorecard" }).click();
  await expect(page.getByText("Structured interview scorecard saved.")).toBeVisible();
  expect(calls).toEqual(expect.arrayContaining(["PATCH:assignment", "PATCH:policy", "PATCH:stage", "GET:contact", "POST:note", "POST:interview", "POST:scorecard"]));
});

test("job applicant workspace remains usable on mobile", async ({ page }) => {
  await page.route("**/api/recruiter/jobs/SWX_NT_201/applications/application-1", (route) => route.fulfill({ status: 200, json: applicant }));
  await page.setViewportSize({ width: 375, height: 812 });
  await page.goto("/recruiter/jobs/SWX_NT_201/applications/application-1");
  await expect(page.getByRole("heading", { name: "Career snapshot" })).toBeVisible();
  const dimensions = await page.evaluate(() => ({ viewport: document.documentElement.clientWidth, content: document.documentElement.scrollWidth }));
  expect(dimensions.content).toBeLessThanOrEqual(dimensions.viewport);
});

test("panel reviewers receive scorecard access without applicant management permissions", async ({ page }) => {
  await page.route("**/api/recruiter/jobs/SWX_NT_201/applications/application-1", (route) => route.fulfill({ status: 200, json: { ...applicant, currentUserCanManage: false, decisionReadiness: { ...applicant.decisionReadiness, conflictingRecommendations: true, blockers: ["Resolve the disagreement between positive and negative recommendations."] } } }));
  await page.goto("/recruiter/jobs/SWX_NT_201/applications/application-1");

  await expect(page.getByRole("combobox", { name: "Application owner" })).toBeDisabled();
  await expect(page.getByRole("combobox", { name: "Pipeline stage" })).toBeDisabled();
  await expect(page.getByText("Panel review access · management controls are read-only.")).toBeVisible();
  await expect(page.getByRole("combobox", { name: "Required positive approvals" })).toBeDisabled();
  await expect(page.getByText("Reviewers disagree on the hiring recommendation.")).toBeVisible();
  await expect(page.locator(".applicant-contact-card>button").filter({ hasText: "Email" })).toBeDisabled();
  await expect(page.getByRole("button", { name: "Add scorecard" })).toBeVisible();
  await expect(page.getByRole("button", { name: "+ Schedule" })).toHaveCount(0);
});
