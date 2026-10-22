import { expect, test, type Page } from "@playwright/test";
import { login, resetE2E } from "./helpers";

test.beforeEach(async ({ request }) => {
  await resetE2E(request);
});

async function openRecruiterProfile(page: Page) {
  if ((page.viewportSize()?.width ?? 1440) >= 1024) {
    const nav = page.locator("#recruiter-desktop-nav");
    await nav.getByLabel(/Account menu for/).click();
    await nav.getByRole("button", { name: "View profile", exact: true }).click();
  } else {
    await page.getByRole("button", { name: "More", exact: true }).click();
    await page
      .getByRole("dialog", { name: "More recruiter tools", exact: true })
      .getByRole("button", { name: "My profile", exact: true })
      .click();
  }
  await expect(
    page.getByRole("dialog", { name: "Your recruiter profile", exact: true }),
  ).toBeVisible();
}

for (const [width, height] of [
  [1920, 1080],
  [1440, 900],
  [1366, 768],
  [1024, 768],
  [768, 1024],
  [428, 926],
  [360, 800],
]) {
  test(`candidate dashboard fits ${width}x${height}`, async ({ page }) => {
    await page.setViewportSize({ width, height });
    await login(page, "candidate");
    await expect(
      page.getByRole("heading", { name: "Your overview" }),
    ).toBeVisible();
    const layout = await page.evaluate(() => ({
      viewport: document.documentElement.clientWidth,
      content: document.documentElement.scrollWidth,
      headingRight: document.querySelector("main h1")!.getBoundingClientRect()
        .right,
    }));
    expect(layout.content).toBeLessThanOrEqual(layout.viewport);
    expect(layout.headingRight).toBeLessThanOrEqual(layout.viewport);
    await expect(
      page.getByRole("link", { name: "Edit profile", exact: true }),
    ).toBeVisible();
  });
  test(`recruiter profile controls do not cover initials at ${width}x${height}`, async ({
    page,
  }) => {
    await page.setViewportSize({ width, height });
    await login(page, "recruiter");
    await openRecruiterProfile(page);
    const profile = page.getByRole("region", {
      name: "Recruiter identity",
    });
    await expect(
      profile.getByRole("heading", { name: "Riya Recruiter", exact: true }),
    ).toBeVisible();
    const initials = await profile
      .locator('span[aria-hidden="true"]')
      .boundingBox();
    const edit = await profile
      .getByRole("button", { name: "Change profile photo" })
      .boundingBox();
    expect(initials).not.toBeNull();
    expect(edit).not.toBeNull();
    const overlap =
      initials!.x < edit!.x + edit!.width &&
      initials!.x + initials!.width > edit!.x &&
      initials!.y < edit!.y + edit!.height &&
      initials!.y + initials!.height > edit!.y;
    expect(overlap).toBe(false);
    await page.screenshot({
      path: `visual-artifacts/recruiter-account/profile-${width}x${height}.png`,
    });
  });
}
