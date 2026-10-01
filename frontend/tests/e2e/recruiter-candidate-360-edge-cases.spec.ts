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
  const recruiterContext = page.getByRole("region", { name: "Recruiter notes and tags" });
  await expect(recruiterContext).toBeVisible();
  await expect(recruiterContext.getByText("Priority", { exact: true })).toBeVisible();
  await expect(recruiterContext.getByText("Go Platform", { exact: true })).toBeVisible();
  await expect(recruiterContext.getByText("Mumbai", { exact: true })).toBeVisible();
  await expect(recruiterContext.getByRole("button", { name: /Recruiter Notes/i })).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBeTruthy();
});


test("Candidate 360 header reveals masked contact on single click and copies on double click", async ({ page, context }) => {
  await context.grantPermissions(["clipboard-read", "clipboard-write"]);
  await page.route(/\/api\/v1\/recruiter\/candidates\/[^/]+\/contact$/, route => route.fulfill({
    status: 200,
    contentType: "application/json",
    body: JSON.stringify({ primary: "+919900000011", alternate: "+919900000099" }),
  }));
  await login(page, "recruiter");
  await page.goto(`/recruiter/candidates/${candidateWithApplication}?job_id=${jobID}`);

  await expect(page.getByText("private@example.test", { exact: true })).toBeVisible();
  await expect(page.getByText("Verified", { exact: true })).toBeVisible();

  const phone = page.getByRole("button", { name: "Hidden phone number. Click once to show. Double click to copy" });
  await expect(phone).toContainText("••••••••••");
  await expect(phone).not.toContainText("0011");
  await expect(phone).not.toContainText("Reveal");
  await phone.click();
  await expect(page.getByRole("button", { name: /Phone \+919900000011/ })).toBeVisible();

  const revealed = page.getByRole("button", { name: /Phone \+919900000011/ });
  await revealed.dblclick();
  await expect(page.getByText("Number copied.", { exact: true })).toBeVisible();
  await expect.poll(() => page.evaluate(() => navigator.clipboard.readText())).toBe("+919900000011");
});

test("sourced Candidate 360 never exposes verified email or masked contact in its header", async ({ page }) => {
  await login(page, "recruiter");
  await page.goto(`/recruiter/candidates/${sourcedCandidate}?from=discover`);

  await expect(page.getByText("private@example.test", { exact: true })).toHaveCount(0);
  await expect(page.getByRole("button", { name: /Hidden phone number/ })).toHaveCount(0);
});


test("opening a Candidate 360 CV requests the metered view mode", async ({ page }) => {
  await page.route(/\/api\/v1\/recruiter\/candidates\/[^/]+\/cv\?mode=view$/, route => route.fulfill({
    status: 200,
    contentType: "application/json",
    body: JSON.stringify({
      download: { url: "https://example.test/private-cv.pdf", method: "GET", expires_at: new Date(Date.now() + 300000).toISOString() },
      filename: "candidate-001.pdf",
    }),
  }));
  await login(page, "recruiter");
  await page.goto(`/recruiter/candidates/${candidateWithApplication}?job_id=${jobID}`);

  const view = page.waitForRequest(request => {
    const url = new URL(request.url());
    return url.pathname.endsWith(`/recruiter/candidates/${candidateWithApplication}/cv`) && url.searchParams.get("mode") === "view";
  });
  await page.getByRole("button", { name: "Open private CV" }).click();
  await view;
});
