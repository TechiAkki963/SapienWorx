import { expect, test } from "@playwright/test";
import fs from "node:fs/promises";

import { login, resetE2E } from "./helpers";

async function noOverflow(page: import("@playwright/test").Page, label: string) {
  const result = await page.evaluate(() => ({
    scrollWidth: document.documentElement.scrollWidth,
    innerWidth: window.innerWidth,
  }));
  expect(result.scrollWidth, label).toBeLessThanOrEqual(result.innerWidth + 1);
}

test.beforeEach(async ({ request, page }) => {
  await resetE2E(request);
  await page.goto("/");
  await page.evaluate(() => localStorage.removeItem("swx-theme"));
});

test("outreach campaigns stay clear from laptop to mobile and dark mode", async ({ page }) => {
  await fs.mkdir("../output", { recursive: true });
  await page.setViewportSize({ width: 1440, height: 900 });
  await login(page, "recruiter");
  await page.goto("/recruiter/outreach");

  await expect(page.getByRole("heading", { name: "Outreach", exact: true })).toBeVisible();
  await expect(page.getByText("Mumbai operations outreach")).toBeVisible();
  await expect(page.getByRole("tab", { name: /Campaigns/ })).toHaveAttribute("aria-selected", "true");
  await noOverflow(page, "outreach campaigns 1440");
  await page.screenshot({ path: "../output/p2.3-outreach-campaigns-1440.png", fullPage: true });

  await page.setViewportSize({ width: 390, height: 844 });
  await expect(page.getByRole("heading", { name: "Outreach", exact: true })).toBeVisible();
  await expect(page.getByText("Mumbai operations outreach")).toBeVisible();
  await noOverflow(page, "outreach campaigns 390");
  await page.screenshot({ path: "../output/p2.3-outreach-campaigns-390.png", fullPage: true });

  await page.setViewportSize({ width: 1440, height: 900 });
  await page.getByTitle("Appearance").click();
  await page.getByTitle("Dark mode").click();
  await expect(page.locator("html")).toHaveClass(/swx-dark/);
  await expect(page.getByText("Mumbai operations outreach")).toBeVisible();
  await noOverflow(page, "outreach campaigns dark 1440");
  await page.screenshot({ path: "../output/p2.3-outreach-campaigns-dark-1440.png", fullPage: true });
});

test("recruiter can create and activate a sequence then save a template", async ({ page }) => {
  await fs.mkdir("../output", { recursive: true });
  await page.setViewportSize({ width: 1440, height: 900 });
  await login(page, "recruiter");
  await page.goto("/recruiter/outreach");

  await page.getByRole("tab", { name: /Sequences/ }).click();
  await page.getByLabel("Sequence name").fill("Healthcare specialist follow-up");
  await page.getByLabel("Description").fill("A careful two-step follow-up for shortlisted healthcare candidates.");
  await page.getByLabel("Step 1 subject").fill("{{JobTitle}} opportunity");
  await page.getByLabel("Step 1 message").fill("Hi {{CandidateName}}, I would like to discuss our {{JobTitle}} opportunity.");
  await page.getByRole("button", { name: "+ Add follow-up step" }).click();
  await page.getByLabel("Step 2 delay hours").fill("72");
  await page.getByLabel("Step 2 subject").fill("Following up on {{JobTitle}}");
  await page.getByLabel("Step 2 message").fill("Hi {{CandidateName}}, following up in case {{JobTitle}} is relevant.");
  await page.getByRole("button", { name: "Save sequence draft" }).click();

  await expect(page.getByText("Sequence saved as draft.")).toBeVisible();
  const newSequence = page.getByText("Healthcare specialist follow-up").last();
  await expect(newSequence).toBeVisible();
  await newSequence.locator("xpath=ancestor::article").getByRole("button", { name: "Activate" }).click();
  await expect(page.getByText("Sequence activated.")).toBeVisible();
  await page.screenshot({ path: "../output/p2.3-outreach-sequences-1440.png", fullPage: true });

  await page.getByRole("tab", { name: /Templates/ }).click();
  await page.getByLabel("Template title").fill("Healthcare introduction");
  await page.getByLabel("Subject").fill("{{JobTitle}} opportunity");
  await page.getByRole("textbox", { name: "Message", exact: true }).fill("Hi {{CandidateName}}, your experience looks relevant for {{JobTitle}}.");
  await page.getByRole("button", { name: "Save template" }).click();
  await expect(page.getByText("Message template saved.")).toBeVisible();
  await expect(page.getByText("Healthcare introduction")).toBeVisible();
  await page.screenshot({ path: "../output/p2.3-outreach-templates-1440.png", fullPage: true });
});

test("campaign launch is governed and pause resume controls remain usable", async ({ page }) => {
  await login(page, "recruiter");
  await page.goto("/recruiter/outreach");

  await page.getByLabel("Campaign name").fill("P2.3 governed launch");
  await page.getByLabel("Sequence").selectOption("76000000-0000-4000-8000-000000000001");
  await page.getByLabel("Job context").selectOption("60000000-0000-4000-8000-000000000001");
  await page.getByLabel("Select Aarav Mehta").check();
  await page.getByLabel("Select Meera Nair").check();
  await page.getByRole("button", { name: "Launch governed campaign" }).click();

  await expect(page.getByText(/Campaign launched: 2 enrolled, 0 skipped/)).toBeVisible();
  const campaign = page.getByText("P2.3 governed launch").last().locator("xpath=ancestor::article");
  await expect(campaign).toBeVisible();
  await campaign.getByRole("button", { name: "Pause" }).click();
  await expect(page.getByText("Campaign paused.")).toBeVisible();
  await expect(campaign.getByRole("button", { name: "Resume" })).toBeVisible();
  await campaign.getByRole("button", { name: "Resume" }).click();
  await expect(page.getByText("Campaign resumed.")).toBeVisible();
});
