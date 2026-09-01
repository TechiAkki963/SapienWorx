import { expect, test } from "@playwright/test";

type JobPayload = Record<string, unknown>;

function jobResponse(payload: JobPayload, status = "DRAFT") {
  return {
    jobId: "SWX_NT_101",
    title: payload.title || "Untitled role",
    organisationName: "Nexora Technologies",
    verifiedEmployer: true,
    location: payload.location || "",
    department: payload.department || "General",
    employmentType: payload.employmentType || "FULL_TIME",
    workplaceModel: payload.workplaceModel || "ON_SITE",
    minimumExperienceYears: payload.minimumExperienceYears ?? 0,
    maximumExperienceYears: payload.maximumExperienceYears ?? 0,
    minimumSalaryLakhs: payload.minimumSalaryLakhs ?? null,
    maximumSalaryLakhs: payload.maximumSalaryLakhs ?? null,
    salaryVisible: false,
    descriptionHtml: payload.descriptionHtml || "",
    companyOverview: payload.companyOverview || "",
    whyJoin: payload.whyJoin || "",
    responsibilitiesHtml: payload.responsibilitiesHtml || "",
    hiringProcess: payload.hiringProcess || "",
    skills: payload.skills || [],
    status,
    domainCategory: payload.domainCategory || "UNASSIGNED",
    publicPath: "/jobs/SWX_NT_101/principal-product-designer",
  };
}

test.beforeEach(async ({ page }) => {
  await page.route("**/api/auth/csrf", (route) => route.fulfill({ status: 200, json: { token: "test-csrf" } }));
});

test("an incomplete role can be persisted as a real draft", async ({ page }) => {
  let submitted: JobPayload | undefined;
  await page.route("**/api/recruiter/jobs", async (route) => {
    submitted = route.request().postDataJSON() as JobPayload;
    await route.fulfill({ status: 200, json: jobResponse(submitted) });
  });

  await page.goto("/recruiter/jobs");
  await page.getByLabel("Job title").fill("Platform Engineer");
  await page.getByRole("button", { name: "Save as draft" }).click();

  await expect(page.getByText("Draft saved as SWX_NT_101.", { exact: true })).toBeVisible();
  expect(submitted?.title).toBe("Platform Engineer");
  expect(submitted?.salaryVisible).toBe(false);
  expect(submitted?.companyOverview).toBe("");
});

test("a complete candidate story publishes and never exposes salary in the preview", async ({ page }) => {
  let submitted: JobPayload | undefined;
  await page.route("**/api/recruiter/jobs**", async (route) => {
    const url = new URL(route.request().url());
    if (url.pathname.endsWith("/SWX_NT_101/publish")) {
      await route.fulfill({ status: 200, json: jobResponse(submitted ?? {}, "ACTIVE") });
      return;
    }
    submitted = route.request().postDataJSON() as JobPayload;
    await route.fulfill({ status: 200, json: jobResponse(submitted) });
  });

  await page.goto("/recruiter/jobs");
  await page.getByLabel("Job title").fill("Principal Product Designer");
  await page.getByLabel("Department or team").fill("Product");
  await page.getByLabel("Employment type").selectOption("FULL_TIME");
  await page.getByLabel("Workplace model").selectOption("HYBRID");
  await page.getByLabel("Location").fill("Bengaluru, India");
  await page.getByLabel("Minimum experience").fill("6");
  await page.getByLabel("Maximum experience").fill("9");
  await page.getByLabel("Minimum salary in lakhs").fill("20");
  await page.getByLabel("Maximum salary in lakhs").fill("30");
  await page.getByRole("textbox", { name: "Role summary" }).fill("Lead the product design practice and shape its operating model.");
  await page.getByRole("textbox", { name: "Responsibilities" }).fill("Own discovery, design quality and the design system.");
  await page.getByLabel("Company overview").fill("Nexora builds trusted recruitment infrastructure for ambitious teams.");
  await page.getByLabel("Why join").fill("Build an influential practice with direct access to product leadership.");

  const preview = page.getByLabel("Live job preview");
  await expect(preview.getByText("Verified employer")).toBeVisible();
  await expect(preview.getByText("Hiring process")).toBeVisible();
  await expect(preview).not.toContainText("₹");
  await page.getByRole("button", { name: "Publish job" }).click();

  await expect(page.getByRole("dialog", { name: "Share Principal Product Designer" })).toBeVisible();
  expect(submitted?.salaryVisible).toBe(false);
  expect(submitted?.minimumSalaryLakhs).toBe(20);
  expect(submitted?.companyOverview).toContain("trusted recruitment infrastructure");
  expect(submitted?.responsibilitiesHtml).toContain("Own discovery");
  expect(String(submitted?.hiringProcess).split("\n")).toHaveLength(4);
});
