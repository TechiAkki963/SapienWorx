import { expect, test } from "@playwright/test";

async function enterOtp(page: import("@playwright/test").Page, label: "Email" | "Mobile") {
  for (let digit = 1; digit <= 6; digit += 1) {
    await page.getByLabel(`${label} verification code digit ${digit}`).fill(String(digit));
  }
}

test("guides a candidate through career direction, account details, and dual-contact verification", async ({ page }) => {
  let requestBody: Record<string, unknown> | undefined;
  await page.route("**/api/auth/request-otp", async (route) => {
    requestBody = route.request().postDataJSON() as Record<string, unknown>;
    await route.fulfill({ status: 200, json: { transactionId: "candidate-profile-otp", requiredChannels: ["EMAIL", "MOBILE"] } });
  });

  await page.goto("/register");
  await expect(page.getByText("Career essentials", { exact: true })).toHaveCount(0);
  await expect(page.getByText("Career direction", { exact: true })).toBeVisible();
  await expect(page.getByRole("checkbox", { name: "All" })).toHaveAttribute("aria-checked", "false");
  await page.getByRole("radio", { name: /Fresher/ }).click();
  await page.getByRole("radio", { name: /Technology \/ IT/ }).click();
  await page.getByRole("checkbox", { name: "Technology", exact: true }).click();
  await page.getByRole("button", { name: "Continue to account details →" }).click();
  await expect(page.getByText("Account details", { exact: true })).toBeVisible();
  await page.getByLabel("First name").fill("Asha");
  await page.getByLabel("Last name").fill("Raman");
  await page.getByLabel("Email address").fill("asha@example.com");
  await page.getByLabel("Mobile number").fill("+91 9876543210");
  await page.getByLabel("Create password").fill("TestPassword9!");
  await page.getByLabel("Confirm password").fill("TestPassword9!");
  await page.getByRole("checkbox", { name: /I agree to the Terms and Privacy notice/ }).check();
  await page.getByRole("checkbox", { name: /I confirm I am 18 or older/ }).check();
  await page.getByRole("button", { name: "Continue to verification →" }).click();

  await expect(page.getByText("Email code", { exact: true })).toBeVisible();
  expect(requestBody).toMatchObject({
    flow: "CANDIDATE_REGISTRATION",
    firstName: "Asha",
    lastName: "Raman",
    email: "asha@example.com",
    mobile: "+91 9876543210",
    careerStage: "FRESHER",
    domainCategory: "TECH",
    interestedDomains: ["Technology"],
    password: "TestPassword9!",
  });
  expect(requestBody).not.toHaveProperty("headline");
});

test("does not render an empty candidate profile when the session is absent", async ({ page }) => {
  await page.addInitScript(() => window.localStorage.setItem("sapienworx.local-candidate-domain", "TECH"));
  await page.route("**/api/candidate/profile", (route) => route.fulfill({ status: 403, json: { detail: "Candidate access is required." } }));

  await page.goto("/candidate/profile");

  await expect(page.getByRole("heading", { name: "Sign in to continue your profile" })).toBeVisible();
  await expect(page.getByRole("link", { name: "Sign in as a candidate" })).toHaveAttribute("href", "/login");
  await expect(page.getByText("Your profile is available once you sign in with your candidate account.")).toHaveCount(0);
});

test("offers CV parsing only after candidate email and mobile OTP verification", async ({ page, context }) => {
  await context.addCookies([{ name: "XSRF-TOKEN", value: "test-csrf", domain: "localhost", path: "/" }]);
  let cvUploads = 0;
  await page.route("**/api/auth/csrf", (route) => route.fulfill({ status: 200, json: { token: "test-csrf" } }));
  await page.route("**/api/auth/request-otp", (route) => route.fulfill({ status: 200, json: { transactionId: "candidate-cv-otp", requiredChannels: ["EMAIL", "MOBILE"] } }));
  await page.route("**/api/auth/verify-otp", async (route) => {
    const request = route.request().postDataJSON() as { channel: "EMAIL" | "MOBILE" };
    await route.fulfill({ status: 200, json: request.channel === "EMAIL" ? { authenticated: false, redirectTo: null, remainingChannels: ["MOBILE"] } : { authenticated: true, redirectTo: "/candidate", remainingChannels: [] } });
  });
  await page.route("**/api/candidate/cv", async (route) => {
    cvUploads += 1;
    await route.fulfill({ status: 200, json: { requestId: "queued-cv", status: "QUEUED" } });
  });

  await page.goto("/register");
  await expect(page.getByLabel("Upload CV for parsing")).toHaveCount(0);
  await page.getByRole("radio", { name: /Experienced/ }).click();
  await page.getByRole("radio", { name: /Technology \/ IT/ }).click();
  await page.getByRole("checkbox", { name: "Technology", exact: true }).click();
  await page.getByRole("button", { name: "Continue to account details →" }).click();
  await page.getByLabel("First name").fill("Asha");
  await page.getByLabel("Last name").fill("Raman");
  await page.getByLabel("Email address").fill("asha@example.com");
  await page.getByLabel("Mobile number").fill("+91 9876543210");
  await page.getByLabel("Create password").fill("TestPassword9!");
  await page.getByLabel("Confirm password").fill("TestPassword9!");
  await page.getByRole("checkbox", { name: /I agree to the Terms and Privacy notice/ }).check();
  await page.getByRole("checkbox", { name: /I confirm I am 18 or older/ }).check();
  await page.getByRole("button", { name: "Continue to verification →" }).click();
  await enterOtp(page, "Email");
  await enterOtp(page, "Mobile");
  await expect(page.getByText("Build from your CV", { exact: true })).toBeVisible();
  await expect(page.getByText("Finish later", { exact: true })).toBeVisible();
  await page.getByLabel("Upload CV for parsing").setInputFiles({ name: "asha-raman.pdf", mimeType: "application/pdf", buffer: Buffer.from("candidate cv") });
  expect(cvUploads).toBe(0);
  await page.getByRole("button", { name: "Upload and parse CV →" }).click();
  await expect(page.getByText("asha-raman.pdf is uploaded and being extracted.")).toBeVisible();
  expect(cvUploads).toBe(1);
});
