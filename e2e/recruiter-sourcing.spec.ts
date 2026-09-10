import { expect, test } from "@playwright/test";

test("builds a structured sourcing query and opens truthful results", async ({ page }) => {
  await page.goto("/recruiter/sourcing");

  await expect(page.getByRole("heading", { name: "Search talent" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Start with the essentials." })).toBeVisible();
  await expect(page.getByText("Structured search", { exact: true })).toBeVisible();
  await expect(page.getByLabel("Add a keyword")).toHaveValue("");
  await expect(page.getByLabel("Current location")).toHaveValue("");

  await page.getByLabel("Add a keyword").fill("TypeScript, Node.js");
  await page.getByLabel("Current location").fill("Bengaluru");
  await page.getByRole("button", { name: "Search candidates" }).click();

  await expect(page).toHaveURL(/\/search\/results/);
  await expect(page.getByRole("heading", { name: "2 candidates found" })).toBeVisible();
  await expect(page.getByText("Local demo mode is on.", { exact: false })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Avish Bansal" })).toBeVisible();
  await expect(page.getByText("AI found", { exact: false })).toHaveCount(0);
});

test("keeps detailed sourcing criteria behind progressive disclosure", async ({ page }) => {
  await page.goto("/recruiter/sourcing");

  const moreFilters = page.getByRole("button", { name: /More filters/ });
  await expect(moreFilters).toHaveAttribute("aria-expanded", "false");
  await expect(page.getByRole("heading", { name: "Employment" })).toHaveCount(0);

  await moreFilters.click();
  await expect(moreFilters).toHaveAttribute("aria-expanded", "true");
  await expect(page.getByRole("heading", { name: "Employment" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Compensation" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Education" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Professional profile links" })).toBeVisible();
  await expect(page.getByText("Sensitive personal attributes such as gender, age, disability, religion or other protected characteristics", { exact: false })).toBeVisible();
});

test("supports Boolean search without presenting AI sourcing claims", async ({ page }) => {
  await page.goto("/recruiter/sourcing");

  await page.getByRole("checkbox").first().check();
  await expect(page.getByText("Boolean search", { exact: true })).toBeVisible();
  await page.getByLabel("Boolean keyword expression").fill('(Java OR Kotlin) AND "Spring Boot"');
  await page.getByRole("button", { name: "Search candidates" }).click();

  await expect(page).toHaveURL(/booleanQuery=/);
  await expect(page.getByText("AI Search", { exact: false })).toHaveCount(0);
});
