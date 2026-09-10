import { expect, test } from "@playwright/test";

test.describe("Candidate-first public landing page", () => {
  test("keeps the candidate-first story and the main public journeys accessible", async ({ page }) => {
    await page.goto("/");

    await expect(page.getByRole("heading", { name: "Find the right role. Know where you stand." })).toBeVisible();
    await expect(page.getByRole("button", { name: "Search jobs" }).first()).toBeVisible();
    await expect(page.getByRole("link", { name: "Create my profile" }).first()).toHaveAttribute("href", "/register");
    await expect(page.getByText("Verified employers", { exact: true })).toBeVisible();
    await expect(page.getByRole("heading", { name: "A clearer job search in three steps." })).toBeVisible();
    await expect(page.getByRole("link", { name: /Explore Sapienworx for recruiters/ })).toHaveAttribute("href", "/recruiters");
    await expect(page.getByRole("heading", { name: "Useful guidance for real career decisions." })).toBeVisible();
    await expect(page.getByText("© 2026 Sapienworx. All rights reserved.", { exact: true })).toBeVisible();
  });

  test("reflows the landing page for a mobile candidate", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto("/");

    await expect(page.getByRole("heading", { name: "Find the right role. Know where you stand." })).toBeVisible();
    await expect(page.locator(".landing-v2-hero")).toBeVisible();
    await expect(page.locator(".landing-v2-footer-links")).toBeVisible();
  });
});
