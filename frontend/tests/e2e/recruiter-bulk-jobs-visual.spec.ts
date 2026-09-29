import { expect, test } from "@playwright/test";

import { login, resetE2E } from "./helpers";

test("bulk job controls remain compact after selection across recruiter breakpoints", async ({ page, request }) => {
  await resetE2E(request);
  await login(page, "recruiter");

  const viewports = [
    { name: "desktop-1440", width: 1440, height: 900 },
    { name: "laptop-1366", width: 1366, height: 768 },
    { name: "tablet", width: 768, height: 1024 },
    { name: "mobile-390", width: 390, height: 844 },
    { name: "mobile-320", width: 320, height: 800 },
  ];

  for (const viewport of viewports) {
    await page.setViewportSize({ width: viewport.width, height: viewport.height });
    await page.goto("/recruiter/jobs");
    await page.locator('input[data-bulk-job-id="60000000-0000-4000-8000-000000000001"]:visible').check();
    await page.getByLabel("Bulk action").selectOption("reassign");
    await page.getByLabel("Assign recruiter").selectOption("20000000-0000-4000-8000-000000000002");
    await expect(page.getByText("1 selected on this page")).toBeVisible();

    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - innerWidth);
    expect(overflow, `${viewport.name} bulk job horizontal overflow`).toBeLessThanOrEqual(0);

    await page.evaluate(() => {
      window.scrollTo(0, 0);
      if (document.activeElement instanceof HTMLElement) document.activeElement.blur();
      document.querySelectorAll("nextjs-portal").forEach((portal) => portal.remove());
      document.querySelector<HTMLElement>(".skip-link")?.style.setProperty("display", "none", "important");
      document.querySelector<HTMLElement>("header")?.style.setProperty("position", "static", "important");
    });
    await page.screenshot({
      path: `visual-artifacts/phase3-bulk-jobs/bulk-jobs-${viewport.name}.png`,
      fullPage: true,
    });
  }
});
