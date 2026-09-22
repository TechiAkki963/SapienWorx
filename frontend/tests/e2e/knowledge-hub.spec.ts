import { expect, test } from "@playwright/test";
import { login, resetE2E, waitForRecordedRequest } from "./helpers";

test.describe("Knowledge Hub and editorial Control Centre", () => {
  test.beforeEach(async ({ request }) => resetE2E(request));

  test("shows four seeded articles and hides drafts from the public", async ({ page }) => {
    await page.goto("/");
    await expect(page.getByRole("heading", { name: /More than finding your next job/ })).toBeVisible();
    await expect(page.getByRole("link", { name: /Build a résumé that tells your story/ })).toBeVisible();

    await page.goto("/knowledge-hub");
    await expect(page.getByRole("heading", { name: "Grow into what comes next." })).toBeVisible();
    await expect(page.locator("main article")).toHaveCount(4);
    await page.getByRole("link", { name: /Build a résumé that tells your story/ }).click();
    await expect(page.getByRole("heading", { name: "Build a résumé that tells your story" })).toBeVisible();

    await page.goto("/knowledge-hub?category=Interview%20Preparation");
    await expect(page.locator("main article")).toHaveCount(1);
    await expect(page.getByText("Prepare for an interview with confidence")).toBeVisible();
  });

  test("Master Admin can create draft and publish it to both public surfaces", async ({ page, request }) => {
    await login(page, "master_admin");
    await page.goto("/swx-command-centre/knowledge");
    await expect(page.getByRole("heading", { name: "Knowledge Hub" })).toBeVisible();
    await expect(page.getByText("Articles (4)")).toBeVisible();
    await page.getByRole("button", { name: "+ New article" }).click();
    await page.getByRole("textbox", { name: "Title" }).fill("Your next practical career milestone");
    await page.getByRole("textbox", { name: "Slug" }).fill("your-next-practical-career-milestone");
    await page.getByRole("textbox", { name: "Article summary" }).fill("A practical editorial exercise for planning the next step in your career.");
    await page.getByRole("textbox", { name: /Article content/ }).fill("Start with a realistic outcome that you can describe clearly. Choose a small task that demonstrates the skill and write down what you learned. Review the result with a trusted colleague, then improve it before moving on to the next task.");
    await page.getByRole("button", { name: "Create article" }).click();
    await expect(page.getByRole("status")).toContainText("private draft");
    await waitForRecordedRequest(request, item => item.method === "POST" && item.path === "/api/v1/admin/knowledge" && item.body.status === "draft");

    await page.goto("/knowledge-hub");
    await expect(page.getByText("Your next practical career milestone")).toHaveCount(0);

    await page.goto("/swx-command-centre/knowledge");
    await page.getByRole("button", { name: /Your next practical career milestone/ }).click();
    await page.getByLabel("Visibility").selectOption("published");
    await page.getByRole("button", { name: "Save changes" }).click();
    await expect(page.getByRole("status")).toContainText("published");

    await page.goto("/knowledge-hub");
    await expect(page.getByRole("link", { name: /Your next practical career milestone/ })).toBeVisible();
    await page.goto("/knowledge-hub/your-next-practical-career-milestone");
    await expect(page.getByRole("heading", { name: "Your next practical career milestone" })).toBeVisible();
  });

  test("non-admin cannot access the editorial API or workspace", async ({ page, request }) => {
    await login(page, "candidate");
    const response = await page.request.get("http://127.0.0.1:18080/api/v1/admin/knowledge", { headers: { cookie: "swx_e2e_role=candidate" } });
    expect(response.status()).toBe(403);
    await page.goto("/swx-command-centre/knowledge");
    await expect(page).toHaveURL(/\/candidate/);
  });
});
