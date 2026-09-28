import { expect, test } from "@playwright/test";

import { login, resetE2E, waitForRecordedRequest } from "./helpers";

test.describe("Master Admin command centre", () => {
  test.beforeEach(async ({ request }) => resetE2E(request));

  test("enters through the hidden gateway and fetches the dashboard server-side", async ({ page, request }) => {
    await page.goto("/swx-command-centre");
    await expect(page.getByText("Restricted gateway").first()).toBeVisible();
    await expect(page.getByRole("heading", { name: "Enter the command centre" })).toBeVisible();

    await login(page, "master_admin");
    await expect(page.getByRole("heading", { name: "Platform command centre" })).toBeVisible();
    await expect(page.getByRole("link", { name: "Registered users: 4. View records" })).toBeVisible();
    await expect(page.getByRole("link", { name: "Candidates: 2. View records" })).toBeVisible();
    await expect(page.getByRole("link", { name: "Organizations: 1. View records" })).toBeVisible();

    const dashboard = await waitForRecordedRequest(request, (item) => item.method === "GET" && item.path === "/api/v1/admin/dashboard");
    expect(new URLSearchParams(dashboard.search).get("period")).toBe("7d");
    await page.getByRole("link", { name: /Company reviews/ }).click();
    await expect(page).toHaveURL(/tenants\?status=pending/);
    const queue = await waitForRecordedRequest(request, (item) => item.method === "GET" && item.path === "/api/v1/admin/company-verifications" && item.query.status === "pending");
    expect(queue.query.status).toBe("pending");
  });

  test("approves a pending tenant with an audited client mutation and refreshes the queue", async ({ page, request }) => {
    await login(page, "master_admin");
    await page.goto("/swx-command-centre/tenants");

    await expect(page.getByRole("heading", { name: "Recruiter verification" })).toBeVisible();
    await expect(page.getByText("Acme Hiring India", { exact: true }).first()).toBeVisible();

    const approval = page.waitForRequest((req) => /\/api\/v1\/admin\/company-verifications\/[^/]+\/approve$/.test(new URL(req.url()).pathname) && req.method() === "POST");
    await page.getByRole("button", { name: "Approve" }).click();
    await page.getByLabel("Approval note (optional)", { exact: true }).fill("Approved during Playwright E2E");
    await page.getByRole("button", { name: "Confirm approval", exact: true }).click();
    expect((await approval).postDataJSON()).toEqual({ notes: "Approved during Playwright E2E" });

    await expect(page.getByText("No pending verification records.")).toBeVisible();
    const refreshedQueue = await waitForRecordedRequest(
      request,
      (item) => item.method === "GET" && item.path === "/api/v1/admin/company-verifications" && item.search.includes("status=pending") && item.search.includes("limit=25"),
    );
    expect(refreshedQueue).toBeTruthy();

    await page.getByRole("link", { name: "Approved" }).click();
    await expect(page).toHaveURL(/status=approved/);
    await expect(page.getByText("Acme Hiring India", { exact: true }).first()).toBeVisible();
    await expect(page.getByRole("cell", { name: "approved", exact: true })).toBeVisible();
  });
});
