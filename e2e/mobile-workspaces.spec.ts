import { expect, test, type Page } from "@playwright/test";

async function expectBottomWorkspaceNavigation(page: Page, minimumItems: number) {
  const dock = page.locator(".sidebar");
  await expect(dock).toBeVisible();
  await expect.poll(() => dock.getByRole("link").count()).toBeGreaterThanOrEqual(minimumItems);
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
  const mainPadding = await page.locator(".workspace-main").evaluate((element) => Number.parseFloat(getComputedStyle(element).paddingBottom));
  expect(mainPadding).toBeGreaterThanOrEqual(100);
}

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => window.localStorage.setItem("sapienworx.local-candidate-domain", "TECH"));
});

test("candidate, recruiter, and Master Admin keep primary navigation in a bottom dock and account actions under their initials", async ({ page }) => {
  await page.goto("/candidate/jobs");
  await expect(page.getByRole("link", { name: "Applications" })).toBeAttached();
  await expectBottomWorkspaceNavigation(page, 6);
  await expect(page.locator(".sidebar").getByRole("link", { name: "Settings", exact: true })).toHaveCount(0);
  await page.getByRole("button", { name: /Account menu/ }).click();
  await expect(page.getByRole("link", { name: "Settings", exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: "Log out" })).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(page.getByRole("link", { name: "Settings", exact: true })).toHaveCount(0);

  await page.goto("/recruiter/jobs");
  await expect(page.getByRole("link", { name: "Recruitment Workspace" })).toBeAttached();
  await expectBottomWorkspaceNavigation(page, 9);

  await page.route("**/api/admin/**", (route) => route.fulfill({ status: 503, json: { message: "Mobile shell fixture" } }));
  await page.goto("/admin");
  await expect(page.getByRole("link", { name: "Knowledge Hub" })).toBeAttached();
  await expectBottomWorkspaceNavigation(page, 8);
  await page.getByRole("button", { name: /Account menu/ }).click();
  await expect(page.getByRole("link", { name: "Settings", exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: "Log out" })).toBeVisible();
});

test("mobile sourcing cards retain engagement, CV, and freshness details", async ({ page }) => {
  await page.goto("/search/results?anyKeywords=Typescript%2CNode.js&location=Bengaluru");

  const card = page.locator(".talent-profile-card").filter({ has: page.getByRole("heading", { name: "Avish Bansal" }) });
  await expect(card).toBeVisible();
  await expect(card.getByRole("button", { name: "⇩ CV" })).toBeVisible();
  await expect(card.getByText(/Modified /)).toBeVisible();
  await expect(card.getByText(/Active /)).toBeVisible();
  const evidence = card.locator(".talent-profile-bottom > span").first();
  await expect(evidence).toBeVisible();
  await expect(evidence).toContainText(/\d+/);
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
