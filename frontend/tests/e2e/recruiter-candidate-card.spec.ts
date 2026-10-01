import { expect, test } from "@playwright/test";

import { login, resetE2E } from "./helpers";

const jobID = "60000000-0000-4000-8000-000000000001";
const noteID = "80000000-0000-4000-8000-000000000001";

test.beforeEach(async ({ request }) => resetE2E(request));

test("candidate card keeps contact private and supports save, bulk selection, and responsive actions", async ({ page }) => {
  await page.route(/\/api\/v1\/recruiter\/talent-pool\/[^/]+$/, route => route.fulfill({ status: 204 }));
  await page.route(/\/api\/v1\/recruiter\/candidates\/[^/]+\/contact$/, route => route.fulfill({
    status: 200,
    contentType: "application/json",
    body: JSON.stringify({ primary: "+919900000011", alternate: "+919900000099" }),
  }));
  await login(page, "recruiter");
  await page.goto(`/recruiter/pipeline?job_id=${jobID}`);

  const card = page.getByRole("article").filter({ has: page.getByRole("heading", { name: "Candidate 001" }) });
  await expect(card).toBeVisible();
  await expect(card).toContainText("Senior Go Platform Engineer");
  await expect(card).toContainText("Not provided");
  await expect(card).not.toContainText("+919900000011");

  await card.getByRole("button", { name: "Save Profile" }).click();
  await expect(card.getByRole("button", { name: "Saved · Unsave" })).toBeVisible();
  await card.getByRole("button", { name: "Saved · Unsave" }).click();
  await expect(card.getByRole("button", { name: "Save Profile" })).toBeVisible();
  await card.getByRole("checkbox", { name: /Select Candidate 001/ }).check();
  await expect(page.getByRole("button", { name: "Save selected profiles" })).toBeEnabled();

  await card.getByRole("button", { name: "View Contact" }).click();
  await expect(card).toContainText("+919900000011");
  await expect(card).not.toContainText("+919900000099");
  await card.getByRole("button", { name: "Show alternate contact" }).click();
  await expect(card).toContainText("+919900000099");
  await expect(card).not.toContainText("+919900000011");
  await card.getByRole("button", { name: "Hide" }).click();
  await expect(card).not.toContainText("+919900000099");

  for (const width of [1440, 768, 390, 320]) {
    await page.setViewportSize({ width, height: width > 768 ? 900 : 844 });
    await expect(card.getByRole("link", { name: "View Profile" })).toBeVisible();
    await expect(card.getByRole("link", { name: "Send InMail" })).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBeTruthy();
  }
});

test("internal recruiter notes lazy-load and support author edits and deletion", async ({ page }) => {
  let note = "";
  await page.route(/\/api\/v1\/recruiter\/candidates\/[^/]+\/comments(?:\/[^/]+)?(?:\?.*)?$/, async route => {
    const method = route.request().method();
    if (method === "POST") { note = route.request().postDataJSON().text; return route.fulfill({ status: 204 }); }
    if (method === "PATCH") { note = route.request().postDataJSON().text; return route.fulfill({ status: 204 }); }
    if (method === "DELETE") { note = ""; return route.fulfill({ status: 204 }); }
    return route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ page: 1, total: note ? 1 : 0, items: note ? [{ id: noteID, author_name: "Riya Recruiter", is_own: true, text: note, job_title: "Senior Go Platform Engineer", created_at: new Date().toISOString(), updated_at: new Date().toISOString(), can_modify: true }] : [] }),
    });
  });
  await login(page, "recruiter");
  await page.goto(`/recruiter/pipeline?job_id=${jobID}`);

  const card = page.getByRole("article").filter({ has: page.getByRole("heading", { name: "Candidate 001" }) });
  await card.getByRole("button", { name: /Recruiter Notes/ }).click();
  const dialog = page.getByRole("dialog", { name: "Recruiter notes" });
  await expect(dialog).toBeVisible();
  await expect(dialog).toContainText("No notes yet");
  await dialog.getByRole("textbox", { name: "Add an internal note" }).fill("Initial screening call completed.");
  await dialog.getByRole("button", { name: "Add note" }).click();
  await expect(dialog).toContainText("Initial screening call completed.");
  await dialog.getByRole("button", { name: "Edit" }).click();
  await dialog.getByRole("textbox", { name: "Edit internal note" }).fill("Screening call completed and documented.");
  await dialog.getByRole("button", { name: "Save", exact: true }).click();
  await expect(dialog).toContainText("Screening call completed and documented.");
  await dialog.getByRole("button", { name: "Delete", exact: true }).click();
  await dialog.getByRole("button", { name: "Confirm delete" }).click();
  await expect(dialog).toContainText("No notes yet");
});
