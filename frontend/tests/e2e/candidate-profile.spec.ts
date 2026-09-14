import { expect, test } from "@playwright/test";

import { login, resetE2E } from "./helpers";

test.describe("candidate profile", () => {
  test.beforeEach(async ({ request }) => resetE2E(request));

  test("saves professional details, persists state, and becomes read-only until edited", async ({ page }) => {
    await login(page, "candidate");
    await page.goto("/candidate/profile");

    await expect(page.getByRole("heading", { name: "Your professional profile" })).toBeVisible();
    await expect(page.locator("fieldset[disabled]")).toHaveCount(0);
    await page.getByLabel("Full name").fill("Aarav Candidate");
    await page.getByLabel("Resume headline").fill("Go platform engineer building high-scale systems");
    await page.getByLabel("Current designation").fill("Platform Engineer");
    await page.getByLabel("Current city").fill("Mumbai");
    await page.getByLabel("State").fill("Maharashtra");
    await page.getByLabel("Preferred locations").fill("Mumbai, Pune, Remote");
    await page.getByLabel("Notice period (days)").fill("15");
    await page.getByLabel("Company name").fill("Example Systems");
    await page.getByLabel("Job title").fill("Backend Engineer");
    await page.getByLabel("Skill / software name").fill("Go");

    const coreSave = page.waitForRequest((request) => request.url().endsWith("/api/v1/candidate/profile") && request.method() === "PATCH");
    const detailSave = page.waitForRequest((request) => request.url().endsWith("/api/v1/candidate/profile/details") && request.method() === "PATCH");
    await page.getByRole("button", { name: "Save full profile" }).click();
    const [coreRequest, detailRequest] = await Promise.all([coreSave, detailSave]);

    expect(coreRequest.postDataJSON()).toMatchObject({ current_city: "Mumbai", current_state: "Maharashtra", notice_period_days: 15 });
    expect(detailRequest.postDataJSON()).toMatchObject({
      details: { current_designation: "Platform Engineer", preferred_locations: "Mumbai, Pune, Remote" },
    });

    await expect(page.getByRole("button", { name: "Edit profile" })).toBeVisible();
    await expect(page.locator("fieldset")).toBeDisabled();

    await page.reload();
    await expect(page.getByText(/Your saved profile is read-only/)).toBeVisible();
    await expect(page.locator("fieldset")).toBeDisabled();
    await page.getByRole("button", { name: "Edit profile" }).click();
    await expect(page.locator("fieldset")).toBeEnabled();
    await expect(page.getByLabel("Resume headline")).toHaveValue("Go platform engineer building high-scale systems");
    await expect(page.getByLabel("Current city")).toHaveValue("Mumbai");
  });

  test("exposes the current CV-upload capability gap explicitly", async ({ page }) => {
    await login(page, "candidate");
    await page.goto("/candidate/profile");

    const upload = page.getByRole("button", { name: "Upload CV", includeHidden: true });
    await expect(upload).toHaveCount(1);
    await expect(upload).toBeDisabled();
    await expect(page.locator("text=CV upload will activate with resume storage.")).toHaveCount(1);
  });

  test.skip("uploads a CV and restores its filename after reload", async () => {
    // Contract gap: resume upload/storage is not implemented in the current repository.
  });
});
