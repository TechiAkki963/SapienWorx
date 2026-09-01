import { expect, test } from "@playwright/test";

function job(jobId: string, title: string, status: string) {
  return {
    jobId,
    title,
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
    companyOverview: "A verified employer.",
    whyJoin: "High-impact product work.",
    responsibilitiesHtml: "<p>Lead discovery and delivery.</p>",
    hiringProcess: "Application review\nRecruiter conversation\nFinal conversation",
    skills: ["Product strategy", "Research"],
    status,
    domainCategory: "TECH",
    publicPath: `/jobs/${jobId}/live-product-manager`,
    createdAt: "2026-08-20T08:00:00Z",
    updatedAt: "2026-08-30T08:00:00Z",
    publishedAt: status === "ACTIVE" ? "2026-08-21T08:00:00Z" : null,
  };
}

test("My Jobs uses live pipeline analytics and guarded lifecycle controls", async ({ page }) => {
  const activeJob = job("SWX_NT_201", "Live Product Manager", "ACTIVE");
  const archivedJob = job("SWX_NT_202", "Archived Research Lead", "ARCHIVED");
  const transitions: string[] = [];

  await page.route("**/api/auth/csrf", (route) => route.fulfill({ status: 200, json: { token: "test-csrf" } }));
  await page.route("**/api/recruiter/jobs**", async (route) => {
    const request = route.request();
    const pathname = new URL(request.url()).pathname;
    if (request.method() === "GET" && pathname === "/api/recruiter/jobs") {
      await route.fulfill({ status: 200, json: { content: [
        { job: activeJob, applicants: 18, newApplicants: 5, screening: 6, interviewing: 3, finalStage: 1, offers: 2, onboarded: 1, rejected: 0, latestApplicationAt: "2026-08-30T04:30:00Z" },
        { job: archivedJob, applicants: 5, newApplicants: 0, screening: 1, interviewing: 0, finalStage: 0, offers: 0, onboarded: 1, rejected: 3, latestApplicationAt: "2026-08-12T04:30:00Z" },
      ] } });
      return;
    }
    const status = pathname.split("/").at(-1) ?? "";
    transitions.push(`${pathname}:${status}`);
    const source = pathname.includes("SWX_NT_202") ? archivedJob : activeJob;
    await route.fulfill({ status: 200, json: { ...source, status } });
  });

  await page.goto("/recruiter/jobs/manage");
  await expect(page.getByText("Live organisation data")).toBeVisible();
  const analytics = page.getByLabel("Filtered job portfolio analytics");
  await expect(analytics.locator("article").filter({ hasText: "Applicants" }).getByText("23", { exact: true })).toBeVisible();
  await expect(analytics.locator("article").filter({ hasText: "New applications" }).getByText("5", { exact: true })).toBeVisible();
  await expect(page.getByRole("link", { name: /18 5 new · 4 interviews/ })).toHaveAttribute("href", "/recruiter/pipeline?role=live-product-manager");

  await page.getByLabel("Actions for Live Product Manager").click();
  await page.getByRole("button", { name: "Close job" }).click();
  await expect(page.getByText("Live Product Manager is now closed.")).toBeVisible();
  await expect(page.getByRole("row", { name: /Live Product Manager/ }).getByText("Closed")).toBeVisible();

  await page.getByLabel("Actions for Archived Research Lead").click();
  await page.getByRole("button", { name: "Restore as draft" }).click();
  await expect(page.getByText("Archived Research Lead has been restored as a draft.")).toBeVisible();
  expect(transitions).toContain("/api/recruiter/jobs/SWX_NT_201/status/CLOSED:CLOSED");
  expect(transitions).toContain("/api/recruiter/jobs/SWX_NT_202/status/DRAFT:DRAFT");
});
