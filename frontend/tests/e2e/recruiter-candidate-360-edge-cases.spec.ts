import { expect, test } from "@playwright/test";

import { login, resetE2E } from "./helpers";

const jobID = "60000000-0000-4000-8000-000000000001";
const candidateWithApplication = "71000000-0000-4000-8000-000000000001";
const sourcedCandidate = "71000000-0000-4000-8000-000000000002";

test.beforeEach(async ({ request }) => resetE2E(request));

test("sourced Candidate 360 keeps private data gated and hides application-only interview action", async ({ page }) => {
  await login(page, "recruiter");
  await page.goto(`/recruiter/candidates/${sourcedCandidate}?from=discover`);

  await expect(page.getByRole("link", { name: "Back to discovery" })).toBeVisible();
  await expect(page.getByText("Candidate 360°", { exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: /InMail/i })).toBeVisible();
  await expect(page.getByRole("button", { name: /Schedule interview/i })).toHaveCount(0);
  await expect(page.getByRole("region", { name: "Candidate job match" })).toHaveCount(0);
  await expect(page.getByText("CV remains private until the candidate applies to your company.")).toBeVisible();
  await expect(page.getByText("Internal recruiter notes become available after the candidate applies to your company.")).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBeTruthy();
});

test("Candidate 360 shows an honest no-result state when the production matcher has no result", async ({ page }) => {
  await page.route(
    new RegExp(`/api/v1/recruiter/candidates/${candidateWithApplication}/match\\?job_id=`),
    (route) => route.fulfill({ status: 200, contentType: "application/json", body: "null" }),
  );

  await login(page, "recruiter");
  await page.goto(`/recruiter/candidates/${candidateWithApplication}?job_id=${jobID}`);

  const matchRegion = page.getByRole("region", { name: "Candidate job match" });
  await expect(matchRegion).toBeVisible();
  await expect(matchRegion).toContainText("No current production-model match result is available");
  await expect(page.locator('[aria-label^="Job match score"]')).toHaveCount(0);
  await expect(page.getByRole("button", { name: /Schedule interview/i })).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBeTruthy();
});

test("Talent Pool entry preserves return navigation without inventing a job match", async ({ page }) => {
  await page.route("**/api/v1/recruiter/talent-pool", (route) => route.fulfill({
    status: 200,
    contentType: "application/json",
    body: JSON.stringify({
      items: [{
        candidate_id: candidateWithApplication,
        full_name: "Candidate 001",
        headline: "Backend engineer",
        current_city: "Mumbai",
        experience_months: 25,
        notice_period_days: 15,
        tags: [],
        saved_at: new Date().toISOString(),
      }],
    }),
  }));

  await login(page, "recruiter");
  await page.goto("/recruiter/talent-pool");
  await page.getByRole("link", { name: "View profile →" }).click();

  await expect(page).toHaveURL(new RegExp(`/recruiter/candidates/${candidateWithApplication}\\?from=talent-pool`));
  await expect(page.getByRole("link", { name: "Back to talent pool" })).toBeVisible();
  await expect(page.getByRole("region", { name: "Candidate job match" })).toHaveCount(0);
  await expect(page.getByRole("button", { name: /Schedule interview/i })).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBeTruthy();
});
