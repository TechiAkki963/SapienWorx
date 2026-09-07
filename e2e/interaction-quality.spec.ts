import { expect, test } from "@playwright/test";

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => window.localStorage.setItem("sapienworx.local-candidate-domain", "TECH"));
});

test("keyboard users can bypass workspace navigation and retain a visible focus route", async ({ page }) => {
  await page.goto("/candidate/jobs");
  await expect(page.locator(".workspace-shell")).toBeVisible();
  const skip = page.getByRole("link", { name: "Skip to workspace content" });
  await skip.focus();
  await expect(skip).toBeFocused();
  await expect(skip).toBeVisible();
  await page.keyboard.press("Enter");
  await expect(page.locator("#workspace-content")).toBeFocused();

  await page.getByRole("button", { name: /Account menu/ }).focus();
  await page.keyboard.press("Enter");
  await expect(page.getByRole("link", { name: "Settings", exact: true })).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(page.getByRole("button", { name: /Account menu/ })).toBeFocused();
});

test("candidate, recruiter, and admin controls preserve touch targets and focus treatment", async ({ page }) => {
  for (const path of ["/candidate/jobs", "/recruiter/sourcing", "/admin"]) {
    await page.goto(path);
    const navItem = page.locator(".sidebar .nav-item").first();
    await expect(navItem).toBeVisible();
    const target = await navItem.evaluate((element) => {
      const box = element.getBoundingClientRect();
      return { height: box.height, width: box.width };
    });
    expect(target.height).toBeGreaterThanOrEqual(44);
    expect(target.width).toBeGreaterThanOrEqual(44);
    await navItem.focus();
    await expect(navItem).toBeFocused();
  }
});

test("reduced-motion mode suppresses nonessential workspace motion", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/recruiter/pipeline");
  const duration = await page.locator(".sidebar .nav-item").first().evaluate((element) => getComputedStyle(element).transitionDuration);
  expect(Number.parseFloat(duration)).toBeLessThanOrEqual(0.001);
});
