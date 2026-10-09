import { expect, test } from "@playwright/test";
import fs from "node:fs/promises";

import { login, resetE2E } from "./helpers";

const recruiterAreas = [
  { slug: "dashboard", path: "/recruiter", heading: /Good|Welcome|Dashboard/i, sharedHeader: true },
  { slug: "discover", path: "/recruiter/discover", heading: "Discover Talent", sharedHeader: true },
  { slug: "talent-pool", path: "/recruiter/talent-pool", heading: "Talent Pool", sharedHeader: true },
  { slug: "jobs", path: "/recruiter/jobs", heading: "Job management", sharedHeader: true },
  { slug: "interviews", path: "/recruiter/interviews", heading: "Interviews", sharedHeader: true },
  { slug: "offers", path: "/recruiter/offers", heading: "Offers", sharedHeader: true },
  { slug: "outreach", path: "/recruiter/outreach", heading: "Outreach", sharedHeader: true },
  { slug: "saved-searches", path: "/recruiter/saved-searches", heading: "Saved searches & alerts", sharedHeader: true },
  { slug: "referrals", path: "/recruiter/referrals", heading: "Referrals", sharedHeader: true },
  { slug: "analytics", path: "/recruiter/analytics", heading: "Analytics", sharedHeader: true },
];

const viewports = [
  { label: "laptop-1440", width: 1440, height: 900 },
  { label: "tablet-1024", width: 1024, height: 768 },
  { label: "mobile-390", width: 390, height: 844 },
];

async function noOverflow(page: import("@playwright/test").Page, label: string) {
  const size = await page.evaluate(() => ({ viewport: innerWidth, scroll: document.documentElement.scrollWidth }));
  expect(size.scroll, label).toBeLessThanOrEqual(size.viewport + 1);
}

async function chooseMode(page: import("@playwright/test").Page, label: "System" | "Light" | "Dark") {
  await page.getByTitle("Appearance").click();
  await page.getByTitle(label + " mode").click();
}

test.beforeEach(async ({ request, page }) => {
  await resetE2E(request);
  await page.goto("/");
  await page.evaluate(() => localStorage.removeItem("swx-theme"));
});

test("P2.7 recruiter mockups stay aligned with active product contracts", async ({ page }) => {
  test.setTimeout(300000);
  await fs.mkdir("visual-artifacts/p2.7-ui-mockup/recruiter", { recursive: true });
  await login(page, "recruiter");

  for (const viewport of viewports) {
    await page.setViewportSize({ width: viewport.width, height: viewport.height });
    for (const area of recruiterAreas) {
      await page.goto(area.path);
      if (area.sharedHeader) {
        const header = page.getByTestId("recruiter-product-header");
        await expect(header).toBeVisible();
        const h1 = header.getByRole("heading", { level: 1, name: area.heading, exact: false });
        await expect(h1).toBeVisible();
        const family = await h1.evaluate((node) => getComputedStyle(node).fontFamily);
        expect(family).toContain("Inter");
      } else {
        await expect(page.locator("main")).toContainText(area.heading as RegExp);
        await expect(page.locator("main h1").first()).toBeVisible();
      }
      expect(await page.locator('main img[src*="/images/people/"]').count(), area.slug + " decorative people imagery").toBe(0);
      await noOverflow(page, area.slug + " " + viewport.label);
      await page.screenshot({
        path: `visual-artifacts/p2.7-ui-mockup/recruiter/${area.slug}-${viewport.label}.png`,
        fullPage: true,
      });
    }
  }
});

test("P2.7 recruiter display contract preserves System Light Dark", async ({ page }) => {
  await fs.mkdir("visual-artifacts/p2.7-ui-mockup/themes", { recursive: true });
  await page.setViewportSize({ width: 1440, height: 900 });
  await login(page, "recruiter");

  for (const mode of ["Light", "Dark", "System"] as const) {
    if (mode === "System") await page.emulateMedia({ colorScheme: "dark" });
    await chooseMode(page, mode);
    await page.goto("/recruiter/discover");
    await expect(page.getByTestId("recruiter-product-header")).toBeVisible();
    await noOverflow(page, "recruiter " + mode);
    await page.screenshot({
      path: `visual-artifacts/p2.7-ui-mockup/themes/recruiter-discover-${mode.toLowerCase()}.png`,
      fullPage: true,
    });
  }
});

test("P2.7 Candidate and Master Admin remain review-only references", async ({ page }) => {
  await fs.mkdir("visual-artifacts/p2.7-ui-mockup/review-only", { recursive: true });
  await page.setViewportSize({ width: 1440, height: 900 });

  await login(page, "candidate");
  await page.goto("/candidate/profile");
  await expect(page.getByRole("heading", { name: "My Professional Profile" })).toBeVisible();
  await noOverflow(page, "candidate review");
  await page.screenshot({ path: "visual-artifacts/p2.7-ui-mockup/review-only/candidate-profile-light.png", fullPage: true });

  await page.context().clearCookies();
  await page.goto("/");
  await page.evaluate(() => localStorage.removeItem("swx-theme"));
  await login(page, "master_admin");
  await page.goto("/swx-command-centre/overview");
  await expect(page.getByRole("heading", { name: "Platform command centre" })).toBeVisible();
  await noOverflow(page, "master admin review");
  await page.screenshot({ path: "visual-artifacts/p2.7-ui-mockup/review-only/master-admin-overview-light.png", fullPage: true });
});
