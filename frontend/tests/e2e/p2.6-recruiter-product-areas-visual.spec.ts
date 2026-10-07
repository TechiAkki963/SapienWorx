import { expect, test } from "@playwright/test";
import fs from "node:fs/promises";
import { login, resetE2E } from "./helpers";

const viewports = [
  { name: "laptop-1440", width: 1440, height: 900 },
  { name: "desktop-1366", width: 1366, height: 768 },
  { name: "tablet-1024", width: 1024, height: 768 },
  { name: "tablet-768", width: 768, height: 1024 },
  { name: "mobile-428", width: 428, height: 926 },
  { name: "mobile-360", width: 360, height: 800 },
];

const areas = [
  { slug: "dashboard", path: "/recruiter", heading: "Good" },
  { slug: "discover", path: "/recruiter/discover", heading: "Discover Talent" },
  { slug: "talent-pool", path: "/recruiter/talent-pool", heading: "Talent Pool" },
  { slug: "jobs", path: "/recruiter/jobs", heading: "Job management" },
  { slug: "interviews", path: "/recruiter/interviews", heading: "Interviews" },
  { slug: "offers", path: "/recruiter/offers", heading: "Offers" },
  { slug: "outreach", path: "/recruiter/outreach", heading: "Outreach" },
  { slug: "saved-searches", path: "/recruiter/saved-searches", heading: "Saved searches & alerts" },
  { slug: "referrals", path: "/recruiter/referrals", heading: "Referrals" },
  { slug: "analytics", path: "/recruiter/analytics", heading: "Analytics" },
];

test.beforeEach(async ({ request }) => resetE2E(request));

async function assertNoOverflow(page: import("@playwright/test").Page, label: string) {
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1), label + " horizontal overflow").toBeTruthy();
}

test("P2.6 recruiter product areas are responsive across target devices", async ({ page }) => {
  test.setTimeout(300000);
  await login(page, "recruiter");
  await fs.mkdir("visual-artifacts/p2.6-recruiter-product-areas", { recursive: true });

  for (const viewport of viewports) {
    await page.setViewportSize({ width: viewport.width, height: viewport.height });
    for (const area of areas) {
      await page.goto(area.path);
      if (area.slug === "dashboard") {
        await expect(page.locator("main")).toContainText(/Good|Welcome|Dashboard/i);
      } else {
        await expect(page.getByRole("heading", { name: area.heading, exact: false }).first()).toBeVisible();
      }
      await assertNoOverflow(page, area.slug + " " + viewport.name);
      if (viewport.width < 1024) {
        await expect(page.getByTestId("recruiter-bottom-nav")).toBeVisible();
      }
      await page.evaluate(() => {
        window.scrollTo(0, 0);
        document.querySelectorAll("nextjs-portal").forEach((node) => node.remove());
      });
      await page.screenshot({
        path: `visual-artifacts/p2.6-recruiter-product-areas/${area.slug}-${viewport.name}.png`,
        fullPage: true, caret: "initial",
      });
    }
  }
});

test("P2.6 recruiter product areas preserve System Light Dark theming", async ({ page }) => {
  test.setTimeout(240000);
  await login(page, "recruiter");
  await fs.mkdir("visual-artifacts/p2.6-recruiter-product-areas/themes", { recursive: true });
  await page.setViewportSize({ width: 1440, height: 900 });

  for (const scheme of ["light", "dark"] as const) {
    await page.emulateMedia({ colorScheme: scheme });
    for (const area of areas) {
      await page.goto(area.path);
      await assertNoOverflow(page, area.slug + " " + scheme);
      await page.screenshot({
        path: `visual-artifacts/p2.6-recruiter-product-areas/themes/${area.slug}-${scheme}-1440.png`,
        fullPage: true, caret: "initial",
      });
    }
  }

  await page.emulateMedia({ colorScheme: "no-preference" });
  await page.goto("/recruiter/analytics");
  await assertNoOverflow(page, "analytics system");
  await page.screenshot({
    path: "visual-artifacts/p2.6-recruiter-product-areas/themes/analytics-system-1440.png",
    fullPage: true, caret: "initial",
  });
});

test("P2.6 mobile More menu exposes every advanced recruiter product area", async ({ page }) => {
  await login(page, "recruiter");
  await page.setViewportSize({ width: 360, height: 800 });
  await page.goto("/recruiter/offers");
  await page.getByRole("button", { name: "More" }).click();
  for (const label of ["Interviews", "Offers", "Talent", "Talent Pools", "Saved Searches", "Referrals", "Outreach", "Analytics"]) {
    await expect(page.getByTestId("recruiter-more-menu").getByRole("link", { name: label, exact:true })).toBeVisible();
  }
});
