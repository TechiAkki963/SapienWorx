import { expect, test } from "@playwright/test";
import fs from "node:fs/promises";

import { login, resetE2E } from "./helpers";

async function noOverflow(page: import("@playwright/test").Page, label: string) {
  const { width, viewport } = await page.evaluate(() => ({
    width: document.documentElement.scrollWidth,
    viewport: window.innerWidth,
  }));
  expect(width, label).toBeLessThanOrEqual(viewport + 1);
}

test.beforeEach(async ({ request, page }) => {
  await resetE2E(request);
  await page.goto("/");
  await page.evaluate(() => localStorage.removeItem("swx-theme"));
});

test("outreach campaigns stay compact from laptop to mobile", async ({ page }) => {
  await fs.mkdir("../output", { recursive: true });
  await page.setViewportSize({ width: 1440, height: 900 });
  await login(page, "recruiter");
  await page.goto("/recruiter/outreach");

  await expect(page.getByRole("heading", { name: "Outreach" })).toBeVisible();
  await expect(page.getByRole("tab", { name: "Campaigns" })).toHaveAttribute("aria-selected", "true");
  await expect(page.getByText("Mumbai platform hiring", {exact:true}).filter({visible:true})).toBeVisible();
  await expect(page.getByText("Outreach respects candidate consent, recipient preferences and delivery limits.")).toBeVisible();
  await noOverflow(page, "outreach campaigns 1440");
  await page.screenshot({ caret: "initial", path: "../output/p2.3-outreach-campaigns-1440.png", fullPage: true });

  for (const width of [1024, 768, 390, 320]) {
    await page.setViewportSize({ width, height: width >= 768 ? 900 : 844 });
    await expect(page.getByRole("heading", { name: "Outreach" })).toBeVisible();
    await expect(page.getByText("Mumbai platform hiring", {exact:true}).filter({visible:true})).toBeVisible();
    await noOverflow(page, `outreach campaigns ${width}`);
    await page.screenshot({ caret: "initial", path: `../output/p2.3-outreach-campaigns-${width}.png`, fullPage: true });
  }
});

test("sequence builder exposes follow-up timing without clutter", async ({ page }) => {
  await fs.mkdir("../output", { recursive: true });
  await page.setViewportSize({ width: 1440, height: 900 });
  await login(page, "recruiter");
  await page.goto("/recruiter/outreach");
  await page.getByRole("tab", { name: "Sequences" }).click();

  await expect(page.getByRole("table", {name:"Outreach sequences"}).getByText("Priority role follow-up", {exact:true})).toBeVisible();
  await page.getByRole("table", {name:"Outreach sequences"}).getByText(/steps · View timing/).click();
  await expect(page.getByText(/2 days later/).filter({visible:true})).toBeVisible();
  await page.getByRole("button", { name: "Create sequence", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Build a sequence" })).toBeVisible();
  await expect(page.getByRole("button", { name: "+ Add follow-up" })).toBeVisible();
  await noOverflow(page, "outreach sequences 1440");
  await page.screenshot({ caret: "initial", path: "../output/p2.3-outreach-sequences-1440.png", fullPage: true });

  await page.setViewportSize({ width: 390, height: 844 });
  await noOverflow(page, "outreach sequences 390");
  await page.screenshot({ caret: "initial", path: "../output/p2.3-outreach-sequences-390.png", fullPage: true });
});

test("template workspace is usable and dark mode remains readable", async ({ page }) => {
  await fs.mkdir("../output", { recursive: true });
  await page.setViewportSize({ width: 1440, height: 900 });
  await login(page, "recruiter");
  await page.goto("/recruiter/outreach");
  await page.getByRole("tab", { name: "Templates" }).click();

  await expect(page.getByRole("button", { name: "Create message template", exact: true })).toBeVisible();
  await expect(page.getByText("Role introduction").first()).toBeVisible();
  await expect(page.getByText("Gentle follow-up").first()).toBeVisible();

  await page.getByTitle("Appearance").click();
  await page.getByTitle("Dark mode").click();
  await expect(page.locator("html")).toHaveClass(/swx-dark/);
  await noOverflow(page, "outreach templates dark 1440");
  await page.screenshot({ caret: "initial", path: "../output/p2.3-outreach-templates-dark-1440.png", fullPage: true });
});

test("campaign draft can be created and launched from the protected workflow", async ({ page }) => {
  await login(page, "recruiter");
  await page.goto("/recruiter/outreach");

  await page.getByRole("button", { name: "Create campaign", exact: true }).click();
  const drawer = page.getByRole("dialog", { name: "Create campaign" });
  await drawer.getByLabel("Campaign name", { exact: true }).fill("Healthcare specialist outreach");
  await drawer.getByText("Meera Nair", { exact: true }).click();
  await drawer.getByRole("button", { name: "Continue", exact: true }).click();
  await drawer.getByRole("combobox", { name: "Sequence", exact: true }).selectOption("76000000-0000-4000-8000-000000000001");
  await drawer.getByRole("combobox", { name: "Job context (optional)", exact: true }).selectOption("60000000-0000-4000-8000-000000000001");
  await drawer.getByRole("button", { name: "Continue", exact: true }).click();
  await drawer.getByRole("button", { name: "Continue", exact: true }).click();
  await page.getByRole("button", { name: "Create draft campaign" }).click();
  await expect(drawer).not.toBeVisible();

  await expect(page.getByText("Campaign saved as draft. Review it before launch.").filter({visible:true})).toBeVisible();
  await expect(page.getByText("Healthcare specialist outreach", {exact:true}).filter({visible:true})).toBeVisible();
  await page.getByRole("button", { name: "Launch campaign" }).first().click();
  await expect(page.getByText("Campaign launched through the protected InMail delivery path.").filter({visible:true})).toBeVisible();
});
