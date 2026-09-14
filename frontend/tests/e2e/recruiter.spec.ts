import { expect, test } from "@playwright/test";

import { login, resetE2E } from "./helpers";

test.describe("recruiter pipeline", () => {
  test.beforeEach(async ({ request }) => resetE2E(request));

  test("renders a paginated high-density table and preserves filters", async ({ page }) => {
    await login(page, "recruiter");
    await page.goto("/recruiter/pipeline");

    await expect(page.getByRole("heading", { name: "Pipeline" })).toBeVisible();
    await expect(page.getByText("10 candidates per page")).toBeVisible();
    await expect(page.getByText(/Showing 1–10 of 1,000 candidates/)).toBeVisible();

    const table = page.getByRole("table");
    await expect(table).toBeVisible();
    await expect(table.getByRole("row")).toHaveCount(11);
    await expect(table.getByRole("columnheader", { name: "Candidate" })).toBeVisible();
    await expect(table.getByRole("columnheader", { name: "Experience" })).toBeVisible();
    await expect(table.getByRole("columnheader", { name: "Notice" })).toBeVisible();
    await expect(table.getByRole("columnheader", { name: "Location" })).toBeVisible();

    await page.getByLabel("Candidate").fill("Candidate 005");
    await page.getByRole("button", { name: "Apply filters" }).click();
    await expect(page).toHaveURL(/q=Candidate(?:\+|%20)005/);
    await expect(page.getByLabel("Candidate")).toHaveValue("Candidate 005");
    await expect(table.getByRole("row")).toHaveCount(2);
    await expect(table.getByText("Candidate 005")).toBeVisible();

    await page.reload();
    await expect(page.getByLabel("Candidate")).toHaveValue("Candidate 005");
    await expect(table.getByText("Candidate 005")).toBeVisible();
  });

  test("changes a candidate stage through the dense row control with exact mutation payload", async ({ page }) => {
    await login(page, "recruiter");
    await page.goto("/recruiter/pipeline");

    const stageControl = page.getByLabel("Stage for Candidate 001");
    await expect(stageControl).toContainText("Screening");
    await stageControl.click();

    const stageMutation = page.waitForRequest((request) => /\/api\/v1\/recruiter\/applications\/[^/]+\/stage$/.test(new URL(request.url()).pathname) && request.method() === "PATCH");
    await page.getByRole("button", { name: /Shortlisted/ }).click();
    expect((await stageMutation).postDataJSON()).toEqual({ stage: "shortlisted" });
    await expect(page.getByLabel("Stage for Candidate 001")).toContainText("Shortlisted");
  });

  test("documents that the production recruiter workspace is intentionally table-first", async ({ page }) => {
    await login(page, "recruiter");
    await page.goto("/recruiter/pipeline");
    await expect(page.getByText("Rows, persistent filters and explicit stage controls. No Kanban.")).toBeVisible();
    await expect(page.locator('[data-testid="kanban-board"]')).toHaveCount(0);
    await expect(page.locator('input[type="checkbox"][aria-label*="candidate" i]')).toHaveCount(0);
  });

  test.skip("bulk-selects candidates and applies one stage change", async () => {
    // Contract gap: bulk pipeline selection is not implemented in the current repository.
  });

  test.skip("drags a candidate across Kanban columns and persists the stage", async () => {
    // Product constraint: SapienWorx currently specifies a dense table pipeline and explicitly excludes Kanban.
  });
});
