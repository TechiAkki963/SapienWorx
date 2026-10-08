import { expect, test } from "@playwright/test";
import { login, resetE2E } from "./helpers";

test.beforeEach(async ({ request }) => resetE2E(request));

test("search waits for hydration and draft restoration before accepting its first click", async ({ page, browser }) => {
  await login(page, "recruiter");
  const context = await browser.newContext({ storageState: await page.context().storageState() });
  let releaseScripts!: () => void;
  const scriptsReady = new Promise<void>(resolve => { releaseScripts = resolve; });
  const searchPage = await context.newPage();
  await searchPage.addInitScript(() => {
    sessionStorage.setItem("swx-talent-search:20000000-0000-4000-8000-000000000001", JSON.stringify({ min_experience: "3.5" }));
  });
  await searchPage.route("**/_next/**", async route => {
    if (route.request().resourceType() === "script") await scriptsReady;
    await route.continue();
  });
  try {
    await searchPage.goto("/recruiter/discover", { waitUntil: "commit" });
    const search = searchPage.locator(".swx-search-actions").getByRole("button", { name: "Search Talent", exact: true });
    await expect(search).toBeVisible();
    await expect(search).toBeDisabled();
    releaseScripts();
    await expect(search).toBeEnabled();
    await expect(searchPage.getByLabel("Minimum experience (years)", { exact: true })).toHaveValue("3.5");
    const response = searchPage.waitForResponse(response => response.url().endsWith("/api/v1/recruiter/discover") && response.request().method() === "POST");
    await search.click();
    const completed = await response;
    expect(completed.status()).toBe(200);
    expect(completed.request().postDataJSON().filters.min_experience).toBe("3.5");
    await expect(searchPage.getByRole("button", { name: "Aarav Mehta", exact: true })).toBeVisible();
    await searchPage.getByRole("button", { name: "Aarav Mehta", exact: true }).click();
    await expect(searchPage.getByRole("dialog", { name: "Candidate preview", exact: true })).toBeVisible();
  } finally {
    releaseScripts();
    await context.close();
  }
});
