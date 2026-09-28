import { expect, test } from "@playwright/test";

import { login, MOCK_API, resetE2E, waitForRecordedRequest } from "./helpers";

test.describe("Master Admin Intelligence Centre", () => {
  test.beforeEach(async ({ request }) => {
    await resetE2E(request);
    await request.post(MOCK_API + "/__e2e/admin-security", {
      data: { enabled: true, admin_role: "super_admin", assigned: true, mfa_enrolled: true, mfa_verified: true },
    });
  });

  test("renders the governed Intelligence cockpit with fail-safe switches across supported viewports", async ({ page, request }) => {
    await login(page, "master_admin");
    await page.goto("/swx-command-centre/intelligence");

    await expect(page.getByRole("heading", { name: "Control plane for the separate Intelligence Engine" })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Engine health" })).toBeVisible();
    await expect(page.getByText("sapienworx-intelligence", { exact: true })).toBeVisible();
    await expect(page.getByRole("heading", { name: "AI Gateway" })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Intelligence kill switches" })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Model & engine registry" })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Prompt Registry" })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Evaluations" })).toBeVisible();

    await expect(page.getByText("global_intelligence", { exact: true })).toBeVisible();
    await expect(page.getByText("automated_recommendations", { exact: true })).toBeVisible();
    await expect(page.getByText("ai_gateway", { exact: true })).toBeVisible();
    await expect(page.getByText("model_deployment", { exact: true })).toBeVisible();
    await expect(page.getByRole("button", { name: "Enable with approval" })).toHaveCount(8);

    await expect(page.getByRole("button", { name: "Queue advisory analysis" })).toBeVisible();
    await expect(page.getByText("Register candidate model/version", { exact: true })).toBeVisible();
    await expect(page.getByText("Register prompt version", { exact: true })).toBeVisible();
    await expect(page.getByRole("button", { name: "Activate with approval" })).toHaveCount(1);
    await expect(page.getByRole("button", { name: "Evaluate" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Promote with approval" })).toBeVisible();

    const apiRequest = await waitForRecordedRequest(request, (item) => item.method === "GET" && item.path === "/api/v1/admin/intelligence");
    expect(apiRequest).toBeTruthy();

    for (const width of [1440, 768, 375]) {
      await page.setViewportSize({ width, height: 960 });
      await expect(page.getByRole("heading", { name: "Control plane for the separate Intelligence Engine" })).toBeVisible();
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
      await page.screenshot({ path: `../output/admin-intelligence-${width}.png`, fullPage: true });
    }
  });

  test("auditor can inspect intelligence but cannot mutate models, feedback or kill switches", async ({ page, request }) => {
    await request.post(MOCK_API + "/__e2e/admin-security", {
      data: { enabled: true, admin_role: "auditor", assigned: true, mfa_enrolled: true, mfa_verified: true },
    });
    await login(page, "master_admin");
    await page.goto("/swx-command-centre/intelligence");

    await expect(page.getByRole("heading", { name: "Control plane for the separate Intelligence Engine" })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Model & engine registry" })).toBeVisible();

    await expect(page.getByRole("button", { name: "Queue advisory analysis" })).toHaveCount(0);
    await expect(page.getByText("Register candidate model/version", { exact: true })).toHaveCount(0);
    await expect(page.getByText("Register prompt version", { exact: true })).toHaveCount(0);
    await expect(page.getByRole("button", { name: "Enable with approval" })).toHaveCount(0);
    await expect(page.getByRole("button", { name: "Evaluate" })).toHaveCount(0);
    await expect(page.getByRole("button", { name: "Promote with approval" })).toHaveCount(0);
    await expect(page.getByRole("button", { name: "Activate with approval" })).toHaveCount(0);
    await expect(page.getByRole("button", { name: "Useful" })).toHaveCount(0);
  });
});
