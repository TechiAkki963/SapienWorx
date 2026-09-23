import { expect, test } from "@playwright/test";

import { expectStableLayout, installCLSObserver, resetE2E } from "./helpers";

test.describe("public UI stability", () => {
  test.beforeEach(async ({ request }) => resetE2E(request));

  test("renders crisp human-led hero styling without material CLS", async ({ page }) => {
    await installCLSObserver(page);
    await page.goto("/");

    await expect(page.getByRole("heading", { name: /Find work that feels right for you/i })).toBeVisible();
    const human = page.locator(".hero-human");
    await expect(human).toBeVisible();
    await expect(page.getByRole("link", { name: /For Recruiters/ }).first()).toHaveAttribute("href", "/recruiter/login");
    await expect(page.getByRole("button", { name: /Search jobs/ })).toBeVisible();
    await expect(page.getByRole("heading", { name: /Your career journey, all in one place/i })).toBeVisible();
    await expect(page.getByText("Illustrative candidate workspace")).toBeVisible();
    await expect(page.getByRole("heading", { name: /Practical advice for a brighter career/i })).toBeVisible();
    for (const label of ["Discover", "Grow", "Belong"]) {
      await expect(page.getByRole("heading", { name: label, exact: true })).toBeVisible();
    }


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

  test("keeps the landing search legible and accessible on a phone viewport", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto("/");

    const search = page.locator('form[role="search"]').filter({ has: page.locator("#home-q") });
    await expect(search).toBeVisible();
    await expect(search).toHaveCSS("opacity", "1");
    const searchTop = await search.boundingBox();
    const heroPortrait = await page.locator(".hero-human").boundingBox();
    expect(searchTop).not.toBeNull();
    expect(heroPortrait).not.toBeNull();
    // The approved mobile mockup puts search before the portrait.
    expect(searchTop!.y + searchTop!.height).toBeLessThan(heroPortrait!.y);


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
    expect(searchBox!.height).toBeLessThan(430);
    await expect(page.getByLabel("Experience", { exact: true })).toBeVisible();
    await expect(page.getByLabel("Experience", { exact: true })).toHaveValue("");
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
    await expect(page.locator("header").getByRole("link", { name: /Join/ })).toHaveAttribute("href", "/signup");
  });

  for (const width of [320, 360, 375, 390, 430, 768, 1024, 1280, 1440, 1920]) {
    test(`landing page does not overflow horizontally at ${width}px`, async ({ page }, testInfo) => {
      await page.setViewportSize({ width, height: 900 });
      await page.goto("/");
      await expect(page.getByRole("heading", { name: /Find work that feels right for you/i })).toBeVisible();
      const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
      expect(overflow).toBeLessThanOrEqual(1);
      // Reveal sections animate when scrolled into view. Visit the full document
      // before taking a full-page screenshot to avoid blank off-screen sections.
      await page.evaluate(async () => {
        const pause = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));
        const step = Math.max(500, window.innerHeight * 0.8);
        for (let y = 0; y < document.documentElement.scrollHeight; y += step) {
          window.scrollTo(0, y);
          await pause(185);
        }
        window.scrollTo(0, 0);
        await pause(450);
      });
      // Detect incomplete/lazy-loaded editorial covers instead of accepting
      // blank screenshot cards as a successful visual regression capture.
      await expect.poll(async () => page.locator("#knowledge-hub article img").evaluateAll(images => {
        // Supporting articles are intentionally hidden on phones; Next/Image
        // does not eagerly decode hidden images. Check visible editorial art.
        const visible = images.filter(image => image.getClientRects().length > 0);
        return visible.length > 0 && visible.every(image =>
          (image as HTMLImageElement).complete && (image as HTMLImageElement).naturalWidth > 0);
      })).toBe(true);
      await page.screenshot({ path: testInfo.outputPath(`landing-${width}.png`), fullPage: true, animations: "disabled" });
    });
  }

  test("submits keyword, experience and location through the public jobs route", async ({ page }) => {
    await page.goto("/");
    await page.getByLabel("Role or skill").fill("Software Engineer");
    await page.getByLabel("Experience", { exact: true }).selectOption("3");
    await page.getByLabel("Location", { exact: true }).fill("Mumbai");
    await page.getByRole("button", { name: /Search jobs/ }).click();
    await expect(page).toHaveURL(/jobs/);
    const params = new URL(page.url()).searchParams;
    expect(params.get("q")).toBe("Software Engineer");
    expect(params.get("experience")).toBe("3");
    expect(params.get("location")).toBe("Mumbai");
  });

  test.skip("exercises a mounted Framer Motion spring interaction", async () => {
    // Coverage gap: the reusable spring-driven FloatingProductCard is not mounted in the current landing composition.
  });
});
