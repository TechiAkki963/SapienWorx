import { expect, test, type Page } from "@playwright/test";

async function enterOtp(page: Page, label: "Email" | "Mobile") {
  for (let digit = 1; digit <= 6; digit += 1) {
    await page.getByLabel(`${label} verification code digit ${digit}`).fill(String(digit));
  }
}

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => window.localStorage.setItem("sapienworx.local-candidate-domain", "TECH"));
  await page.route("**/api/auth/csrf", (route) => route.fulfill({ status: 200, json: { token: "test-csrf" } }));
});

test("recruiter share dialog matches the social card and creates source-tagged share links", async ({ page }) => {
  await page.goto("/recruiter/jobs/manage");
  await page.getByLabel("Actions for Senior Product Designer").click();
  await page.getByRole("button", { name: "Share job" }).click();

  const card = page.getByLabel("Social media card preview");
  await expect(card).toBeVisible();
  await expect(card.getByText("Sapienworx", { exact: true })).toBeVisible();
  await expect(card.getByText("ENTERPRISE RECRUITMENT", { exact: true })).toBeVisible();
  await expect(card.getByText("Senior Product Designer", { exact: true })).toBeVisible();
  await expect(card.getByText("Nexora Technologies", { exact: true })).toBeVisible();
  await expect(page.getByText(/applications from every valid shared link/i)).toBeVisible();

  const linkedIn = await page.getByRole("link", { name: "in LinkedIn" }).getAttribute("href");
  const x = await page.getByRole("link", { name: "𝕏 X" }).getAttribute("href");
  const whatsApp = await page.getByRole("link", { name: "◉ WhatsApp" }).getAttribute("href");
  expect(decodeURIComponent(linkedIn ?? "")).toContain("source=linkedin");
  expect(decodeURIComponent(x ?? "")).toContain("source=x");
  expect(decodeURIComponent(whatsApp ?? "")).toContain("source=whatsapp");

  await page.getByRole("button", { name: "Close share dialog" }).click();
  await expect(card).toHaveCount(0);
});

test("public jobs publish a large branded Open Graph image and preserve the share source", async ({ page, request }) => {
  const image = await request.get("/jobs/SWX_NX_001/senior-backend-engineer/opengraph-image");
  expect(image.ok()).toBeTruthy();
  expect(image.headers()["content-type"]).toContain("image/png");
  expect((await image.body()).byteLength).toBeGreaterThan(10_000);

  await page.goto("/jobs/SWX_NX_001/senior-backend-engineer?source=linkedin");
  await expect(page.locator('meta[property="og:url"]')).toHaveAttribute("content", /^https:\/\/www\.sapienworx\.com\/jobs\//);
  await expect(page.locator('meta[property="og:image"]')).toHaveAttribute("content", /^https:\/\/www\.sapienworx\.com\/jobs\/.*\/opengraph-image$/);
  await expect(page.locator('meta[name="twitter:card"]')).toHaveAttribute("content", "summary_large_image");
  await expect(page.getByRole("link", { name: /Apply now/ }).first()).toHaveAttribute("href", "/register?job=SWX_NX_001&source=linkedin");
  await expect(page.getByText(/delivered only to the recruiter who posted this role/i)).toBeVisible();
});

test("shared intent and attribution survive candidate sign-in and reach the application API", async ({ page }) => {
  let applicationBody: Record<string, unknown> | undefined;
  await page.route("**/api/auth/request-otp", (route) => route.fulfill({ status: 200, json: { transactionId: "shared-job-login", requiredChannels: ["EMAIL", "MOBILE"] } }));
  await page.route("**/api/auth/verify-otp", async (route) => {
    const body = route.request().postDataJSON() as { channel: "EMAIL" | "MOBILE" };
    await route.fulfill({ status: 200, json: body.channel === "EMAIL" ? { authenticated: false, redirectTo: null, remainingChannels: ["MOBILE"] } : { authenticated: true, redirectTo: "/candidate", remainingChannels: [] } });
  });
  await page.route("**/api/candidate/jobs/SWX_NT_003/applications", async (route) => {
    applicationBody = route.request().postDataJSON() as Record<string, unknown>;
    await route.fulfill({ status: 200, json: {} });
  });
  await page.route("**/api/public/jobs", (route) => route.fulfill({ status: 200, json: { content: [] } }));

  await page.goto("/login?job=SWX_NT_003&ref=SWX-REFERRAL-1&source=linkedin");
  await expect(page.getByRole("link", { name: "Create an account" })).toHaveAttribute("href", "/register?job=SWX_NT_003&ref=SWX-REFERRAL-1&source=linkedin");
  await page.getByPlaceholder("you@example.com").fill("candidate@example.com");
  await page.getByPlaceholder("Enter your password").fill("TestPassword9!");
  await page.getByRole("button", { name: "Continue securely →" }).click();
  await enterOtp(page, "Email");
  await enterOtp(page, "Mobile");
  await page.getByRole("button", { name: "Verify both codes" }).click();

  await expect(page).toHaveURL(/\/candidate\/jobs\?sharedJob=SWX_NT_003&apply=applied/);
  expect(applicationBody).toEqual({ coverLetter: null, referralCode: "SWX-REFERRAL-1", source: "linkedin" });
  await expect(page.getByText(/is in the posting recruiter’s pipeline/i)).toBeVisible();
});

test("a vacancy closing during verification keeps the account and explains the outcome", async ({ page }) => {
  await page.route("**/api/auth/request-otp", (route) => route.fulfill({ status: 200, json: { transactionId: "closed-job-login", requiredChannels: ["EMAIL", "MOBILE"] } }));
  await page.route("**/api/auth/verify-otp", async (route) => {
    const body = route.request().postDataJSON() as { channel: "EMAIL" | "MOBILE" };
    await route.fulfill({ status: 200, json: body.channel === "EMAIL" ? { authenticated: false, redirectTo: null, remainingChannels: ["MOBILE"] } : { authenticated: true, redirectTo: "/candidate", remainingChannels: [] } });
  });
  await page.route("**/api/candidate/jobs/SWX_CLOSED/applications", (route) => route.fulfill({ status: 404, json: { detail: "Published job was not found." } }));
  await page.route("**/api/public/jobs", (route) => route.fulfill({ status: 200, json: { content: [] } }));

  await page.goto("/login?job=SWX_CLOSED&source=x");
  await page.getByPlaceholder("you@example.com").fill("candidate@example.com");
  await page.getByPlaceholder("Enter your password").fill("TestPassword9!");
  await page.getByRole("button", { name: "Continue securely →" }).click();
  await enterOtp(page, "Email");
  await enterOtp(page, "Mobile");
  await page.getByRole("button", { name: "Verify both codes" }).click();

  await expect(page).toHaveURL(/apply=unavailable/);
  await expect(page.getByText("This shared role is no longer accepting applications. Your account is still signed in.")).toBeVisible();
});
