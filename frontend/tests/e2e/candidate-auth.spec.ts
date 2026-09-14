import { expect, test } from "@playwright/test";

import { resetE2E } from "./helpers";

test.describe("candidate authentication", () => {
  test.beforeEach(async ({ request }) => resetE2E(request));

  test("registers and completes mocked mobile and email verification", async ({ page }) => {
    await page.goto("/signup");
    await page.getByLabel("Full name").fill("Aarav Candidate");
    await page.getByLabel("Email").fill("aarav@example.com");
    await page.getByLabel("Mobile number").fill("+919876543210");
    await page.getByLabel("Password").fill("Candidate-E2E-123!");

    const register = page.waitForRequest((request) => request.url().endsWith("/api/v1/auth/candidate/register") && request.method() === "POST");
    await page.getByRole("button", { name: "Create account" }).click();
    expect((await register).postDataJSON()).toMatchObject({ full_name: "Aarav Candidate", email: "aarav@example.com", phone: "+919876543210" });

    await expect(page).toHaveURL(/\/verify-phone\?.*role=candidate/);
    await expect(page.getByText("Development OTP:")).toContainText("123456");
    await page.getByLabel("Verification code").fill("123456");
    const otp = page.waitForRequest((request) => request.url().endsWith("/api/v1/auth/otp/verify") && request.method() === "POST");
    await page.getByRole("button", { name: "Verify mobile & continue" }).click();
    expect((await otp).postDataJSON()).toEqual({ email: "aarav@example.com", code: "123456", purpose: "phone_verification" });

    await expect(page).toHaveURL(/\/verify-email\?.*role=candidate/);
    const requestEmail = page.waitForRequest((request) => request.url().endsWith("/api/v1/auth/email/request") && request.method() === "POST");
    await page.getByRole("button", { name: "Send verification code" }).click();
    expect((await requestEmail).postDataJSON()).toEqual({ email: "aarav@example.com" });
    await expect(page.getByLabel("Email verification code")).toHaveValue("654321");

    const verifyEmail = page.waitForRequest((request) => request.url().endsWith("/api/v1/auth/email/verify") && request.method() === "POST");
    await page.getByRole("button", { name: "Verify email" }).click();
    expect((await verifyEmail).postDataJSON()).toEqual({ email: "aarav@example.com", code: "654321" });
    await expect(page).toHaveURL(/\/login\?verified=1/);
  });
});
