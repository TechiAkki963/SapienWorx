import { expect, test } from "@playwright/test";
import fs from "node:fs/promises";

import { login, resetE2E } from "./helpers";

async function enableMessagingFixtures(page: import("@playwright/test").Page) {
  await page.context().addCookies([{
    name: "swx_p2_messaging_fixture",
    value: "1",
    url: "http://127.0.0.1:3000",
  }]);
}

async function expectNoHorizontalOverflow(page: import("@playwright/test").Page, label: string) {
  const result = await page.evaluate(() => ({
    width: document.documentElement.scrollWidth,
    viewport: document.documentElement.clientWidth,
  }));
  expect(result.width, label).toBeLessThanOrEqual(result.viewport + 1);
}

test.beforeEach(async ({ request }) => {
  await resetE2E(request);
});

test("P2.2 candidate inbox stays readable across laptop, tablet and mobile", async ({ page }) => {
  await fs.mkdir("../output", { recursive: true });
  await page.setViewportSize({ width: 1440, height: 900 });
  await login(page, "candidate");
  await enableMessagingFixtures(page);

  for (const width of [1440, 1024, 768]) {
    await page.setViewportSize({ width, height: width === 1440 ? 900 : 1024 });
    await page.goto("/candidate/inbox");
    await expect(page.getByText("Senior Go Platform Engineer opportunity").first()).toBeVisible();
    await expect(page.getByText("Operations leadership conversation").first()).toBeVisible();
    await expectNoHorizontalOverflow(page, `candidate inbox ${width}px`);
    await page.screenshot({ path: `../output/p2.2-candidate-inbox-${width}.png`, fullPage: true });
  }

  for (const width of [390, 320]) {
    await page.setViewportSize({ width, height: 844 });
    await page.goto("/candidate/inbox");
    await expect(page.getByRole("button", { name: /Senior Go Platform Engineer opportunity/ })).toBeVisible();
    await expectNoHorizontalOverflow(page, `candidate inbox list ${width}px`);
    await page.screenshot({ path: `../output/p2.2-candidate-inbox-list-${width}.png`, fullPage: true });

    await page.getByRole("button", { name: /Senior Go Platform Engineer opportunity/ }).click();
    await expect(page.getByPlaceholder("Write a reply…")).toBeVisible();
    await expect(page.getByText("The hiring manager is available tomorrow afternoon.")).toBeVisible();
    await expectNoHorizontalOverflow(page, `candidate inbox thread ${width}px`);
    await page.screenshot({ path: `../output/p2.2-candidate-inbox-thread-${width}.png`, fullPage: true });
  }
});

test("P2.2 recruiter messages preserve table-first workspace chrome and mobile conversation flow", async ({ page }) => {
  await fs.mkdir("../output", { recursive: true });
  await page.setViewportSize({ width: 1440, height: 900 });
  await login(page, "recruiter");
  await enableMessagingFixtures(page);

  await page.goto("/recruiter/messages");
  await expect(page.getByText("Senior Go Platform Engineer opportunity").first()).toBeVisible();
  await expect(page.getByRole("button", { name: "Unread only" })).toBeVisible();
  await expectNoHorizontalOverflow(page, "recruiter messages 1440px");
  await page.screenshot({ path: "../output/p2.2-recruiter-messages-1440.png", fullPage: true });

  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/recruiter/messages");
  await expect(page.getByRole("button", { name: /Operations leadership conversation/ })).toBeVisible();
  await page.getByRole("button", { name: /Operations leadership conversation/ }).click();
  await expect(page.getByPlaceholder("Write a reply…")).toBeVisible();
  await expectNoHorizontalOverflow(page, "recruiter messages thread 390px");
  await page.screenshot({ path: "../output/p2.2-recruiter-messages-thread-390.png", fullPage: true });
});

test("P2.2 candidate notifications expose real-time state without clutter", async ({ page }) => {
  await fs.mkdir("../output", { recursive: true });
  await page.setViewportSize({ width: 1440, height: 900 });
  await login(page, "candidate");
  await enableMessagingFixtures(page);

  for (const width of [1440, 768, 390, 320]) {
    await page.setViewportSize({ width, height: width >= 768 ? 900 : 844 });
    await page.goto("/candidate/notifications");
    await expect(page.getByText("New message from a recruiter")).toBeVisible();
    await expect(page.getByText("Senior Go Platform Engineer opportunity")).toBeVisible();
    await expect(page.getByText(/Live updates|Connecting|Reconnecting/)).toBeVisible();
    await expectNoHorizontalOverflow(page, `candidate notifications ${width}px`);
    await page.screenshot({ path: `../output/p2.2-candidate-notifications-${width}.png`, fullPage: true });
  }
});

test("P2.2 messaging surfaces remain legible in dark mode", async ({ page }) => {
  await fs.mkdir("../output", { recursive: true });
  await page.setViewportSize({ width: 1440, height: 900 });
  await login(page, "candidate");
  await enableMessagingFixtures(page);

  await page.goto("/candidate/inbox");
  await page.getByTitle("Appearance").click();
  await page.getByTitle("Dark mode").click();
  await expect(page.locator("html")).toHaveClass(/swx-dark/);
  await expect(page.getByText("Senior Go Platform Engineer opportunity").first()).toBeVisible();
  await expectNoHorizontalOverflow(page, "candidate inbox dark mode");
  await page.screenshot({ path: "../output/p2.2-candidate-inbox-dark-1440.png", fullPage: true });

  await page.goto("/candidate/notifications");
  await expect(page.locator("html")).toHaveClass(/swx-dark/);
  await expect(page.getByText("New message from a recruiter")).toBeVisible();
  await expectNoHorizontalOverflow(page, "candidate notifications dark mode");
  await page.screenshot({ path: "../output/p2.2-candidate-notifications-dark-1440.png", fullPage: true });
});
