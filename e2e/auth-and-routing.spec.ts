import { expect, test, type Page, type Route } from "@playwright/test";

const otpRequest = { transactionId: "test-otp-transaction", requiredChannels: ["EMAIL", "MOBILE"], trustedDeviceRecognised: false };

async function mockCandidateOtpFlow(page: Page) {
  await page.route("**/api/auth/request-otp", (route) => route.fulfill({ status: 200, json: otpRequest }));
  await page.route("**/api/auth/verify-otp", async (route: Route) => {
    const request = route.request().postDataJSON() as { channel: "EMAIL" | "MOBILE" };
    await route.fulfill({
      status: 200,
      json: request.channel === "EMAIL"
        ? { authenticated: false, redirectTo: null, remainingChannels: ["MOBILE"] }
        : { authenticated: true, redirectTo: "/candidate", remainingChannels: [] },
    });
  });
}

async function enterOtp(page: Page, label: "Email" | "Mobile") {
  await page.getByLabel(`${label} verification code digit 1`).fill("1");
  await expect(page.getByLabel(`${label} verification code digit 2`)).toBeFocused();
  for (let digit = 2; digit <= 6; digit += 1) {
    await page.getByLabel(`${label} verification code digit ${digit}`).fill(String(digit));
  }
  await expect(page.getByLabel(`${label} verification code digit 6`)).toHaveValue("6");
}

async function beginCandidateSignIn(page: Page) {
  // The portal switch is an intentional hydration check: subsequent form
  // interactions must pass through React's client-side event handlers.
  await page.getByRole("tab", { name: "Recruiter" }).click();
  await expect(page.getByPlaceholder("you@company.com")).toBeVisible();
  await page.getByRole("tab", { name: "Candidate" }).click();
  await expect(page.getByPlaceholder("you@example.com")).toBeVisible();
  await page.getByPlaceholder("you@example.com").fill("candidate@example.com");
  const password = page.getByPlaceholder("Enter your password");
  await password.click();
  await password.pressSequentially("TestPassword9!");
  const continueButton = page.getByRole("button", { name: "Continue securely →" });
  await expect(continueButton).toBeEnabled();
  await continueButton.click();
  await expect(page.getByText("Email code", { exact: true })).toBeVisible();
}

