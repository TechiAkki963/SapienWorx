import { expect, test } from "@playwright/test";
import { login, resetE2E } from "./helpers";

test.beforeEach(async ({ request }) => { await resetE2E(request); });

for (const [width, height] of [[1920,1080],[1440,900],[1366,768],[1024,768],[768,1024],[428,926],[360,800]]) {
  test(`candidate dashboard fits ${width}x${height}`, async ({ page }) => {
    await page.setViewportSize({ width, height });
    await login(page, "candidate");
    await expect(page.getByRole("heading", { name: "Your search, with room to grow." })).toBeVisible();
    const layout = await page.evaluate(() => ({
      viewport: document.documentElement.clientWidth,
      content: document.documentElement.scrollWidth,
      headingRight: document.querySelector("main h1")!.getBoundingClientRect().right,
    }));
    expect(layout.content).toBeLessThanOrEqual(layout.viewport);
    expect(layout.headingRight).toBeLessThanOrEqual(layout.viewport);
    await expect(page.getByRole("link", { name: "Improve profile", exact: true })).toBeVisible();
  });
  test(`recruiter profile controls do not cover initials at ${width}x${height}`, async ({ page }) => {
    await page.setViewportSize({ width, height });
    await login(page, "recruiter");
    const profile = page.getByRole("region", { name: "Your dashboard profile" });
    const initials = await profile.locator('div[aria-hidden="true"] > span').boundingBox();
    const edit = await profile.getByRole("button", { name: "Change profile photo" }).boundingBox();
    expect(initials).not.toBeNull();
    expect(edit).not.toBeNull();
    const overlap = initials!.x < edit!.x + edit!.width && initials!.x + initials!.width > edit!.x
      && initials!.y < edit!.y + edit!.height && initials!.y + initials!.height > edit!.y;
    expect(overlap).toBe(false);
  });
}
