import { expect, test } from "@playwright/test";

test("shows truthful candidate results and preserves the search in Modify", async ({ page }) => {
  await page.goto("/search/results?anyKeywords=Typescript%2CNode.js&location=Bengaluru");

  await expect(page.getByRole("heading", { name: "2 candidates found" })).toBeVisible();
  await expect(page.getByText("Local demo mode is enabled.", { exact: false })).toBeVisible();
  await expect(page.getByText("AI found", { exact: false })).toHaveCount(0);
  await expect(page.locator("table").getByText("Avish Bansal", { exact: true })).toBeVisible();
  await expect(page.locator("table").getByText("Vaibhav T Thakur", { exact: true })).toBeVisible();
  await expect(page.locator("table").getByText("TypeScript", { exact: true }).first()).toBeVisible();
  await expect(page.locator("table").getByText("0.91", { exact: true })).toBeVisible();
  await expect(page.getByText("Search rank is shown with evidence; it is not a match probability.")).toBeVisible();

  await page.getByRole("link", { name: "Edit search" }).click();
  await expect(page).toHaveURL(/\/recruiter\/sourcing/);
  await expect(page.getByLabel("Preferred keywords")).toHaveValue("Typescript,Node.js");
  await expect(page.getByLabel("Current location")).toHaveValue("Bengaluru");
});

test("labels local fixtures clearly and never presents them as live data", async ({ page }) => {
  await page.goto("/search/results?anyKeywords=Typescript");
  await expect(page.getByText("Local demo mode is enabled. These fixtures are never used as a production fallback.")).toBeVisible();
  await expect(page.getByText("Live results", { exact: true })).toHaveCount(0);
});

test("uses deterministic relevance terminology rather than AI claims", async ({ page }) => {
  await page.goto("/search/results?anyKeywords=Typescript");

  await expect(page.getByText("Deterministic candidate retrieval with explainable evidence.", { exact: false })).toBeVisible();
  await expect(page.getByText(/AI (found|match|search|recommended)/i)).toHaveCount(0);
});
