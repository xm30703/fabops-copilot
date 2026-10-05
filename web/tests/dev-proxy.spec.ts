import { test, expect } from '@playwright/test';
import { writeFile } from 'node:fs/promises';

test('Angular dev server forwards real browser-origin API requests', async ({ page }) => {
  test.skip(process.env.FABOPS_PROXY_LIVE !== '1' || process.env.FABOPS_LIVE === '1', 'Requires live backend with Angular dev server');
  await page.goto('/#/knowledge');
  await expect(page.locator('app-root')).toHaveAttribute('ng-version', /^21\./);
  await page.getByRole('textbox', { name: '搜尋 SOP' }).fill('vacuum pressure');
  const responsePromise = page.waitForResponse(response => response.url().endsWith('/api/search'));
  await page.getByRole('button', { name: '搜尋', exact: true }).click();
  const response = await responsePromise;
  expect(response.status()).toBe(200);
  const browserOrigin=(await response.request().allHeaders())['origin'];
  expect(browserOrigin).toBe('http://127.0.0.1:4200');
  const result = await response.json();
  expect(result.mode).toBe('hybrid-pgvector');
  await expect(page.locator('.source').first()).toContainText('SOP-VAC-01');
  await writeFile('../artifacts/angular-dev-proxy.json', JSON.stringify({
    checkedAtUtc: new Date().toISOString(), devUrl: 'http://127.0.0.1:4200',
    browserOrigin, mode: result.mode,
    citations: result.evidence.map((item: { id: string }) => item.id), passed: true,
  }, null, 2), 'utf8');
});
