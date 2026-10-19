import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

const publicRoutes = ['/', '/login', '/signup', '/jobs'];

for (const route of publicRoutes) {
  test(`WCAG scan ${route}`, async ({ page }) => {
    const consoleErrors: string[] = [];
    page.on('console', msg => {
      if (msg.type() === 'error') consoleErrors.push(msg.text());
    });

    await page.goto(route, { waitUntil: 'networkidle' });
    const results = await new AxeBuilder({ page })
      .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
      .analyze();

    expect(results.violations, JSON.stringify(results.violations, null, 2)).toEqual([]);
    expect(consoleErrors, `console errors on ${route}`).toEqual([]);
  });
}

test('keyboard focus is visible on primary navigation', async ({ page }) => {
  await page.goto('/');
  await page.keyboard.press('Tab');
  const focused = page.locator(':focus');
  await expect(focused).toBeVisible();
  const outline = await focused.evaluate(el => getComputedStyle(el).outlineStyle);
  const boxShadow = await focused.evaluate(el => getComputedStyle(el).boxShadow);
  expect(outline !== 'none' || boxShadow !== 'none').toBeTruthy();
});

test('reduced motion preference does not hide content', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto('/');
  await expect(page.locator('body')).toBeVisible();
  await expect(page.locator('main')).toBeVisible();
});
