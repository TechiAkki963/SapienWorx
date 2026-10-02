import { expect, test } from "@playwright/test";

import { login, MOCK_API, resetE2E } from "./helpers";

test.describe("candidate profile", () => {
  test.beforeEach(async ({ request }) => resetE2E(request));

  test("edits one professional section at a time without replacing other details", async ({ page, request }) => {
    await login(page, "candidate");
    await page.goto("/candidate/profile");

    await expect(page.getByRole("heading", { name: "My Professional Profile" })).toBeVisible();
    await expect(page.getByRole("heading", { name: "About Me" })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Career Preferences" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Edit profile" })).toBeVisible();
    await page.getByRole("button", { name: "Edit profile" }).click();
    await page.getByLabel("Resume headline").fill("Go platform engineer building high-scale systems");
    await page.getByLabel("Current designation").fill("Platform Engineer");
    await page.getByLabel("Professional summary").fill("Builds reliable backend platforms and accessible product experiences.");
    await page.getByLabel("Current city").fill("Mumbai");
    await page.getByLabel("State").fill("Maharashtra");
    const coreSave = page.waitForRequest((request) => request.url().endsWith("/api/v1/candidate/profile") && request.method() === "PATCH");
    const detailSave = page.waitForRequest((request) => request.url().endsWith("/api/v1/candidate/profile/details") && request.method() === "PATCH");
    await page.getByRole("button", { name: "Save section" }).click();
    const [coreRequest, detailRequest] = await Promise.all([coreSave, detailSave]);

    expect(coreRequest.postDataJSON()).toMatchObject({ current_city: "Mumbai", current_state: "Maharashtra", notice_period_days: null });
    expect(detailRequest.postDataJSON()).toMatchObject({
      details: { current_designation: "Platform Engineer" },
    });

    await expect(page.getByRole("button", { name: "Edit profile" })).toBeVisible();
    await expect(page.getByText("Builds reliable backend platforms and accessible product experiences.")).toBeVisible();

    await page.getByRole("button", { name: "Edit Career Preferences" }).click();
    await expect(page.getByLabel("Resume headline")).not.toBeVisible();
    await page.getByLabel("Preferred locations").fill("Mumbai, Pune, Remote");
    await page.getByLabel("Notice period (days)").fill("15");
    await page.getByRole("button", { name: "Save section" }).click();
    await expect(page.getByText("Mumbai, Pune, Remote")).toBeVisible();

    await page.getByRole("button", { name: "Edit Additional Information" }).click();
    await page.getByLabel("Additional professional links").fill("https://portfolio.example/ishita");
    await page.getByRole("button", { name: "Save section" }).click();
    await expect(page.getByRole("link", { name: "portfolio.example/ishita" })).toBeVisible();
    const saved = await (await request.get(`${MOCK_API}/__e2e/state`)).json();
    expect(saved.profile.headline).toBe("Go platform engineer building high-scale systems");
    expect(saved.profile.notice_period_days).toBe(15);
    expect(saved.profileDetails.details.professional_summary).toBe("Builds reliable backend platforms and accessible product experiences.");
    expect(saved.profileDetails.details.professional_links).toBe("https://portfolio.example/ishita");

    await page.reload();
    await expect(page.getByText("Builds reliable backend platforms and accessible product experiences.")).toBeVisible();
    await page.getByRole("button", { name: "Edit About Me" }).click();
    await expect(page.getByLabel("Resume headline")).toBeEnabled();
    await expect(page.getByLabel("Resume headline")).toHaveValue("Go platform engineer building high-scale systems");
    await expect(page.getByLabel("Current city")).toHaveValue("Mumbai");
    await expect(page.getByLabel("Professional summary")).toHaveValue("Builds reliable backend platforms and accessible product experiences.");
  });

  test("mobile presents one profile section at a time", async ({ page }) => {
    await login(page, "candidate");
    await page.setViewportSize({ width: 375, height: 812 });
    await page.goto("/candidate/profile");
    await expect(page.getByRole("heading", { name: "About Me" })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Work Experience" })).not.toBeVisible();
    await page.getByRole("navigation", { name: "Profile sections" }).getByRole("button", { name: "Experience" }).click();
    await expect(page.getByRole("heading", { name: "Work Experience" })).toBeVisible();
    await expect(page.getByRole("heading", { name: "About Me" })).not.toBeVisible();
  });

  test("recruiter discovery consent is explicit and reversible", async ({ page, request }) => {
    await login(page, "candidate");
    await page.goto("/candidate/profile");

    await expect(page.getByRole("heading", { name: "Recruiter discovery & outreach" })).toBeVisible();
    await expect(page.getByText(/start platform outreach before you apply/i)).toBeVisible();
    const toggle = page.getByRole("switch", { name: "Allow recruiter discovery and outreach" });
    await expect(toggle).not.toBeChecked();

    await toggle.check();
    await expect(page.getByText("Recruiter discovery and pre-application outreach are enabled.")).toBeVisible();
    let saved = await (await request.get(`${MOCK_API}/__e2e/state`)).json();
    expect(saved.profileDetails.details.discoverable_to_recruiters).toBe(true);

    await toggle.uncheck();
    await expect(page.getByText("Recruiter discovery and pre-application outreach are off.")).toBeVisible();
    saved = await (await request.get(`${MOCK_API}/__e2e/state`)).json();
    expect(saved.profileDetails.details.discoverable_to_recruiters).toBe(false);
  });
  test("uploads a private CV through a signed request and restores its filename after reload", async ({ page }) => {
    await login(page, "candidate");
    await page.goto("/candidate/profile");

    await expect(page.getByRole("button", { name: "Upload CV" })).toBeEnabled();

    const presign = page.waitForRequest((request) => request.url().endsWith("/api/v1/candidate/cv/presign") && request.method() === "POST");
    const directUpload = page.waitForRequest((request) => request.url().endsWith("/__e2e/cv-upload") && request.method() === "PUT");
    const complete = page.waitForRequest((request) => request.url().endsWith("/api/v1/candidate/cv/complete") && request.method() === "POST");

    await page.locator('#section-resume input[type="file"][accept*="pdf"]').setInputFiles({
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
    await expect(currentCVLabels).toHaveCount(1);
    await expect(currentCVLabels.first()).toBeVisible();
    await expect(page.getByRole("button", { name: "Replace CV" })).toBeEnabled();
    await expect(page.getByRole("button", { name: "Open CV" })).toBeEnabled();
  });
});
