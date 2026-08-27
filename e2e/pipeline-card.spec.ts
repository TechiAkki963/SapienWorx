import { expect, test } from "@playwright/test";

test("shows the sourcing-level candidate details inside pipeline cards", async ({ page }) => {
  await page.goto("/recruiter/pipeline");

  const amaraCard = page.locator(".pipeline-list-row").filter({ has: page.getByRole("heading", { name: "Amara Mensah" }) });
  await expect(amaraCard.getByText("Senior Product Designer at Cobalt Studio")).toBeVisible();
  await expect(amaraCard.getByText("Product Designer at Northstar Labs")).toBeVisible();
  await expect(amaraCard.getByText("M.Des, National Institute of Design 2020")).toBeVisible();
  await expect(amaraCard.getByText("Bengaluru, Pune, Remote")).toBeVisible();
  await expect(amaraCard.getByText("Figma | Design systems | Research")).toBeVisible();
  await expect(amaraCard.getByLabel("147 recruiters viewed this profile")).toBeVisible();
  await expect(amaraCard.getByLabel("31 recruiters downloaded this profile")).toBeVisible();
  await expect(amaraCard.getByText("Verified phone & email")).toBeVisible();

  await amaraCard.getByLabel("Move Amara Mensah to").selectOption("Interviewing");
  await expect(amaraCard.getByLabel("Move Amara Mensah to")).toHaveValue("Interviewing");
});
