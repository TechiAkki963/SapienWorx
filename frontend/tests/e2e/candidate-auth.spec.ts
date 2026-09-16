import { expect, test } from "@playwright/test";

import { resetE2E } from "./helpers";

test.describe("candidate authentication", () => {
  test.beforeEach(async ({ request }) => resetE2E(request));

  test("registers with required acknowledgements and completes email verification", async ({ page }) => {
    await page.goto("/signup");
    await page.getByLabel("Full name").fill("Aarav Candidate");
    await page.getByLabel("Email", { exact: true }).fill("aarav@example.com");
    await page.getByLabel("Mobile number").fill("+919876543210");
    await page.getByLabel("Password").fill("Candidate-E2E-123!");
    await page.locator('input[name="privacy_consent"]').check();
    await page.locator('input[name="age_confirmed"]').check();

    const register = page.waitForRequest((request) => request.url().endsWith("/api/v1/auth/candidate/register") && request.method() === "POST");
    await page.getByRole("button", { name: "Create account" }).click();
    expect((await register).postDataJSON()).toMatchObject({
      full_name: "Aarav Candidate",
      email: "aarav@example.com",
      phone: "+919876543210",
      privacy_consent: true,
      privacy_policy_version: "privacy-v3-2026-09-17",
      age_confirmed: true,
    });

    await expect(page).toHaveURL(/\/verify-email\?.*role=candidate/);
    await expect(page.getByLabel("Email verification code")).toHaveValue("123456");

    const verifyEmail = page.waitForRequest((request) => request.url().endsWith("/api/v1/auth/email/verify") && request.method() === "POST");
    await page.getByRole("button", { name: "Verify email" }).click();
    expect((await verifyEmail).postDataJSON()).toEqual({ email: "aarav@example.com", code: "123456" });
    await expect(page).toHaveURL(/\/login\?verified=1/);
  });
});
