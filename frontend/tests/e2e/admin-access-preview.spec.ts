import { expect, test } from "@playwright/test";

const route = "/swx-command-centre/access";

test("anonymous access returns to the restricted gateway and preserves the dog", async ({ page }) => {
  await page.goto(route);
  await expect(page).toHaveURL(/\/swx-command-centre$/);
  const dog = page.getByRole("img", { name: "SapienWorx golden retriever wearing a fingerprint bandana" });
  await expect(dog).toBeVisible();
  expect(await dog.evaluate((image: HTMLImageElement) => image.complete && image.naturalWidth > 0)).toBe(true);
  for (const width of [1440, 768, 375]) {
    await page.setViewportSize({ width, height: 960 });
    await expect(dog).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
    await page.screenshot({ path: "../output/admin-gateway-dog-" + width + ".png", fullPage: true });
  }
  await expect(page.getByRole("heading", { name: "Administrative permissions" })).toHaveCount(0);
});

test("candidate and recruiter sessions cannot open the administrative preview", async ({ page }) => {
  for (const role of ["candidate", "recruiter"]) {
    await page.goto(role === "candidate" ? "/login" : "/recruiter/login");
    await page.getByLabel(role === "candidate" ? "Email" : "Work email", { exact: true }).fill(`${role}@example.com`);
    await page.getByLabel("Password", { exact: true }).fill("E2e-password-123!");
    await page.getByRole("button", { name: "Sign in", exact: true }).click();
    await expect(page).toHaveURL(new RegExp(`/${role}(?:$|\\?)`));
    await page.goto(route);
    await expect(page).toHaveURL(new RegExp(`/${role}(?:$|\\?)`));
    await expect(page.getByRole("heading", { name: "Administrative permissions" })).toHaveCount(0);
  }
});

test("role preview is clearly non-enforcing, read-only and responsive", async ({ page }) => {
  await page.goto("/swx-command-centre");
  await page.getByLabel("Email", { exact: true }).fill("master_admin@example.com");
  await page.getByLabel("Password", { exact: true }).fill("E2e-password-123!");
  await page.getByRole("button", { name: "Enter command centre", exact: true }).click();
  await expect(page).toHaveURL(/\/swx-command-centre\/overview$/);
  await page.getByRole("link", { name: "Access design · preview" }).click();
  await expect(page.getByRole("heading", { name: "Administrative permissions" })).toBeVisible();
  await expect(page.getByText("Preview · not enforced", { exact: true })).toBeVisible();
  const selector = page.getByLabel("Preview an administrative role", { exact: true });
  await expect(selector).toHaveValue("auditor");
  const users = page.getByRole("article").filter({ has: page.getByRole("heading", { name: "User management", exact: true }) });
  await expect(users.getByText("Proposed", { exact: true })).toHaveCount(0);
  const mutations: string[] = [];
  page.on("request", (request) => { if (request.method() !== "GET" && new URL(request.url()).pathname.startsWith("/api/")) mutations.push(request.url()); });
  await selector.selectOption("support_admin");
  await expect(users.getByText("Proposed", { exact: true })).toHaveCount(1);
  await expect(users.getByText("Not granted", { exact: true })).toHaveCount(1);
  await selector.selectOption("super_admin");
  await expect(page.getByText("Not granted", { exact: true })).toHaveCount(0);
  await selector.selectOption("content_admin");
  await expect(page.getByText("3 proposed capabilities", { exact: true })).toBeVisible();
  expect(mutations).toEqual([]);
  await selector.selectOption("auditor");
  for (const width of [1440, 768, 375]) {
    await page.setViewportSize({ width, height: 960 });
    await expect(selector).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
    await page.screenshot({ path: `../output/admin-access-preview-${width}.png`, fullPage: true });
  }
});
