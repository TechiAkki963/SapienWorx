import { expect, test } from "@playwright/test";

import { login, resetE2E, waitForRecordedRequest } from "./helpers";

test.describe("candidate job discovery", () => {
  test.beforeEach(async ({ request }) => resetE2E(request));

  test("preserves facets in the URL/UI and forwards them to server-side job search", async ({ page, request }) => {
    await login(page, "candidate");
    await page.goto("/candidate/jobs");

    await page.getByLabel("Keyword").fill("Go");
    await page.getByLabel("Company name").fill("Sapien Labs India");
    await page.getByLabel("Location").fill("Mumbai");
    await page.getByLabel("Experience").selectOption("3");
    await page.getByLabel("Work mode").selectOption("hybrid");
    await page.locator('input[name="min_salary"]').fill("800000");
    await page.locator('input[name="max_salary"]').fill("1800000");
    await page.locator('select[name="salary_currency"]').selectOption("INR");
    await page.locator("details summary").filter({ hasText: "Education" }).click();
    await page.getByLabel("B.Tech / B.E.").check();
    await page.getByLabel("MCA").check();
    await page.getByRole("button", { name: "Apply filters" }).click();

    await expect(page).toHaveURL(/q=Go/);
    await expect(page).toHaveURL(/location=Mumbai/);
    await expect(page).toHaveURL(/experience=3/);
    await expect(page).toHaveURL(/work_mode=hybrid/);
    await expect(page.getByLabel("Keyword")).toHaveValue("Go");
    await expect(page.getByLabel("Company name")).toHaveValue("Sapien Labs India");
    await expect(page.getByLabel("Experience")).toHaveValue("3");
    await expect(page.getByLabel("B.Tech / B.E.")).toBeChecked();
    await expect(page.getByLabel("MCA")).toBeChecked();
    await expect(page.getByText("24 roles")).toBeVisible();

    const serverSearch = await waitForRecordedRequest(
      request,
      (item) => item.method === "GET" && item.path === "/api/v1/candidate/jobs" && item.search.includes("q=Go"),
    );
    const params = new URLSearchParams(serverSearch.search);
    expect(params.get("q")).toBe("Go");
    expect(params.get("company")).toBe("Sapien Labs India");
    expect(params.get("location")).toBe("Mumbai");
    expect(params.get("experience")).toBe("3");
    expect(params.get("work_mode")).toBe("hybrid");
    expect(params.get("min_salary")).toBe("800000");
    expect(params.get("max_salary")).toBe("1800000");
    expect(params.get("salary_currency")).toBe("INR");
    expect(params.getAll("education").sort()).toEqual(["B.Tech / B.E.", "MCA"].sort());
    expect(params.get("limit")).toBe("10");

    await page.reload();
    await expect(page.getByLabel("Keyword")).toHaveValue("Go");
    await expect(page.getByLabel("Location")).toHaveValue("Mumbai");
    await expect(page.getByLabel("Work mode")).toHaveValue("hybrid");
  });
});
