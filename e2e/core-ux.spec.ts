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

test("previews a CV and records privacy-safe time-to-value telemetry", async ({ page }) => {
  await page.addInitScript(() => {
    (window as Window & { sapienworxEvents?: Array<{ name: string; properties: Record<string, unknown> }> }).sapienworxEvents = [];
    window.addEventListener("sapienworx:analytics", (event) => {
      (window as Window & { sapienworxEvents?: Array<{ name: string; properties: Record<string, unknown> }> }).sapienworxEvents?.push((event as CustomEvent<{ name: string; properties: Record<string, unknown> }>).detail);
    });
  });
  await page.goto("/register");
  const startedAt = Date.now();

  await page.getByRole("button", { name: "Build from my CV" }).click();
  await page.getByLabel("Paste CV text to preview extraction").fill("Amara Mensah\namara@example.com\n+91 9876540123\nSenior Product Designer\nSkills\nFigma, Research\nExperience\nSenior Product Designer at Northstar Studio\n2022 - Present");
  await page.getByRole("button", { name: "Extract profile details" }).click();

  await expect(page.getByRole("heading", { name: "Review extracted details" })).toBeVisible();
  await expect(page.getByText(/Details extracted in \d+ms/)).toBeVisible();
  expect(Date.now() - startedAt).toBeLessThan(30_000);
  const event = await page.evaluate(() => (window as Window & { sapienworxEvents?: Array<{ name: string; properties: { durationMs?: number; warningCount?: number } }> }).sapienworxEvents?.find((item) => item.name === "candidate_cv_profile_previewed"));
  expect(event?.properties.durationMs).toBeGreaterThanOrEqual(0);
  expect(event?.properties.warningCount).toBeGreaterThanOrEqual(0);
});
