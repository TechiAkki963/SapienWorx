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

test("candidate inbox stays readable from laptop to mobile conversation view", async ({ page }) => {
  await fs.mkdir("../output", { recursive: true });
  await page.setViewportSize({ width: 1440, height: 900 });
  await login(page, "candidate");
  await page.goto("/candidate/inbox");

  await expect(page.getByRole("heading", { name: "Inbox" }).first()).toBeVisible();
  await expect(page.getByText("Riya Recruiter").first()).toBeVisible();
  await expect(page.getByText("Senior Go Platform Engineer opportunity").first()).toBeVisible();
  await noOverflow(page, "candidate inbox 1440");
  await page.screenshot({ path: "../output/p2.2-candidate-inbox-1440.png", fullPage: true });

  await page.setViewportSize({ width: 390, height: 844 });
  await expect(page.getByText("Riya Recruiter").first()).toBeVisible();
  await noOverflow(page, "candidate inbox list 390");
  await page.screenshot({ path: "../output/p2.2-candidate-inbox-list-390.png", fullPage: true });

  await page.getByText("Senior Go Platform Engineer opportunity").first().click();
  await expect(page.getByPlaceholder("Write a reply…")).toBeVisible();
  await expect(page.getByText(/45-minute technical discussion/)).toBeVisible();
  await noOverflow(page, "candidate conversation 390");
  await page.screenshot({ path: "../output/p2.2-candidate-conversation-390.png", fullPage: true });

  await page.setViewportSize({ width: 320, height: 800 });
  await expect(page.getByRole("button", { name: "Send" })).toBeVisible();
  await expect(page.getByRole("button", { name: "← Back" })).toBeVisible();
  await noOverflow(page, "candidate conversation 320");
  await page.screenshot({ path: "../output/p2.2-candidate-conversation-320.png", fullPage: true });
});

test("candidate inbox dark mode preserves messaging hierarchy", async ({ page }) => {
  await fs.mkdir("../output", { recursive: true });
  await page.setViewportSize({ width: 1440, height: 900 });
  await login(page, "candidate");
  await page.goto("/candidate/inbox");
  await page.getByTitle("Appearance").click();
  await page.getByTitle("Dark mode").click();
  await expect(page.locator("html")).toHaveClass(/swx-dark/);
  await expect(page.getByText("Riya Recruiter").first()).toBeVisible();
  await noOverflow(page, "candidate inbox dark 1440");
  await page.screenshot({ path: "../output/p2.2-candidate-inbox-dark-1440.png", fullPage: true });
});

test("recruiter messages keep unread controls and reply composer usable", async ({ page }) => {
  await fs.mkdir("../output", { recursive: true });
  await page.setViewportSize({ width: 1440, height: 900 });
  await login(page, "recruiter");
  await page.goto("/recruiter/messages");

  await expect(page.getByRole("heading", { name: "Messages" }).first()).toBeVisible();
  await expect(page.getByRole("button", { name: "Unread only" })).toBeVisible();
  await expect(page.getByText("Aarav Candidate").first()).toBeVisible();
  await page.getByText("Senior Go Platform Engineer opportunity").first().click();
  await expect(page.getByPlaceholder("Write a reply…")).toBeVisible();
  await noOverflow(page, "recruiter messages 1440");
  await page.screenshot({ path: "../output/p2.2-recruiter-messages-1440.png", fullPage: true });

  await page.setViewportSize({ width: 390, height: 844 });
  await noOverflow(page, "recruiter conversation 390");
  await expect(page.getByRole("button", { name: "Send" })).toBeVisible();
  await page.screenshot({ path: "../output/p2.2-recruiter-conversation-390.png", fullPage: true });
});

test("candidate notification links open the exact InMail thread", async ({ page }) => {
  await login(page, "candidate");
  await page.goto("/candidate/notifications");
  await expect(page.getByText("New message from a recruiter")).toBeVisible();
  await page.getByRole("link", { name: "Open →" }).click();
  await expect(page).toHaveURL(/\/candidate\/inbox\?thread=73000000-0000-4000-8000-000000000001/);
  await expect(page.getByText("Senior Go Platform Engineer opportunity").first()).toBeVisible();
  await expect(page.getByPlaceholder("Write a reply…")).toBeVisible();
});


test("candidate notifications remain clear across laptop mobile and dark mode", async ({ page }) => {
  await fs.mkdir("../output", { recursive: true });
  await page.setViewportSize({ width: 1440, height: 900 });
  await login(page, "candidate");
  await page.goto("/candidate/notifications");

  await expect(page.getByRole("heading", { name: "Notifications" })).toBeVisible();
  await expect(page.getByText("Application and account updates", { exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: "Mark all as read", exact: true })).toBeEnabled();
  await expect(page.getByText("New message from a recruiter")).toBeVisible();
  await noOverflow(page, "candidate notifications 1440");
  await page.screenshot({ path: "../output/p2.2-candidate-notifications-1440.png", fullPage: true });

  await page.setViewportSize({ width: 390, height: 844 });
  await expect(page.getByRole("heading", { name: "Notifications" })).toBeVisible();
  await noOverflow(page, "candidate notifications 390");
  await page.screenshot({ path: "../output/p2.2-candidate-notifications-390.png", fullPage: true });

  await page.setViewportSize({ width: 1440, height: 900 });
  await page.getByTitle("Appearance").click();
  await page.getByTitle("Dark mode").click();
  await expect(page.locator("html")).toHaveClass(/swx-dark/);
  await expect(page.getByText("New message from a recruiter")).toBeVisible();
  await noOverflow(page, "candidate notifications dark 1440");
  await page.screenshot({ path: "../output/p2.2-candidate-notifications-dark-1440.png", fullPage: true });
});
