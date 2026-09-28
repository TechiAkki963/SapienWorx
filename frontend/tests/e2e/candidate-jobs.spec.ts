import { expect, test } from "@playwright/test";

import { login, resetE2E, waitForRecordedRequest } from "./helpers";

test.describe("candidate job discovery", () => {
  test.beforeEach(async ({ request }) => resetE2E(request));

  test("keeps salary fields inside the filter card and rejects a reversed range", async ({ page }) => {
    await login(page, "candidate");
    await page.setViewportSize({ width: 320, height: 900 });
    await page.goto("/candidate/jobs");

    const minimum = page.getByRole("spinbutton", { name: "Minimum" });
    const maximum = page.getByRole("spinbutton", { name: "Maximum" });
    const salaryCard = maximum.locator("..").locator("..").locator("..");
    const cardBounds = await salaryCard.boundingBox();
    const maxBounds = await maximum.boundingBox();
    expect(cardBounds).not.toBeNull();
    expect(maxBounds).not.toBeNull();
    expect(maxBounds!.x + maxBounds!.width).toBeLessThanOrEqual(cardBounds!.x + cardBounds!.width);

    await minimum.fill("1200000");
    await maximum.fill("800000");
    await expect(page.getByText("Maximum salary must be at least the minimum salary.")).toBeVisible();
    await page.getByRole("button", { name: "Apply filters" }).click();
    await expect(page).not.toHaveURL(/min_salary=/);

    await maximum.fill("1800000");
    await expect(page.getByText("Maximum salary must be at least the minimum salary.")).not.toBeVisible();
    await page.getByRole("button", { name: "Apply filters" }).click();
    await expect(page).toHaveURL(/min_salary=1200000/);
    await expect(page).toHaveURL(/max_salary=1800000/);
  });

  test("preserves structured facets in the URL/UI and forwards them to server-side job search", async ({ page, request }) => {
    await login(page, "candidate");
    await page.goto("/candidate/jobs");

    await page.getByLabel("Keyword").fill("Go");
    await page.getByLabel("Competency").fill("PostgreSQL");
    await page.getByLabel("Company name").fill("Sapien Labs India");
    await page.getByLabel("Location").fill("Mumbai");
    await page.getByLabel("Role / function").selectOption("Technology");
    await page.getByLabel("Employment type").selectOption("full_time");
    await page.getByLabel("Experience").selectOption("3");
    await page.getByLabel("Work mode").selectOption("hybrid");
    await page.getByLabel("Posted date").selectOption("30");
    await page.getByLabel("Sort by").selectOption("relevance");
    await page.locator('input[name="min_salary"]').fill("800000");
    await page.locator('input[name="max_salary"]').fill("1800000");
    await page.locator('select[name="salary_currency"]').selectOption("INR");
    await page.locator("details summary").filter({ hasText: "Education" }).click();
    await page.getByLabel("B.Tech / B.E.").check();
    await page.getByLabel("MCA").check();
    await page.getByRole("button", { name: "Apply filters" }).click();

    await expect(page).toHaveURL(/q=Go/);
    await expect(page).toHaveURL(/competency=PostgreSQL/);
    await expect(page).toHaveURL(/location=Mumbai/);
    await expect(page).toHaveURL(/experience=3/);
    await expect(page).toHaveURL(/work_mode=hybrid/);
    await expect(page).toHaveURL(/employment_type=full_time/);
    await expect(page).toHaveURL(/role_category=Technology/);
    await expect(page).toHaveURL(/posted_within=30/);
    await expect(page).toHaveURL(/sort=relevance/);
    await expect(page.getByLabel("Keyword")).toHaveValue("Go");
    await expect(page.getByLabel("Competency")).toHaveValue("PostgreSQL");
    await expect(page.getByLabel("Company name")).toHaveValue("Sapien Labs India");
    await expect(page.getByLabel("Experience")).toHaveValue("3");
    await expect(page.getByLabel("B.Tech / B.E.")).toBeChecked();
    await expect(page.getByLabel("MCA")).toBeChecked();
    await expect(page.getByText("24 roles · Relevance")).toBeVisible();

    const serverSearch = await waitForRecordedRequest(
      request,
      (item) => item.method === "GET" && item.path === "/api/v1/candidate/jobs" && item.search.includes("q=Go"),
    );
    const params = new URLSearchParams(serverSearch.search);
    expect(params.get("q")).toBe("Go");
    expect(params.get("competency")).toBe("PostgreSQL");
    expect(params.get("company")).toBe("Sapien Labs India");
    expect(params.get("location")).toBe("Mumbai");
    expect(params.get("experience")).toBe("3");
    expect(params.get("work_mode")).toBe("hybrid");
    expect(params.get("employment_type")).toBe("full_time");
    expect(params.get("role_category")).toBe("Technology");
    expect(params.get("posted_within")).toBe("30");
    expect(params.get("sort")).toBe("relevance");
    expect(params.get("min_salary")).toBe("800000");
    expect(params.get("max_salary")).toBe("1800000");
    expect(params.get("salary_currency")).toBe("INR");
    expect(params.getAll("education").sort()).toEqual(["B.Tech / B.E.", "MCA"].sort());
    expect(params.get("limit")).toBe("10");

    await page.reload();
    await expect(page.getByLabel("Keyword")).toHaveValue("Go");
    await expect(page.getByLabel("Competency")).toHaveValue("PostgreSQL");
    await expect(page.getByLabel("Location")).toHaveValue("Mumbai");
    await expect(page.getByLabel("Work mode")).toHaveValue("hybrid");
  });

  test("explains a cross-industry taxonomy alias and remains responsive across target widths", async ({ page }) => {
    await login(page, "candidate");
    await page.goto("/candidate/jobs");

    await page.getByLabel("Keyword").fill("ICU Nursing");
    await page.getByLabel("Role / function").selectOption("Healthcare");
    await page.getByLabel("Employment type").selectOption("full_time");
    await page.getByLabel("Posted date").selectOption("14");
    await page.getByRole("button", { name: "Apply filters" }).click();

    await expect(page).toHaveURL(/q=ICU+Nursing/);
    await expect(page).toHaveURL(/role_category=Healthcare/);
    await expect(page.getByText(/Interpreted “ICU Nursing” as Critical Care Nursing/)).toBeVisible();
    await expect(page.getByRole("heading", { name: "Critical Care Nurse" })).toBeVisible();
    await expect(page.getByText("SWX-JOB-2026-00001", { exact: true })).toBeVisible();

    for (const width of [1440, 1024, 768, 390, 320]) {
      await page.setViewportSize({ width, height: 900 });
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
      await expect(page.getByRole("heading", { name: "All active roles" })).toBeVisible();
    }
  });
});