test.describe("Authentication and mandatory domain routing", () => {
  test("renders the candidate login form with its initial secure state", async ({ page }) => {
    await page.goto("/login");

    await expect(page.getByRole("link", { name: "Sapienworx home" })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Welcome back" })).toBeVisible();
    await expect(page.getByPlaceholder("you@example.com")).toBeVisible();
    await expect(page.getByPlaceholder("Enter your password")).toBeVisible();
    await expect(page.getByRole("button", { name: "Show password" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Continue securely →" })).toBeDisabled();
  });

  test("routes a verified technical candidate to the candidate dashboard", async ({ page }) => {
    await page.addInitScript(() => window.localStorage.setItem("sapienworx.local-candidate-domain", "TECH"));
    await mockCandidateOtpFlow(page);
    await page.goto("/login");

    await beginCandidateSignIn(page);
    await enterOtp(page, "Email");
    await enterOtp(page, "Mobile");
    await page.getByRole("button", { name: "Verify both codes" }).click();

    await expect(page).toHaveURL(/\/candidate$/);
    await expect(page.getByRole("heading", { name: "Profile performance" }).first()).toBeVisible();
    await expect(page.getByText("Profile appearances", { exact: true })).toBeVisible();
  });

  test("forces the unassigned candidate domain resolution before the dashboard", async ({ page }) => {
    await page.addInitScript(() => window.localStorage.removeItem("sapienworx.local-candidate-domain"));
    await mockCandidateOtpFlow(page);
    await page.goto("/login");

    await beginCandidateSignIn(page);
    await enterOtp(page, "Email");
    await enterOtp(page, "Mobile");
    await page.getByRole("button", { name: "Verify both codes" }).click();

    await expect(page).toHaveURL(/\/candidate$/);
    await expect(page.getByRole("heading", { name: "Tailor your Sapienworx experience." })).toBeVisible();
    await expect(page.getByRole("radio", { name: /Engineering & Technical/ })).toBeVisible();
    await expect(page.getByRole("button", { name: "Confirm my primary domain" })).toBeDisabled();
  });

  test("progresses recruiter onboarding from account to organisation details", async ({ page }) => {
    await page.goto("/recruiter/register");

    await expect(page.getByLabel("First name")).toBeVisible();
    await expect(page.getByLabel("Last name")).toBeVisible();
    await expect(page.getByLabel("Company name")).toHaveCount(0);
    await page.getByLabel("First name").fill("Riya");
    await page.getByLabel("Last name").fill("Recruiter");
    await page.getByLabel("Phone").fill("9873721034");
    await page.getByLabel("Work email id").fill("riya@examplecorp.test");
    await page.getByLabel("Password", { exact: true }).fill("TestPassword9!");
    await page.getByLabel("Confirm password").fill("TestPassword9!");
    await page.getByRole("button", { name: "Continue to organisation →" }).click();

    await expect(page.getByRole("heading", { name: "Tell us about your organisation" })).toBeVisible();
    await expect(page.getByLabel("City")).toBeVisible();
    await expect(page.getByLabel("State")).toBeVisible();
    await expect(page.getByLabel("Company name")).toHaveAttribute("type", "text");
    await expect(page.locator(".recruiter-field-grid select")).toHaveCount(0);
    await expect(page.getByText("review normally completes within one business day", { exact: false })).toBeVisible();
  });

  test("offers a real email password-reset journey and revokes old sessions", async ({ page }) => {
    await page.route("**/api/auth/password-reset/request", (route) => route.fulfill({ status: 200, json: { transactionId: "reset-transaction", message: "If this email belongs to a candidate account, a six-digit reset code has been sent." } }));
    await page.route("**/api/auth/password-reset/confirm", (route) => route.fulfill({ status: 204, body: "" }));
    await page.goto("/login");

    await page.getByRole("button", { name: "Forgot password?" }).click();
    await expect(page.getByRole("heading", { name: "Reset your password" })).toBeVisible();
    await page.getByRole("button", { name: "Send password reset code →" }).click();
    await expect(page.getByRole("heading", { name: "Check your work email" })).toBeVisible();
    await page.getByLabel("Six-digit email code").fill("123456");
    await page.getByLabel("New password", { exact: true }).fill("NewPassword9!");
    await page.getByLabel("Confirm new password").fill("NewPassword9!");
    await page.getByRole("button", { name: "Update password securely →" }).click();
    await expect(page.getByRole("heading", { name: "Password reset complete" })).toBeVisible();
    await expect(page.getByText("previous sessions have been closed", { exact: false })).toBeVisible();
  });

  test("steps a recognised candidate device down to email-only OTP", async ({ page }) => {
    await page.route("**/api/auth/request-otp", (route) => route.fulfill({ status: 200, json: { transactionId: "trusted-login", requiredChannels: ["EMAIL"], trustedDeviceRecognised: true } }));
    await page.goto("/login");
    await page.getByPlaceholder("you@example.com").fill("candidate@example.com");
    await page.getByPlaceholder("Enter your password").fill("TestPassword9!");
    await page.getByRole("button", { name: "Continue securely →" }).click();

    await expect(page.getByText("Recognised personal device", { exact: false })).toBeVisible();
    await expect(page.getByText("Mobile code", { exact: true })).toHaveCount(0);
    await expect(page.getByRole("button", { name: "Verify email code" })).toBeVisible();
  });

  test("matches recruiter companies against the official email domain before OTP", async ({ page }) => {
    await page.route("**/api/auth/organisations?**", (route) => route.fulfill({ status: 200, json: [{ id: "org-1", name: "Example Corp", workEmailDomain: "ex•••.test", domainStatus: "MATCH" }] }));
    await page.goto("/recruiter/register");
    await page.getByLabel("First name").fill("Riya");
    await page.getByLabel("Last name").fill("Recruiter");
    await page.getByLabel("Phone").fill("9873721034");
    await page.getByLabel("Work email id").fill("riya@examplecorp.test");
    await page.getByLabel("Password", { exact: true }).fill("TestPassword9!");
    await page.getByLabel("Confirm password").fill("TestPassword9!");
    await page.getByRole("button", { name: "Continue to organisation →" }).click();
    await page.getByLabel("Company name").fill("Example");

    await expect(page.getByRole("option", { name: /Example Corp/ })).toBeVisible();
    await page.getByRole("option", { name: /Example Corp/ }).click();
    await expect(page.getByText("Your work email matches this organisation.")).toBeVisible();
  });
});
