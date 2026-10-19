import { test, expect } from '@playwright/test';
import fs from 'node:fs';

const pages = [
  ['home', '/'],
  ['jobs', '/jobs'],
  ['login', '/login'],
  ['signup', '/signup'],
  ['forgot-password', '/forgot-password'],
] as const;

async function activateViewportReveals(page: import('@playwright/test').Page) {
  const viewport = page.viewportSize();
  const step = Math.max(480, Math.floor((viewport?.height ?? 800) * 0.75));
  const fullHeight = await page.evaluate(() => document.documentElement.scrollHeight);

  for (let y = 0; y < fullHeight; y += step) {
    await page.evaluate(scrollY => window.scrollTo({ top: scrollY, behavior: 'instant' }), y);
    await page.waitForTimeout(120);
  }

  await page.evaluate(() => window.scrollTo({ top: 0, behavior: 'instant' }));
  await page.waitForTimeout(250);
}

for (const [name, path] of pages) {
  test(`capture ${name}`, async ({ page }, testInfo) => {
    fs.mkdirSync('visual-artifacts', { recursive: true });
    const response = await page.goto(path, { waitUntil: 'networkidle' });
    expect(response?.status()).toBeLessThan(500);

    await activateViewportReveals(page);

    await page.screenshot({
      path: `visual-artifacts/${name}-${testInfo.project.name}.png`,
      fullPage: true,
      animations: 'disabled',
    });
  });
}
