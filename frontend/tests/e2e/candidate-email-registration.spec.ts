import { expect, test } from "@playwright/test";

import { resetE2E } from "./helpers";

test.describe("candidate email registration", () => {
  test.beforeEach(async ({ request }) => resetE2E(request));

  test("records privacy acknowledgement and continues directly to email verification", async ({ page }) => {
    await page.goto("/signup");
    await page.getByLabel("Full name").fill("Aarav Candidate");
    await page.getByLabel("Email").fill("aarav@example.com");
    await page.getByLabel("Mobile number").fill("+919876543210");
    await page.locator('input[name="password"]').fill("x".repeat(16));
    await page.getByLabel(/I have reviewed the privacy information/i).check();
    await page.getByLabel(/I confirm that I am 18 years of age or older/i).check();

    const registration = page.waitForRequest((request) => request.url().endsWith("/api/v1/auth/candidate/register") && request.method() === "POST");
    await page.getByRole("button", { name: "Create account" }).click();
    expect((await registration).postDataJSON()).toMatchObject({
      privacy_consent: true,
      privacy_policy_version: "privacy-v3-2026-09-17",
      age_confirmed: true,
    });

    await expect(page).toHaveURL(/\/verify-email\?.*role=candidate/);
    await expect(page.getByText("Email verification · Required")).toBeVisible();
  });
});
