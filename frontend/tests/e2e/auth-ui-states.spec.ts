import { expect, test } from "@playwright/test";

async function submit(page: import("@playwright/test").Page, role: "candidate" | "recruiter", code: string) {
  await page.route("**/api/v1/auth/login", (route) => route.fulfill({
    status: code === "invalid_credentials" ? 401 : 403,
    contentType: "application/json",
    body: JSON.stringify({ error: { code, message: "Access not granted" } }),
  }));
  await page.goto(role === "candidate" ? "/login" : "/recruiter/login");
  await page.getByLabel(role === "candidate" ? "Email" : "Work email").fill("review@example.com");
  await page.getByLabel("Password").fill("incorrect-or-not-yet-verified");
  await page.getByRole("button", { name: "Sign in" }).click();
}

test("incorrect credentials never invite email verification", async ({ page }) => {
  await submit(page, "candidate", "invalid_credentials");
  await expect(page.locator("form").getByRole("alert")).toContainText("Email or password is incorrect.");
  await expect(page.getByRole("link", { name: /Verify email/ })).toHaveCount(0);
});

test("valid credentials for an unverified email offer verification", async ({ page }) => {
  await submit(page, "candidate", "email_unverified");
  await expect(page.locator("form").getByRole("alert")).toContainText("Registration email verification is incomplete.");
  await expect(page.getByRole("link", { name: /Verify email/ })).toHaveAttribute("href", /verify-email/);
});

test("recruiter awaiting approval is not asked for another OTP", async ({ page }) => {
  await submit(page, "recruiter", "recruiter_approval_pending");
  await expect(page.locator("form").getByRole("alert")).toContainText("awaiting administrator approval");
  await expect(page.getByRole("link", { name: /Verify email/ })).toHaveCount(0);
});

test("OTP visual slots use one paste/autofill-friendly numeric input", async ({ page }) => {
  await page.goto("/verify-email?email=review%40example.com&role=candidate");
  const otp = page.getByLabel("Email verification code");
  await otp.fill("12x345678");
  await expect(otp).toHaveValue("123456");
  await expect(page.getByRole("button", { name: "Verify email" })).toBeEnabled();
  await otp.press("Backspace");
  await expect(otp).toHaveValue("12345");
  await expect(page.getByRole("button", { name: "Verify email" })).toBeDisabled();
  await expect(page).not.toHaveURL(/dev_otp/);
});
