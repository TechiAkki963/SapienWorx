import { expect, test } from "@playwright/test";

test("builds a sourcing query and opens results in its own workspace", async ({ page }) => {
  await page.goto("/recruiter/sourcing");

  await expect(page.getByRole("heading", { name: "Search candidates" })).toBeVisible();
  await expect(page.getByLabel("Boolean keyword expression")).toHaveValue('("Node.Js" OR "Node")');
  await expect(page.getByRole("heading", { name: "Recent Searches" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Saved Searches" })).toBeVisible();
  const historyRail = page.locator(".resdex-history");
  await expect(historyRail).toHaveCSS("position", "sticky");
  await expect(historyRail).toHaveCSS("border-radius", "18px 18px 12px");

  await page.getByText("Boolean on", { exact: true }).click();
  await page.getByLabel("Add a keyword").fill("TypeScript");
  await expect(page.getByLabel("Add a keyword")).toHaveValue("TypeScript");

  await page.locator(".resdex-keyword-title").first().getByText("Boolean off", { exact: true }).click();
  await expect(page.getByLabel("Boolean keyword expression")).toHaveValue(/TypeScript/);

  await page.getByRole("button", { name: "Search candidates" }).click();
  await expect(page).toHaveURL(/\/search\/results/);
  await expect(page.getByText("AI found", { exact: false })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Avish Bansal" })).toBeVisible();
});
