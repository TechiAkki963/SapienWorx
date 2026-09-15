import { expect, test } from "@playwright/test";

import { expectStableLayout, installCLSObserver, resetE2E } from "./helpers";

test.describe("public UI stability", () => {
  test.beforeEach(async ({ request }) => resetE2E(request));

  test("renders crisp human-led hero styling without material CLS", async ({ page }) => {
    await installCLSObserver(page);
    await page.goto("/");

    await expect(page.getByRole("heading", { name: /Your next opportunity/i })).toBeVisible();
    const human = page.locator(".hero-human");
    const orbit = page.locator(".hero-orbit");
    await expect(human).toBeVisible();
    await expect(orbit).toBeVisible();

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
    expect(await orbit.evaluate((element) => getComputedStyle(element).animationName)).toBe("orbit-drift");

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
    expect(searchBox!.height).toBeLessThan(260);
  });

  test("honours reduced-motion preference", async ({ page }) => {
    await page.emulateMedia({ reducedMotion: "reduce" });
    await page.goto("/");
    const durationSeconds = await page.locator(".hero-orbit").evaluate((element) => {
      const value = getComputedStyle(element).animationDuration;
      return value.endsWith("ms") ? Number.parseFloat(value) / 1000 : Number.parseFloat(value);
    });
    expect(durationSeconds).toBeLessThanOrEqual(0.00001);
  });

  test.skip("exercises a mounted Framer Motion spring interaction", async () => {
    // Coverage gap: the reusable spring-driven FloatingProductCard is not mounted in the current landing composition.
  });
});
