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
  await login(page, "recruiter");
  await page.goto(`/recruiter/candidates/${sourcedCandidate}?from=discover&job_id=${jobID}`);

  const matchRegion = page.getByRole("region", { name: "Candidate job match" });
  await expect(matchRegion).toBeVisible();
  await expect(matchRegion).toContainText("No current production-model match result is available");
  await expect(page.locator('[aria-label^="Job match score"]')).toHaveCount(0);
  await expect(page.getByRole("button", { name: /Schedule interview/i })).toHaveCount(0);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBeTruthy();
});

test("Talent Pool context preserves return navigation without inventing a job match", async ({ page }) => {
  await login(page, "recruiter");
  await page.goto(`/recruiter/candidates/${candidateWithApplication}?from=talent-pool`);

  await expect(page.getByRole("link", { name: "Back to talent pool" })).toBeVisible();
  await expect(page.getByRole("region", { name: "Candidate job match" })).toHaveCount(0);
  await expect(page.getByRole("button", { name: /Schedule interview/i })).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBeTruthy();
});


test("Candidate 360 header reveals masked contact, copies on double-click, and labels verified email as locked", async ({ page, context }) => {
  await context.grantPermissions(["clipboard-read", "clipboard-write"]);
  await login(page, "recruiter");
  await page.goto(`/recruiter/candidates/${candidateWithApplication}?job_id=${jobID}`);

  await expect(page.getByText("private@example.test", { exact: true })).toBeVisible();
  await expect(page.getByLabel("Verified email, locked")).toBeVisible();

  const masked = page.getByRole("button", { name: /Masked contact \+91.*Single-click to reveal/ });
  await expect(masked).toBeVisible();
  await expect(masked).toContainText("+91•••••0011");
  await masked.click();
  await expect(page.getByRole("button", { name: /Contact \+919900000011/ })).toBeVisible();

  await page.reload();
  const maskedAgain = page.getByRole("button", { name: /Masked contact \+91.*double-click to copy/i });
  await maskedAgain.dblclick();
  await expect(page.getByText("Contact copied.", { exact: true })).toBeVisible();
  await expect.poll(async () => page.evaluate(() => navigator.clipboard.readText())).toBe("+919900000011");
});

test("every recruiter CV open is metered once and appears in Command Centre organization usage", async ({ page, request }) => {
  await login(page, "recruiter");
  await page.goto(`/recruiter/candidates/${candidateWithApplication}?job_id=${jobID}`);
  await page.evaluate(() => { window.open = () => null; });

  const openCV = page.getByRole("button", { name: "Open private CV" });
  await openCV.click();
  await expect(openCV).toBeEnabled();
  await openCV.click();
  await expect(openCV).toBeEnabled();

  const state = await (await request.get("/__e2e/state")).json();
  expect(state.cvViews).toBe(2);

  await login(page, "master_admin");
  await page.goto("/swx-command-centre/organizations");
  const organization = page.getByRole("article", { name: "Organization Acme Hiring India" });
  await expect(organization).toContainText("CV views");
  await expect(organization).toContainText("2");
  await expect(organization).toContainText("Metered recruiter opens");
});
