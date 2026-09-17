import { expect, test } from "@playwright/test";
import fs from "node:fs";
import path from "node:path";

function source(relative: string) {
  return fs.readFileSync(path.join(process.cwd(), relative), "utf8");
}

test.describe("SapienWorx enterprise visual contracts", () => {
  test("landing portraits decode without material cumulative layout shift", async ({ page }) => {
    await page.addInitScript(() => {
      (window as Window & { __auditCLS?: number }).__auditCLS = 0;
      new PerformanceObserver((list) => {
        for (const entry of list.getEntries()) {
          const shift = entry as PerformanceEntry & { hadRecentInput?: boolean; value?: number };
          if (!shift.hadRecentInput) {
            (window as Window & { __auditCLS?: number }).__auditCLS! += shift.value ?? 0;
          }
        }
      }).observe({ type: "layout-shift", buffered: true });
    });

    await page.goto("/", { waitUntil: "networkidle" });
    const portraits = page.locator("img.hero-human, .organic-mask img");
    expect(await portraits.count()).toBeGreaterThan(0);

    for (let i = 0; i < (await portraits.count()); i += 1) {
      const decoded = await portraits.nth(i).evaluate((node) => {
        const image = node as HTMLImageElement;
        return image.complete && image.naturalWidth > 0 && image.naturalHeight > 0;
      });
      expect(decoded).toBe(true);
    }

    await page.waitForTimeout(750);
    const cls = await page.evaluate(() => (window as Window & { __auditCLS?: number }).__auditCLS ?? 0);
    expect(cls).toBeLessThanOrEqual(0.1);
  });

  test("4K AVIF delivery and Next image caching are enabled", async () => {
    const config = source("next.config.ts");
    // Enterprise target: local/remote sources should be served through the Next image
    // optimiser with AVIF support rather than bypassing it with unoptimised JPEG rewrites.
    expect(config).toMatch(/formats\s*:\s*\[[^\]]*["']image\/avif["']/s);
    expect(config).not.toMatch(/unoptimized\s*:\s*true/);
    expect(config).toMatch(/minimumCacheTTL\s*:/);
  });

  test("candidate portrait masking is organic and not circular", async () => {
    const portrait = source("components/brand/organic-portrait.tsx");
    const css = source("app/globals.css");
    expect(portrait).toContain("organic-mask");
    expect(portrait).not.toContain("rounded-full");
    expect(css).toMatch(/\.organic-mask\s*\{[^}]*clip-path\s*:/s);
  });

  test("core motion surfaces use spring physics", async () => {
    const drawer = source("components/recruiter/candidate-action-drawer.tsx");
    const inmail = source("components/recruiter/bulk-inmail-drawer.tsx");
    const floating = source("components/product/floating-product-card.tsx");

    for (const implementation of [drawer, inmail, floating]) {
      expect(implementation).toMatch(/type\s*:\s*["']spring["']/);
    }
  });
});
