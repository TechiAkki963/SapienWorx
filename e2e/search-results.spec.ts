import { expect, test } from "@playwright/test";

test("shows dense candidate results and preserves the search in Modify", async ({ page }) => {
  await page.goto("/search/results?anyKeywords=Typescript%2CNode.js&location=Bengaluru");
  await page.evaluate(() => {
    (window as Window & { sapienworxEvents?: Array<{ name: string; properties: Record<string, unknown> }> }).sapienworxEvents = [];
    window.addEventListener("sapienworx:analytics", (event) => {
      (window as Window & { sapienworxEvents?: Array<{ name: string; properties: Record<string, unknown> }> }).sapienworxEvents?.push((event as CustomEvent<{ name: string; properties: Record<string, unknown> }>).detail);
    });
  });

  await expect(page.getByText("638", { exact: true })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Avish Bansal" })).toBeVisible();
  await expect(page.getByRole("checkbox", { name: "Select Avish Bansal" })).toBeVisible();
  await expect(page.locator("mark").filter({ hasText: "TypeScript" }).first()).toBeVisible();
  const avishCard = page.locator(".talent-profile-card").filter({ has: page.getByRole("heading", { name: "Avish Bansal" }) });
  await expect(avishCard.getByText("459 similar profiles")).toBeVisible();
  await expect(avishCard.getByText("Verified phone & email")).toBeVisible();
  await expect(avishCard.getByRole("button", { name: "⇩ CV" })).toBeVisible();
  await expect(avishCard.locator(".talent-skill").first()).toBeVisible();
  await expect.poll(() => avishCard.locator(".talent-skill").count()).toBeGreaterThan(5);
  await expect(avishCard).toHaveCSS("border-radius", "18px 13px 18px 10px");
  await expect(avishCard.getByRole("heading", { name: "Avish Bansal" })).toHaveCSS("font-family", /Georgia|Palatino|Baskerville|Iowan/);

  await page.getByRole("checkbox", { name: "Select Avish Bansal" }).check();
  await page.getByRole("button", { name: "Switch to NVite" }).click();
  await expect.poll(() => page.evaluate(() => (window as Window & { sapienworxEvents?: Array<{ name: string; properties: Record<string, unknown> }> }).sapienworxEvents?.[0]?.name)).toBe("recruiter_bulk_email_opened");
  await expect(page.getByRole("heading", { name: "Email 1 selected candidate" })).toBeVisible();
  await expect(page.getByText("Each recipient is processed as an individual protected message through the RabbitMQ-backed workflow.")).toBeVisible();
  await page.getByRole("button", { name: "Close email dialog" }).click();

  await page.getByLabel("Active in").selectOption("FIFTEEN_DAYS");
  await page.getByLabel("Sort by").selectOption("updated");
  await page.getByLabel("Show").selectOption("80");
  await expect(page).toHaveURL(/sortBy=updated/);
  await page.getByRole("link", { name: "View profile" }).first().click();
  await expect(page).toHaveURL(/\/recruiter\/candidates\//);
  await expect(page.getByRole("link", { name: "← Back to search results" })).toBeVisible();
  await page.goBack();
  await expect(page.getByRole("heading", { name: "Avish Bansal" })).toBeVisible();
  await expect(page.getByLabel("Active in")).toHaveValue("FIFTEEN_DAYS");
  await expect(page.getByLabel("Sort by")).toHaveValue("updated");
  await expect(page.getByLabel("Show")).toHaveValue("80");

  await page.getByRole("link", { name: "Modify" }).click();
  await expect(page).toHaveURL(/\/recruiter\/sourcing/);
  await expect(page.getByLabel("Add a keyword")).toHaveValue("Typescript,Node.js");
  await expect(page.getByLabel("Current location")).toHaveValue("Bengaluru");
});

test("suggests widening an over-constrained experience search", async ({ page }) => {
  await page.goto("/search/results?anyKeywords=Typescript&minExperience=20");

  await expect(page.getByRole("heading", { name: "This exact profile is proving elusive" })).toBeVisible();
  await expect(page.getByText("We’ve scoured the database, but this exact profile is proving a bit elusive. Shall we broaden the experience filter?")).toBeVisible();
  await expect(page.getByRole("button", { name: "Remove experience filter" })).toBeVisible();
  await page.getByRole("button", { name: "Remove experience filter" }).click();
  await expect(page).not.toHaveURL(/minExperience=/);
});

test("uses the supported result-page sizes", async ({ page }) => {
  await page.goto("/search/results?anyKeywords=Typescript");

  for (const size of ["20", "40", "80", "160"]) {
    await page.getByLabel("Show").selectOption(size);
    await expect(page.getByLabel("Show")).toHaveValue(size);
  }

  await expect(page).not.toHaveURL(/pageSize=/);
});
