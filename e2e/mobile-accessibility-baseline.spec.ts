import { expect, test } from "@playwright/test";

test("mobile auth keeps touch targets at least 48px and avoids horizontal overflow", async ({ page }) => {
  await page.goto("/login");

  const button = page.getByRole("button", { name: "Continue securely →" });
  const box = await button.boundingBox();
  expect(box).not.toBeNull();
  expect(box!.height).toBeGreaterThanOrEqual(48);

  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  expect(overflow).toBeLessThanOrEqual(1);
});

test("mobile navigation controls remain reachable without clipping", async ({ page }) => {
  await page.goto("/candidate");

  const viewport = page.viewportSize();
  expect(viewport).not.toBeNull();

  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  expect(overflow).toBeLessThanOrEqual(1);

  const visibleButtons = page.getByRole("button").filter({ visible: true });
  const count = await visibleButtons.count();
  for (let index = 0; index < Math.min(count, 8); index += 1) {
    const box = await visibleButtons.nth(index).boundingBox();
    if (box) expect(box.height).toBeGreaterThanOrEqual(48);
  }
});
