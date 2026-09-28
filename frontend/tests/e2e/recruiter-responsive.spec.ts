import { expect, test } from "@playwright/test";

import { login, resetE2E } from "./helpers";

test.beforeEach(async ({ request }) => resetE2E(request));

test("primary recruiter workspaces fit desktop, laptop, tablet and mobile widths", async ({ page }) => {
  test.setTimeout(180_000);
  await login(page, "recruiter");
  const routes = [
    "/recruiter", "/recruiter/jobs", "/recruiter/pipeline", "/recruiter/interviews", "/recruiter/messages", "/recruiter/discover", "/recruiter/talent-pool",
    "/recruiter/jobs/new", "/recruiter/jobs/60000000-0000-4000-8000-000000000001/edit",
    "/recruiter/jobs/60000000-0000-4000-8000-000000000001/applicants",
    "/recruiter/candidates/71000000-0000-4000-8000-000000000001?job_id=60000000-0000-4000-8000-000000000001",
  ];
  const viewports = [
    [1920, 1080], [1600, 900], [1440, 900], [1366, 768], [1280, 800],
    [1024, 768], [768, 1024], [430, 932], [375, 812], [320, 568],
  ];
  for (const [width, height] of viewports) {
    await page.setViewportSize({ width, height });
    for (const route of routes) {
      await page.goto(route);
      await expect(page.locator("main")).toBeVisible();
      const overflow = await page.evaluate(() => ({ page: document.documentElement.scrollWidth, viewport: innerWidth, offenders: [...document.querySelectorAll("body *")].filter((element) => element.getBoundingClientRect().right > innerWidth + 1).slice(-15).map((element) => `${element.tagName.toLowerCase()}.${String(element.className).slice(0, 55)}:${Math.round(element.getBoundingClientRect().right)}`) }));
      expect(overflow.page, `${route} at ${width}×${height} overflows by ${overflow.page - overflow.viewport}px: ${overflow.offenders.join(", ")}`).toBeLessThanOrEqual(width);
    }
  }
});
