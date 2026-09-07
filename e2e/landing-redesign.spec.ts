import { expect, test } from "@playwright/test";

test.describe("Editorial candidate landing page", () => {
  test("keeps the candidate-first story and the main public journeys accessible", async ({ page }) => {
    await page.goto("/");

    await expect(page.getByRole("heading", { name: "Find roles that challenge you. Build what’s next." })).toBeVisible();
    await expect(page.getByRole("link", { name: "Search jobs" }).first()).toHaveAttribute("href", "/candidate/jobs");
    await expect(page.getByRole("link", { name: "Build my profile from CV" }).first()).toHaveAttribute("href", "/register");
    await expect(page.getByText("Every company verified", { exact: true })).toBeVisible();
    await expect(page.locator(".landing-v2-role-card-detailed")).toHaveCount(3);
    await expect(page.getByRole("heading", { name: "Your profile. Your privacy. Your next opportunity." })).toBeVisible();
    await expect(page.getByRole("link", { name: "For recruiters" }).last()).toHaveAttribute("href", "/recruiter/login");
    await expect(page.getByRole("heading", { name: "Useful guidance for real career decisions." })).toBeVisible();
    await expect(page.getByText("© 2026 Sapienworx. All rights reserved.", { exact: true })).toBeVisible();
  });

  test("reflows the editorial landing page for a mobile candidate", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto("/");

    await expect(page.getByRole("heading", { name: "Find roles that challenge you. Build what’s next." })).toBeVisible();
    const cards = page.locator(".landing-v2-role-grid .landing-v2-role-card");
    await expect(cards).toHaveCount(3);
    expect(await cards.nth(1).evaluate((element) => element.getBoundingClientRect().top)).toBeGreaterThan(await cards.nth(0).evaluate((element) => element.getBoundingClientRect().top));
    await expect(page.locator(".landing-v2-footer-links")).toBeVisible();
  });
});
