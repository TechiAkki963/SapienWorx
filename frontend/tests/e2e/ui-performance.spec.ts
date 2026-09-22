import { expect, test } from "@playwright/test";

import { expectStableLayout, installCLSObserver, resetE2E } from "./helpers";

test.describe("public UI stability", () => {
  test.beforeEach(async ({ request }) => resetE2E(request));

  test("renders crisp human-led hero styling without material CLS", async ({ page }) => {
    await installCLSObserver(page);
    await page.goto("/");

    await expect(page.getByRole("heading", { name: /Your next opportunity/i })).toBeVisible();
    const human = page.locator(".hero-human");
    await expect(human).toBeVisible();

    // Visibility alone is not enough: a broken image can still occupy layout space.
    // Confirm the browser actually decoded the human portrait at a useful source size.
    await expect.poll(async () =>
      human.evaluate((element) => {
        const image = element as HTMLImageElement;
        return image.complete && image.naturalWidth >= 1000 && image.naturalHeight >= 600;
      }),
    ).toBe(true);

    // Keep decorative motion around the photography instead of resampling the
    // image bitmap itself, which can make portraits visibly soft on HiDPI screens.
    expect(await human.evaluate((element) => getComputedStyle(element).animationName)).toBe("none");
    await expect(page.locator(".hero-orbit")).toHaveCount(0);
    await expect(page.getByText("Product Designer", { exact: true })).toHaveCount(0);

    const organicMask = await page.evaluate(() => {
      const element = document.createElement("div");
      element.className = "organic-mask";
      document.body.appendChild(element);
      const clipPath = getComputedStyle(element).clipPath;
      element.remove();
      return clipPath;
    });
    expect(organicMask).toContain("polygon");

    await expectStableLayout(page, 0.1);
  });

  test("keeps the landing search compact on a phone viewport", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto("/");

    const search = page.locator('form[role="search"]').filter({ has: page.locator("#home-q") });
    await expect(search).toBeVisible();

    const searchBox = await search.boundingBox();
    const queryBox = await page.locator("#home-q").boundingBox();
    const locationBox = await page.locator("#home-location").boundingBox();
    const buttonBox = await search.locator('button[type="submit"]').boundingBox();

    expect(searchBox).not.toBeNull();
    expect(queryBox).not.toBeNull();
    expect(locationBox).not.toBeNull();
    expect(buttonBox).not.toBeNull();

    // Inputs should use the available card width and remain normal-height fields,
    // rather than becoming one oversized rounded capsule on narrow screens.
    expect(queryBox!.width).toBeGreaterThan(300);
    expect(queryBox!.height).toBeLessThanOrEqual(56);
    expect(locationBox!.height).toBeLessThanOrEqual(56);
    expect(buttonBox!.width).toBeGreaterThan(300);
    expect(searchBox!.height).toBeLessThan(420);
  });

  test("keeps the portrait clear and recruiter entry distinct", async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto("/");
    await expect(page.getByRole("heading", { name: /Your next opportunity/i })).toBeVisible();
    await expect(page.getByRole("link", { name: /For Recruiters/i })).toHaveAttribute("href", "/recruiter/login");
    await expect(page.getByRole("link", { name: /Find your next role/i })).toHaveAttribute("href", "#job-search");
    const portrait = await page.locator(".hero-human").boundingBox();
    const search = await page.locator(".landing-search").boundingBox();
    expect(portrait).not.toBeNull();
    expect(search).not.toBeNull();
    expect(search!.y).toBeGreaterThan(portrait!.y + portrait!.height - 60);
    await expect(page.getByText("Human Potential Real Progress")).toHaveCount(0);
  });

  test("honours reduced-motion preference", async ({ page }) => {
    await page.emulateMedia({ reducedMotion: "reduce" });
    await page.goto("/");
    const durationSeconds = await page.locator(".hero-human").evaluate((element) => {
      const value = getComputedStyle(element).animationDuration;
      return value.endsWith("ms") ? Number.parseFloat(value) / 1000 : Number.parseFloat(value);
    });
    expect(durationSeconds).toBeLessThanOrEqual(0.00001);
  });

  test("keeps mobile navigation and candidate signup reachable", async ({ page }) => {
    await page.setViewportSize({ width: 360, height: 780 });
    await page.goto("/");
    await page.getByText("Menu", { exact: false }).click();
    const nav = page.getByRole("navigation", { name: "Mobile navigation" });
    await expect(nav.getByRole("link", { name: "Find Jobs" })).toBeVisible();
    await expect(nav.getByRole("link", { name: "Log in" })).toBeVisible();
    await expect(nav.getByRole("link", { name: "For Recruiters" })).toHaveAttribute("href", "/recruiter/login");
    await expect(page.getByRole("link", { name: /Join/ })).toHaveAttribute("href", "/signup");
  });

  for (const width of [360, 390, 768, 1024, 1280, 1440]) {
    test(`landing page does not overflow horizontally at ${width}px`, async ({ page }) => {
      await page.setViewportSize({ width, height: 900 });
      await page.goto("/");
      await expect(page.getByRole("heading", { name: /Your next opportunity/i })).toBeVisible();
      const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
      expect(overflow).toBeLessThanOrEqual(1);
      await page.screenshot({ path: `test-results/visual/landing-${width}.png`, fullPage: true });
    });
  }

  test.skip("exercises a mounted Framer Motion spring interaction", async () => {
    // Coverage gap: the reusable spring-driven FloatingProductCard is not mounted in the current landing composition.
  });
});
