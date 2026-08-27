import { expect, test, type Page, type Route } from "@playwright/test";

const otpRequest = { transactionId: "test-otp-transaction", requiredChannels: ["EMAIL", "MOBILE"] };

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

  test("renders recruiter onboarding with manual company, city, and state fields", async ({ page }) => {
    await page.goto("/recruiter/register");

    await expect(page.getByLabel("First name")).toBeVisible();
    await expect(page.getByLabel("Last name")).toBeVisible();
    await expect(page.getByLabel("City")).toBeVisible();
    await expect(page.getByLabel("State")).toBeVisible();
    await expect(page.getByLabel("Company name")).toHaveAttribute("type", "text");
    await expect(page.locator(".recruiter-field-grid select")).toHaveCount(0);
  });
});
