import { expect, test } from "@playwright/test";

import { login, MOCK_API, resetE2E } from "./helpers";

test.describe("recruiter pipeline", () => {
  test.beforeEach(async ({ request }) => resetE2E(request));

  test("renders a table and mobile rows and preserves organization-scoped filters", async ({ page, request }) => {
    await login(page, "recruiter");
    await page.goto("/recruiter/pipeline");

    await expect(page.getByRole("heading", { name: "Applications", exact: true })).toBeVisible();
    await expect(page.getByText("Showing 1–25 of 1000 matching applications")).toBeVisible();
    await expect(page.getByRole("table",{name:"Hiring pipeline",exact:true}).locator("tbody tr")).toHaveCount(10);
    await expect(page.getByRole("table")).toHaveCount(1);

    await page.getByRole("button", { name: /^Filters/ }).click();
    const filters = page.getByRole("form", { name: "Application filters", exact: true });
    const candidateFilter = filters.getByRole("textbox", { name: "Keywords" });
    await candidateFilter.fill("Candidate 005");
    await filters.getByRole("checkbox", { name: "New Application" }).check();
    await filters.getByRole("textbox", { name: "Current or preferred location" }).fill("Mumbai");
    await filters.getByRole("combobox", { name: "Sort results" }).selectOption("most_experienced");
    await filters.getByRole("button", { name: "Apply filters" }).click();
    await expect(page).toHaveURL(/q=Candidate(?:\+|%20)005/);
    await expect(page).toHaveURL(/stage=new_application/);
    await expect(page).toHaveURL(/location=Mumbai/);
    await expect(page).toHaveURL(/sort=most_experienced/);
    await expect(page.getByRole("table",{name:"Hiring pipeline",exact:true}).locator("tbody tr")).toHaveCount(1);
    await expect(page.getByRole("link", { name: "Candidate 005",exact:true })).toBeVisible();
    const requests = await (await request.get(`${MOCK_API}/__e2e/requests`)).json();
    const search = requests.items.findLast((item: { path: string; method: string; search: string }) => item.path === "/api/v1/recruiter/pipeline" && item.method === "GET");
    expect(search.search).toContain("location=Mumbai");
    expect(search.search).toContain("sort=most_experienced");

    await page.reload();
    await page.getByRole("button", { name: /^Filters/ }).click();
    await expect(page.getByRole("form", { name: "Application filters", exact: true }).getByRole("textbox", { name: "Keywords" })).toHaveValue("Candidate 005");
    await page.keyboard.press("Escape");
    await expect(page.getByRole("link", { name: "Candidate 005",exact:true })).toBeVisible();
  });

  test("changes only the selected application stage through its row", async ({ page }) => {
    await login(page, "recruiter");
    await page.goto("/recruiter/pipeline");

    const stageControl = page.getByRole("button", {name:"Stage for Candidate 001 on Senior Go Platform Engineer",exact:true});
    await expect(stageControl).toContainText("Screening");
    await stageControl.click();

    const stageMutation = page.waitForRequest((request) => /\/api\/v1\/recruiter\/applications\/[^/]+\/stage$/.test(new URL(request.url()).pathname) && request.method() === "PATCH");
    await page.getByRole("button", { name: /Shortlisted/ }).click();
    expect((await stageMutation).postDataJSON()).toEqual({ stage: "shortlisted" });
    await expect(page.getByRole("button", {name:"Stage for Candidate 001 on Senior Go Platform Engineer",exact:true})).toContainText("Shortlisted");
  });

  test("uses a collapsible mobile filter panel without hiding applicant actions", async ({ page }) => {
    await login(page, "recruiter");
    await page.setViewportSize({ width: 375, height: 812 });
    await page.goto("/recruiter/pipeline");
    await expect(page.getByRole("link", { name: "Candidate 001",exact:true })).toBeVisible();
    await page.getByRole("button", { name: /^Filters/ }).click();
    await expect(page.getByRole("form", { name: "Application filters", exact: true })).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(page.getByRole("link", { name: "View candidate" }).first()).toBeVisible();
  });

  test.skip("drags a candidate across Kanban columns and persists the stage", async () => {
    // Product constraint: SapienWorx currently specifies a dense table pipeline and explicitly excludes Kanban.
  });
});

