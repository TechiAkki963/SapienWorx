import { expect, test, type Page } from "@playwright/test";

async function enterOtp(page: Page, label: "Email" | "Mobile") {
  for (let digit = 1; digit <= 6; digit += 1) {
    await page.getByLabel(`${label} verification code digit ${digit}`).fill(String(digit));
  }
}

test("guides a mistyped OTP and visibly rate-limits resends", async ({ page }) => {
  await page.route("**/api/auth/request-otp", (route) => route.fulfill({ status: 200, json: { transactionId: "test-otp-transaction", requiredChannels: ["EMAIL", "MOBILE"] } }));
  await page.route("**/api/auth/verify-otp", (route) => route.fulfill({ status: 401, json: { detail: "That verification code is invalid or has expired." } }));
  await page.goto("/login");

  await page.getByPlaceholder("you@example.com").fill("candidate@example.com");
  await page.getByPlaceholder("Enter your password").fill("TestPassword9!");
  await page.getByRole("button", { name: "Continue securely →" }).click();
  await expect(page.getByRole("button", { name: "Resend code in 0:30" })).toBeDisabled();

  await enterOtp(page, "Email");
  await enterOtp(page, "Mobile");
  await page.getByRole("button", { name: "Verify both codes" }).click();
  await expect(page.getByText("That code didn’t match. Check the latest six-digit code, or request a new one when the timer ends.")).toBeVisible();
});

test("presents mixed parser evidence as a candidate-owned decision", async ({ page }) => {
  await page.addInitScript(() => window.localStorage.setItem("sapienworx.local-candidate-domain", "MIXED_AMBIGUOUS"));
  await page.goto("/candidate");

  await expect(page.getByRole("dialog")).toBeVisible();
  await expect(page.getByText("Your profile, your choice", { exact: true })).toBeVisible();
  await expect(page.getByRole("heading", { name: "You have a brilliantly diverse profile." })).toBeVisible();
  await expect(page.getByRole("button", { name: "Confirm my primary domain" })).toBeDisabled();
});

test("keeps CV parsing behind dual-contact verification", async ({ page }) => {
  await page.goto("/register");

  await expect(page.getByLabel("Upload CV for parsing")).toHaveCount(0);
  await expect(page.getByText("Current designation", { exact: true })).toHaveCount(0);
  await expect(page.getByText("Interested domains", { exact: true })).toBeVisible();
});
