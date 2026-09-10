import { expect, test, type Page } from "@playwright/test";

async function expectBottomWorkspaceNavigation(page: Page, expectedItems = 5) {
  const dock = page.locator(".workspace-mobile-nav");
  await expect(dock).toBeVisible();
  await expect(dock.getByRole("link")).toHaveCount(expectedItems);
  const layout = await dock.evaluate((element) => {
    const style = getComputedStyle(element);
    const bounds = element.getBoundingClientRect();
    return {
      position: style.position,
      bottomGap: Math.abs(window.innerHeight - bounds.bottom),
      widthGap: Math.abs(window.innerWidth - bounds.width),
      minimumTarget: Math.min(...Array.from(element.querySelectorAll<HTMLElement>(".nav-item")).map((item) => item.getBoundingClientRect().height)),
    };
  });
  expect(layout.position).toBe("fixed");
  expect(layout.bottomGap).toBeLessThanOrEqual(1);
  expect(layout.widthGap).toBeLessThanOrEqual(1);
  expect(layout.minimumTarget).toBeGreaterThanOrEqual(44);
  await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1)).toBe(true);
}

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => window.localStorage.setItem("sapienworx.local-candidate-domain", "TECH"));
});

test("candidate and recruiter use a five-item mobile bottom dock while account actions remain under initials", async ({ page }) => {
  await page.goto("/candidate/jobs");
  await expectBottomWorkspaceNavigation(page);
  await expect(page.locator(".workspace-mobile-nav").getByRole("link", { name: "Applications" })).toBeVisible();
  await page.getByRole("button", { name: /Account menu/ }).click();
  await expect(page.getByRole("link", { name: "Settings", exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: "Log out" })).toBeVisible();
  await page.keyboard.press("Escape");

  await page.goto("/recruiter/jobs");
  await expectBottomWorkspaceNavigation(page);
  const recruiterDock = page.locator(".workspace-mobile-nav");
  await expect(recruiterDock.getByRole("link", { name: "Jobs", exact: true })).toBeVisible();
  await expect(recruiterDock.getByRole("link", { name: "Interviews", exact: true })).toBeVisible();
});

test("Master Admin remains operational on mobile and keeps account actions available", async ({ page }) => {
  await page.route("**/api/admin/**", (route) => route.fulfill({ status: 503, json: { message: "Mobile shell fixture" } }));
  await page.goto("/admin");
  await expect(page.getByRole("link", { name: "Knowledge Hub" })).toBeAttached();
  await page.getByRole("button", { name: /Account menu/ }).click();
  await expect(page.getByRole("link", { name: "Settings", exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: "Log out" })).toBeVisible();
  await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1)).toBe(true);
});

test("mobile sourcing result cards retain CV, relevance and freshness details", async ({ page }) => {
  await page.goto("/search/results?anyKeywords=Typescript%2CNode.js&location=Bengaluru");

  const card = page.getByRole("heading", { name: "Avish Bansal" }).locator("xpath=ancestor::article");
  await expect(card).toBeVisible();
  await expect(card.getByText("CV available", { exact: true })).toBeVisible();
  await expect(card.getByText(/Relevance \d+%/)).toBeVisible();
  await expect(card.getByText(/Profile updated /)).toBeVisible();
  await expect(card.getByText(/Last active /)).toBeVisible();
  await expect.poll(() => card.evaluate((element) => element.scrollWidth <= element.clientWidth + 1)).toBe(true);
});

test("candidate signup is touch-friendly, starts unselected, and keeps rapidly entered names", async ({ page }) => {
  await page.goto("/register");

  const technologyInterest = page.getByRole("checkbox", { name: "Technology", exact: true });
  await expect(technologyInterest).toHaveAttribute("aria-checked", "false");
  const interestHeight = await technologyInterest.evaluate((element) => element.getBoundingClientRect().height);
  expect(interestHeight).toBeGreaterThanOrEqual(44);

  await page.getByRole("radio", { name: /Experienced/ }).click();
  await page.getByRole("radio", { name: /Technology \/ IT/ }).click();
  await technologyInterest.click();
  await page.getByRole("button", { name: "Continue to account details →" }).click();

  await page.getByLabel("First name").fill("Asha");
  await page.getByLabel("Last name").fill("Rao");
  await expect(page.getByLabel("First name")).toHaveValue("Asha");
  await expect(page.getByLabel("Last name")).toHaveValue("Rao");
  await expect(page.getByText("Account details", { exact: true })).toBeVisible();
  await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1)).toBe(true);
});

test("Master Admin login reports actionable field validation before an API request", async ({ page }) => {
  let requests = 0;
  await page.route("**/api/auth/request-otp", (route) => { requests += 1; return route.abort(); });
  await page.goto("/admin/login");
  await page.getByRole("button", { name: "Continue to OTP →" }).click();

  await expect(page.getByText("Enter the approved Master Admin email address.")).toBeVisible();
  await expect(page.getByText("Enter your password (at least 8 characters).")).toBeVisible();
  expect(requests).toBe(0);
});
