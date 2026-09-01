import { expect, test } from "@playwright/test";

const liveJob = {
  jobId: "SWX_NT_201",
  title: "Live Product Manager",
  organisationName: "Nexora Technologies",
  verifiedEmployer: true,
  location: "Bengaluru, India",
  department: "Product",
  employmentType: "FULL_TIME",
  workplaceModel: "HYBRID",
  minimumExperienceYears: 4,
  maximumExperienceYears: 7,
  minimumSalaryLakhs: 18,
  maximumSalaryLakhs: 26,
  salaryVisible: false,
  descriptionHtml: "<p>Build trusted hiring products.</p>",
  companyOverview: "A verified employer building a more thoughtful hiring market.",
  whyJoin: "Own meaningful product decisions with an experienced team.",
  responsibilitiesHtml: "<ul><li>Lead discovery and delivery.</li></ul>",
  hiringProcess: "Application review\nRecruiter conversation\nFinal conversation",
  skills: ["Product strategy", "Research"],
  status: "ACTIVE",
  domainCategory: "TECH",
  publicPath: "/jobs/SWX_NT_201/live-product-manager",
  createdAt: "2026-08-20T08:00:00Z",
  updatedAt: "2026-08-30T08:00:00Z",
  publishedAt: "2026-08-21T08:00:00Z",
};

const workspace = {
  summary: { job: liveJob, applicants: 18, newApplicants: 5, screening: 6, interviewing: 3, finalStage: 1, offers: 2, onboarded: 1, rejected: 0, latestApplicationAt: "2026-08-30T04:30:00Z" },
  applications: { content: [
    { applicationId: "application-1", candidateId: "candidate-1", fullName: "Mira Rao", headline: "Staff Product Designer", skills: ["Research", "Product strategy"], pipelineStage: "INTERVIEWING", appliedAt: "2026-08-29T08:00:00Z", updatedAt: "2026-08-30T08:00:00Z", lastActiveAt: "2026-08-30T07:00:00Z", applicationSource: "DIRECT" },
    { applicationId: "application-2", candidateId: "candidate-2", fullName: "Arjun Sen", headline: "Senior Product Manager", skills: ["Analytics"], pipelineStage: "SCREENING", appliedAt: "2026-08-28T08:00:00Z", updatedAt: "2026-08-29T08:00:00Z", lastActiveAt: "2026-08-29T07:00:00Z", applicationSource: "SHARED_LINK" },
  ], totalElements: 18, totalPages: 1, number: 0 },
};

test.beforeEach(async ({ page }) => {
  await page.route("**/api/auth/csrf", (route) => route.fulfill({ status: 200, json: { token: "test-csrf" } }));
  await page.route("**/api/recruiter/jobs/SWX_NT_201/workspace**", (route) => route.fulfill({ status: 200, json: workspace }));
  await page.route("**/api/recruiter/jobs/SWX_NT_201/status/CLOSED", (route) => route.fulfill({ status: 200, json: { ...liveJob, status: "CLOSED" } }));
});

test("job detail uses live overview, applicants, description, and settings", async ({ page }) => {
  await page.goto("/recruiter/jobs/SWX_NT_201");
  await expect(page.getByText("Nexora Technologies · Live workspace")).toBeVisible();
  await expect(page.getByText("18", { exact: true }).first()).toBeVisible();
  await expect(page.getByText("5 awaiting review")).toBeVisible();

  await page.getByRole("button", { name: /Applicants/ }).click();
  await expect(page.getByRole("link", { name: /Mira Rao/ })).toHaveAttribute("href", "/recruiter/jobs/SWX_NT_201/applications/application-1");
  await expect(page.getByText("Arjun Sen")).toBeVisible();

  await page.getByRole("button", { name: "Job Description" }).click();
  await expect(page.getByText("Build trusted hiring products.")).toBeVisible();
  await expect(page.getByText("A verified employer building a more thoughtful hiring market.")).toBeVisible();
  await expect(page.getByText("Own meaningful product decisions with an experienced team.")).toBeVisible();

  await page.getByRole("button", { name: "Settings" }).click();
  await page.getByRole("button", { name: "Close job" }).click();
  await expect(page.getByText("Live Product Manager is now closed.")).toBeVisible();
  await expect(page.getByText("Closed", { exact: true }).first()).toBeVisible();
});

test("job detail remains contained on a mobile viewport", async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 812 });
  await page.goto("/recruiter/jobs/SWX_NT_201");
  await expect(page.getByText("Recruitment overview")).toBeVisible();
  const dimensions = await page.evaluate(() => ({ viewport: document.documentElement.clientWidth, content: document.documentElement.scrollWidth }));
  expect(dimensions.content).toBeLessThanOrEqual(dimensions.viewport);
});
