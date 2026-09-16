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
    await expect(page.locator("fieldset")).toHaveAttribute("disabled", "");
    await expect(page.getByLabel("Resume headline")).toBeDisabled();

    await page.reload();
    await expect(page.getByText(/Your saved profile is read-only/)).toBeVisible();
    await expect(page.locator("fieldset")).toHaveAttribute("disabled", "");
    await expect(page.getByLabel("Resume headline")).toBeDisabled();
    await page.getByRole("button", { name: "Edit profile" }).click();
    await expect(page.locator("fieldset")).not.toHaveAttribute("disabled", "");
    await expect(page.getByLabel("Resume headline")).toBeEnabled();
    await expect(page.getByLabel("Resume headline")).toHaveValue("Go platform engineer building high-scale systems");
    await expect(page.getByLabel("Current city")).toHaveValue("Mumbai");
  });

  test("uploads a private CV through a signed request and restores its filename after reload", async ({ page }) => {
    await login(page, "candidate");
    await page.goto("/candidate/profile");

    await expect(page.getByRole("button", { name: "Upload CV" })).toBeEnabled();

    const presign = page.waitForRequest((request) => request.url().endsWith("/api/v1/candidate/cv/presign") && request.method() === "POST");
    const directUpload = page.waitForRequest((request) => request.url().endsWith("/__e2e/cv-upload") && request.method() === "PUT");
    const complete = page.waitForRequest((request) => request.url().endsWith("/api/v1/candidate/cv/complete") && request.method() === "POST");

    await page.locator('input[type="file"][accept*="pdf"]').setInputFiles({
      name: "Aarav-Candidate-CV.pdf",
      mimeType: "application/pdf",
      buffer: Buffer.from("%PDF-1.4 e2e candidate resume"),
    });

    const [presignRequest, uploadRequest] = await Promise.all([presign, directUpload]);
    await complete;

    expect(presignRequest.postDataJSON()).toEqual({ filename: "Aarav-Candidate-CV.pdf", content_type: "application/pdf" });
    expect(uploadRequest.headers()["content-type"]).toBe("application/pdf");
    expect(uploadRequest.headers()["x-amz-server-side-encryption"]).toBe("AES256");
    await expect(page.getByText("Resume uploaded securely.")).toBeVisible();

    await page.reload();
    const currentCVLabels = page.getByText("Current CV: Aarav-Candidate-CV.pdf", { exact: true });
    await expect(currentCVLabels).toHaveCount(2);
    await expect(currentCVLabels.first()).toBeVisible();
    await expect(page.getByRole("button", { name: "Replace CV" })).toBeEnabled();
    await expect(page.getByRole("button", { name: "Open CV" })).toBeEnabled();
  });
});
