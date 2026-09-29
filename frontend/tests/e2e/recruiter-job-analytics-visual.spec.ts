import { expect, test } from "@playwright/test";

import { login, resetE2E } from "./helpers";

const jobID = "60000000-0000-4000-8000-000000000001";

test("job analytics stays compact and readable across target recruiter widths", async ({ page, request }) => {
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
    await page.goto(`/recruiter/jobs/${jobID}/analytics`);
    await expect(page.getByRole("heading", { name: "Job analytics" })).toBeVisible();
    await expect(page.getByRole("region", { name: "Hiring funnel" })).toBeVisible();
    await expect(page.getByRole("region", { name: "Source performance" })).toBeVisible();
    const firstTrendBarHeight = await page.getByTestId("trend-bar").first().evaluate((element) => element.getBoundingClientRect().height);
    expect(firstTrendBarHeight, `${viewport.name} trend bar should be visible`).toBeGreaterThan(2);

    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - innerWidth);
    expect(overflow, `${viewport.name} analytics horizontal overflow`).toBeLessThanOrEqual(0);

    await page.evaluate(() => {
      window.scrollTo(0, 0);
      document.querySelectorAll("nextjs-portal").forEach((portal) => portal.remove());
    });
    await page.screenshot({
      path: `visual-artifacts/phase3-job-analytics/analytics-${viewport.name}.png`,
      fullPage: true,
    });
  }
});
