import { expect, test, type Page } from "@playwright/test";

async function mockSecureLogout(page: Page) {
  let logoutRequests = 0;
  await page.route("**/api/auth/csrf", (route) => route.fulfill({ status: 200, json: { token: "test-csrf", headerName: "X-XSRF-TOKEN" } }));
  await page.route("**/api/auth/logout", (route) => {
    logoutRequests += 1;
    expect(route.request().method()).toBe("POST");
    expect(route.request().headers()["x-xsrf-token"]).toBe("test-csrf");
    return route.fulfill({ status: 204 });
  });
  return () => logoutRequests;
}

test("signs a recruiter out and removes local workspace data", async ({ page }) => {
  const logoutRequests = await mockSecureLogout(page);
  await page.goto("/recruiter");
  await page.evaluate(() => {
    window.localStorage.setItem("sapienworx.local-candidate-domain", "TECH");
    window.localStorage.setItem("sapienworx-saved-candidates", '["preview-1"]');
  });

  await page.getByRole("button", { name: /Account menu/ }).click();
  await page.getByRole("button", { name: "Log out" }).click();
  await expect(page).toHaveURL(/\/recruiter\/login$/);
  await expect.poll(logoutRequests).toBe(1);
  await expect.poll(() => page.evaluate(() => [window.localStorage.getItem("sapienworx.local-candidate-domain"), window.localStorage.getItem("sapienworx-saved-candidates")])).toEqual([null, null]);
});

test("sends a candidate to the candidate sign-in page after logout", async ({ page }) => {
  await mockSecureLogout(page);
  await page.addInitScript(() => window.localStorage.setItem("sapienworx.local-candidate-domain", "TECH"));
  await page.goto("/candidate");

  await page.getByRole("button", { name: /Account menu/ }).click();
  await page.getByRole("button", { name: "Log out" }).click();
  await expect(page).toHaveURL(/\/login$/);
  await expect(page.getByRole("heading", { name: "Welcome back" })).toBeVisible();
});
