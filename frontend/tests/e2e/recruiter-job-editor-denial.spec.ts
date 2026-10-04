import { expect, test } from "@playwright/test";
import { login, resetE2E } from "./helpers";

test.beforeEach(async ({ request }) => resetE2E(request));

test("an unavailable private job renders not-found instead of a server error", async ({ page }) => {
  await login(page, "recruiter");
  await page.goto("/recruiter/jobs/69999999-0000-4000-8000-000000000001/edit");
  await expect(page.getByRole("heading", { name: "404", exact: true })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Edit job", exact: true })).toHaveCount(0);
  await expect(page.getByText("This page couldn’t load", { exact: true })).toHaveCount(0);
  await page.screenshot({ path: "test-results/recruiter-job-editor-not-found.png" });
});

test("the recruiter's own job editor remains available", async ({ page }) => {
  await login(page, "recruiter");
  await page.goto("/recruiter/jobs/60000000-0000-4000-8000-000000000001/edit");
  await expect(page.getByRole("heading", { name: "Edit job", exact: true })).toBeVisible();
  await expect(page.getByLabel("Job title", { exact: true })).toHaveValue("Senior Go Platform Engineer");
});
