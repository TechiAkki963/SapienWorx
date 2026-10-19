import { test, expect } from '@playwright/test';
import { assertNoHorizontalOverflow, assertNoLayoutShift, login } from './helpers';

const viewports = [
  { width: 390, height: 844, name: 'mobile' },
  { width: 768, height: 1024, name: 'tablet' },
  { width: 1440, height: 1000, name: 'desktop' }
];

test.describe('UI/UX visual and density checks', () => {
  test('brand palette does not expose harsh fallback colors', async ({ page }) => {
    await page.goto('/');
    const forbidden = ['rgb(255, 0, 0)', 'rgb(0, 255, 0)', 'rgb(0, 0, 255)'];
    const colors = await page.locator('body *').evaluateAll(nodes => {
      const result = new Set<string>();
      for (const n of nodes.slice(0, 1500)) {
        const s = getComputedStyle(n as Element);
        result.add(s.color);
        result.add(s.backgroundColor);
        result.add(s.borderColor);
      }
      return [...result];
    });
    for (const color of forbidden) expect(colors).not.toContain(color);
  });

  test('hero motion avoids layout shift', async ({ page }) => {
    await assertNoLayoutShift(page, async () => {
      await page.goto('/');
      await page.waitForTimeout(2500);
    });
  });

  for (const vp of viewports) {
    test(`candidate login responsive: ${vp.name}`, async ({ page }) => {
      await page.setViewportSize({ width: vp.width, height: vp.height });
      await page.goto('/login?role=candidate');
      await assertNoHorizontalOverflow(page);
      await expect(page).toHaveScreenshot(`candidate-login-${vp.name}.png`, {
        fullPage: true,
        maxDiffPixelRatio: 0.02
      });
    });
  }

  test('dense recruiter candidate table handles 1000+ rows', async ({ page }) => {
    await login(page, 'recruiter');
    await page.goto('/recruiter/candidates?qaRows=1200');
    const table = page.getByTestId('candidate-table');
    await expect(table).toBeVisible();
    const started = Date.now();
    await table.evaluate(el => { el.scrollTop = el.scrollHeight; });
    await page.waitForTimeout(300);
    expect(Date.now() - started).toBeLessThan(1200);
    await assertNoHorizontalOverflow(page);
  });

  test('faceted filters remain inside viewport', async ({ page }) => {
    await login(page, 'recruiter');
    await page.goto('/recruiter/candidates');
    for (const id of ['filter-location', 'filter-tech-stack', 'filter-notice-period']) {
      const control = page.getByTestId(id);
      await expect(control).toBeVisible();
      const box = await control.boundingBox();
      expect(box).not.toBeNull();
      if (box) expect(box.x + box.width).toBeLessThanOrEqual((await page.viewportSize())!.width + 1);
    }
  });

  test('pipeline remains usable on mobile', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await login(page, 'recruiter');
    await page.goto('/recruiter/pipeline');
    await expect(page.getByTestId('pipeline-board')).toBeVisible();
    await assertNoHorizontalOverflow(page);
  });
});
