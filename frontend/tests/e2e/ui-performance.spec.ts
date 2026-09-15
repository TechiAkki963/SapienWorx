import { expect, test } from "@playwright/test";

import { expectStableLayout, installCLSObserver, resetE2E } from "./helpers";

test.describe("public UI stability", () => {
  test.beforeEach(async ({ request }) => resetE2E(request));

  test("renders human-led hero animations and organic-mask styling without material CLS", async ({ page }) => {
    await installCLSObserver(page);
    await page.goto("/");

    await expect(page.getByRole("heading", { name: /Your next opportunity/i })).toBeVisible();
    const human = page.locator(".hero-human");
    const orbit = page.locator(".hero-orbit");
    await expect(human).toBeVisible();
    await expect(orbit).toBeVisible();

    // Visibility alone is not enough: a broken image can still occupy layout space.
    // Confirm the browser actually decoded the committed human portrait.
    await expect.poll(async () =>
      human.evaluate((element) => {
        const image = element as HTMLImageElement;
        return image.complete && image.naturalWidth > 0 && image.naturalHeight > 0;
      }),
    ).toBe(true);

    expect(await human.evaluate((element) => getComputedStyle(element).animationName)).toBe("hero-float");
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

  test("honours reduced-motion preference", async ({ page }) => {
    await page.emulateMedia({ reducedMotion: "reduce" });
    await page.goto("/");
    const durationSeconds = await page.locator(".hero-human").evaluate((element) => {
      const value = getComputedStyle(element).animationDuration;
      return value.endsWith("ms") ? Number.parseFloat(value) / 1000 : Number.parseFloat(value);
    });
    expect(durationSeconds).toBeLessThanOrEqual(0.00001);
  });

  test.skip("exercises a mounted Framer Motion spring interaction", async () => {
    // Coverage gap: the reusable spring-driven FloatingProductCard is not mounted in the current landing composition.
  });
});
