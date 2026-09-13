import { expect, test } from "@playwright/test";

test("auth forms expose useful browser autocomplete semantics", async ({ page }) => {
  await page.goto("/login");

  const email = page.getByLabel("Email address");
  const password = page.getByLabel("Password");

  await expect(email).toHaveAttribute("autocomplete", "email");
  await expect(email).toHaveAttribute("name", "email");
  await expect(password).toHaveAttribute("autocomplete", "current-password");
  await expect(password).toHaveAttribute("name", "current-password");
});

test("modal dialogs trap focus, inert the background, close with Escape and restore focus", async ({ page }) => {
  await page.goto("/");

  await page.evaluate(() => {
    const opener = document.createElement("button");
    opener.id = "a11y-dialog-opener";
    opener.textContent = "Open test dialog";
    document.body.appendChild(opener);
    opener.focus();

    const backdrop = document.createElement("div");
    backdrop.id = "a11y-dialog-backdrop";
    const dialog = document.createElement("section");
    dialog.setAttribute("role", "dialog");
    dialog.setAttribute("aria-modal", "true");
    dialog.setAttribute("aria-label", "Accessibility test dialog");

    const first = document.createElement("button");
    first.textContent = "First action";
    const cancel = document.createElement("button");
    cancel.textContent = "Cancel";
    cancel.addEventListener("click", () => backdrop.remove());

    dialog.append(first, cancel);
    backdrop.appendChild(dialog);
    document.body.appendChild(backdrop);
  });

  const dialog = page.getByRole("dialog", { name: "Accessibility test dialog" });
  const first = page.getByRole("button", { name: "First action" });
  const cancel = page.getByRole("button", { name: "Cancel" });

  await expect(dialog).toBeVisible();
  await expect(first).toBeFocused();
  await expect(page.locator("#a11y-dialog-opener")).toHaveAttribute("aria-hidden", "true");

  await cancel.focus();
  await page.keyboard.press("Tab");
  await expect(first).toBeFocused();

  await first.focus();
  await page.keyboard.press("Shift+Tab");
  await expect(cancel).toBeFocused();

  await page.keyboard.press("Escape");
  await expect(dialog).toHaveCount(0);
  await expect(page.locator("#a11y-dialog-opener")).toBeFocused();
  await expect(page.locator("#a11y-dialog-opener")).not.toHaveAttribute("aria-hidden", "true");
});
