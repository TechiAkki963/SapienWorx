import { expect, test } from "@playwright/test";

import { login, resetE2E, waitForRecordedRequest } from "./helpers";

test.describe("Master Admin command centre", () => {
  test.beforeEach(async ({ request }) => resetE2E(request));

  test("enters through the hidden gateway and fetches platform metrics server-side", async ({ page, request }) => {
    await page.goto("/swx-command-centre");
    await expect(page.getByText("Restricted gateway").first()).toBeVisible();
    await expect(page.getByRole("heading", { name: "Enter the command centre" })).toBeVisible();

    await login(page, "master_admin");
    await expect(page.getByRole("heading", { name: "Platform command centre" })).toBeVisible();
    await expect(page.getByText("12,540")).toBeVisible();
    await expect(page.getByText("321")).toBeVisible();
    await expect(page.getByText("11,800")).toBeVisible();

    const metrics = await waitForRecordedRequest(request, (item) => item.method === "GET" && item.path === "/api/v1/admin/metrics");
    expect(metrics.path).toBe("/api/v1/admin/metrics");
    const queue = await waitForRecordedRequest(request, (item) => item.method === "GET" && item.path === "/api/v1/admin/company-verifications" && item.search.includes("limit=5"));
    expect(new URLSearchParams(queue.search).get("status")).toBe("pending");
  });

  test("approves a pending tenant with an audited client mutation and refreshes the queue", async ({ page, request }) => {
    await login(page, "master_admin");
    await page.goto("/swx-command-centre/tenants");

    await expect(page.getByRole("heading", { name: "Recruiter verification" })).toBeVisible();
    await expect(page.getByText("Acme Hiring India")).toBeVisible();
    page.once("dialog", async (dialog) => dialog.accept("Approved during Playwright E2E"));

    const approval = page.waitForRequest((req) => /\/api\/v1\/admin\/company-verifications\/[^/]+\/approve$/.test(new URL(req.url()).pathname) && req.method() === "POST");
    await page.getByRole("button", { name: "Approve" }).click();
    expect((await approval).postDataJSON()).toEqual({ notes: "Approved during Playwright E2E" });

    await expect(page.getByText("No pending verification records.")).toBeVisible();
    const refreshedQueue = await waitForRecordedRequest(
      request,
      (item) => item.method === "GET" && item.path === "/api/v1/admin/company-verifications" && item.search.includes("status=pending") && item.search.includes("limit=25"),
    );
    expect(refreshedQueue).toBeTruthy();

    await page.getByRole("link", { name: "Approved" }).click();
    await expect(page).toHaveURL(/status=approved/);
    await expect(page.getByText("Acme Hiring India")).toBeVisible();
    await expect(page.getByRole("cell", { name: "approved" })).toBeVisible();
  });
});
