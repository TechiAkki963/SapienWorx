import { test, expect } from '@playwright/test';
import fs from 'node:fs';

const pages = [
  ['home', '/'],
  ['jobs', '/jobs'],
  ['login', '/login'],
  ['signup', '/signup'],
  ['forgot-password', '/forgot-password'],
] as const;

for (const [name, path] of pages) {
  test(`capture ${name}`, async ({ page }, testInfo) => {
    fs.mkdirSync('visual-artifacts', { recursive: true });
    const response = await page.goto(path, { waitUntil: 'networkidle' });
    expect(response?.status()).toBeLessThan(500);
    await page.screenshot({
      path: `visual-artifacts/${name}-${testInfo.project.name}.png`,
      fullPage: true,
      animations: 'disabled',
    });
  });
}