test.describe("job applicant workspace", () => {
  test.beforeEach(async ({ request }) => resetE2E(request));

  test("uses a server-filtered table-first job workspace while keeping mobile actions", async ({ page, request }) => {
    await login(page, "recruiter");
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto("/recruiter/jobs");

    await expect(page.getByRole("table")).toHaveCount(1);
    await expect(page.getByRole("table").getByRole("columnheader", { name: "Posted", exact: true })).toBeVisible();

    const filters = page.getByRole("form", { name: "Job filters" });
    await filters.getByLabel("Search").fill("Senior Go");
    await expect(page).toHaveURL(/q=Senior(?:\+|%20)Go/);
    await filters.getByLabel("Status").selectOption("active");
    await expect(page).toHaveURL(/status=active/);
    await filters.getByLabel("Role / function").selectOption("Technology");
    await expect(page).toHaveURL(/role_category=Technology/);
    await filters.getByLabel("Work mode").selectOption("hybrid");
    await expect(page).toHaveURL(/work_mode=hybrid/);
    await filters.getByLabel("Employment").selectOption("full_time");
    await expect(page).toHaveURL(/employment_type=full_time/);
    await filters.getByLabel("Sort").selectOption("applications");

    await expect(page).toHaveURL(/q=Senior(?:\+|%20)Go/);
    await expect(page).toHaveURL(/status=active/);
    await expect(page).toHaveURL(/role_category=Technology/);
    await expect(page).toHaveURL(/sort=applications/);

    const requests = await (await request.get(`${MOCK_API}/__e2e/requests`)).json();
    const search = requests.items.findLast((item: { path: string; method: string; search: string }) => item.path === "/api/v1/recruiter/jobs" && item.method === "GET");
    const params = new URLSearchParams(search.search);
    expect(params.get("q")).toBe("Senior Go");
    expect(params.get("status")).toBe("active");
    expect(params.get("role_category")).toBe("Technology");
    expect(params.get("work_mode")).toBe("hybrid");
    expect(params.get("employment_type")).toBe("full_time");
    expect(params.get("sort")).toBe("applications");
    expect(params.get("limit")).toBe("20");

    await page.setViewportSize({ width: 375, height: 812 });
    await page.reload();
    await expect(page.getByRole("table")).toHaveCount(0);
    await expect(page.getByRole("link", { name: "View applicants",exact:true })).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBeTruthy();
  });

  test("does not expose public preview or sharing for an active private job", async ({ page }) => {
    await login(page, "recruiter");
    await page.goto("/recruiter/jobs?q=Private%20Operations%20Lead");

    await expect(page.locator("p:visible, h2:visible").filter({ hasText: "Private Operations Lead" }).first()).toBeVisible();
    await expect(page.getByRole("link", { name: "Preview ↗" })).toHaveCount(0);
    await expect(page.getByRole("button", { name: "Share" })).toHaveCount(0);
    await page.getByRole("button",{name:"More actions for Private Operations Lead"}).click();
    await expect(page.getByRole("dialog", { name: "Private Operations Lead", exact: true }).getByText("Public sharing is available after publishing a public job.")).toBeVisible();
    await expect(page.getByRole("link", { name: "Preview public listing" })).toHaveCount(0);
    await expect(page.getByRole("button", { name: "Share", exact: true })).toHaveCount(0);
  });

  test("requires confirmation before governed bulk job actions", async ({ page }) => {
    await login(page, "recruiter");
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto("/recruiter/jobs");

    await page.locator('input[data-bulk-job-id="60000000-0000-4000-8000-000000000001"]:visible').check();
    await expect(page.getByText("1 selected on this page")).toBeVisible();
    await page.getByLabel("Bulk action").selectOption("pause");
    await page.getByRole("button", { name: "Review action" }).click();
    await expect(page.getByRole("alertdialog", { name: "Confirm bulk job action" })).toContainText("Pause 1 selected job?");

    const mutation = page.waitForRequest((request) => new URL(request.url()).pathname === "/api/v1/recruiter/jobs/bulk" && request.method() === "POST");
    await page.getByRole("button", { name: "Confirm Pause" }).click();
    expect((await mutation).postDataJSON()).toEqual({
      job_ids: ["60000000-0000-4000-8000-000000000001"],
      action: "pause",
    });
    await expect(page.getByRole("region", { name: "Bulk job actions" }).getByRole("status")).toContainText("1 changed");
  });

  test("offers only organization-scoped recruiters for bulk reassignment", async ({ page }) => {
    await login(page, "recruiter");
    await page.goto("/recruiter/jobs");
    await page.locator('input[data-bulk-job-id="60000000-0000-4000-8000-000000000001"]:visible').check();
    await page.getByLabel("Bulk action").selectOption("reassign");
    const recruiter = page.getByRole("region", { name: "Bulk job actions" }).getByLabel("Assign recruiter");
    await expect(recruiter).toContainText("Riya Recruiter");
    await expect(recruiter).toContainText("Kabir Recruiter");
    await recruiter.selectOption("20000000-0000-4000-8000-000000000002");
    await page.getByRole("button", { name: "Review action" }).click();
    await expect(page.getByRole("alertdialog", { name: "Confirm bulk job action" })).toContainText("Kabir Recruiter");
  });

  test("keeps the job reference in details and opens applicants from job management", async ({ page }) => {
    await login(page, "recruiter");
    await page.goto("/recruiter/jobs");
    await page.getByRole("button", { name: "More actions for Senior Go Platform Engineer" }).click();
    await expect(page.getByRole("dialog", { name: "Senior Go Platform Engineer", exact: true }).getByText("SWX-JOB-2026-00001")).toBeVisible();
    await page.keyboard.press("Escape");
    await page.getByRole("link", { name: "View 1,000 applications for Senior Go Platform Engineer", exact: true }).click();
    await expect(page).toHaveURL(/\/recruiter\/jobs\/60000000-0000-4000-8000-000000000001\/applicants$/);
    await expect(page.getByRole("heading", { name: "Senior Go Platform Engineer" })).toBeVisible();
    await expect(page.getByText("Job ID: SWX-JOB-2026-00001")).toBeVisible();
    await expect(page.getByRole("table",{name:"Hiring pipeline",exact:true}).locator("tbody tr")).toHaveCount(10);
    await expect(page.getByRole("form", { name: "Application filters", exact: true }).getByRole("combobox", { name: "Job" })).toHaveCount(0);
  });

  test("locks the job scope even if the URL supplies a different job_id", async ({ page, request }) => {
    await login(page, "recruiter");
    await page.goto("/recruiter/jobs/60000000-0000-4000-8000-000000000001/applicants?job_id=another-job&stage=new_application");
    await expect(page.getByRole("heading", { name: "Senior Go Platform Engineer" })).toBeVisible();
    const requests = await (await request.get(`${MOCK_API}/__e2e/requests`)).json();
    const search = requests.items.findLast((item: { path: string; method: string; search: string }) => item.path === "/api/v1/recruiter/pipeline" && item.method === "GET");
    const params = new URLSearchParams(search.search);
    expect(params.get("job_id")).toBe("60000000-0000-4000-8000-000000000001");
    expect(params.get("stage")).toBe("new_application");
    await page.getByRole("button", { name: /^Filters/ }).click();
    await page.getByRole("form", { name: "Application filters", exact: true }).getByRole("button", { name: "Apply filters" }).click();
    await expect(page).toHaveURL(/\/recruiter\/jobs\/60000000-0000-4000-8000-000000000001\/applicants/);
  });

  test("opens deterministic job analytics and keeps the workspace responsive", async ({ page }) => {
    await login(page, "recruiter");
    for (const viewport of [{ width: 1440, height: 900 }, { width: 768, height: 1024 }, { width: 320, height: 800 }]) {
      await page.setViewportSize(viewport);
      await page.goto("/recruiter/jobs/60000000-0000-4000-8000-000000000001/analytics");
      await expect(page.getByRole("heading", { name: "Job analytics" })).toBeVisible();
      await expect(page.getByText("SWX-JOB-2026-00001")).toBeVisible();
      await expect(page.getByRole("region", { name: "Hiring funnel" })).toBeVisible();
      await expect(page.getByRole("region", { name: "Source performance" })).toBeVisible();
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBeTruthy();
    }
  });

  test("keeps job cards and their applicant page usable on desktop, tablet, and mobile", async ({ page }) => {
    await login(page, "recruiter");
    for (const width of [1440, 768, 375]) {
      await page.setViewportSize({ width, height: 900 });
      await page.goto("/recruiter/jobs");
      await expect(page.getByRole("link", { name: width >= 1024 ? "View 1,000 applications for Senior Go Platform Engineer" : "View applicants", exact: true })).toBeVisible();
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBeTruthy();
      await page.goto("/recruiter/jobs/60000000-0000-4000-8000-000000000001/applicants");
      await expect(page.getByText("Job ID: SWX-JOB-2026-00001")).toBeVisible();
      await expect(page.getByRole("link", { name: "Candidate 001", exact: true })).toBeVisible();
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBeTruthy();
    }
  });
});
