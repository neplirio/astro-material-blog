import { test, expect } from '@playwright/test';
const base = '/astro-material-blog/';

// No injected transition observers: observing ready in the test can mask a missing app handler.
for (const mode of ['native','opt-out','unsupported','reduced'] as const) {
  test(`${mode}: slow article navigation after back has no uncaught transition rejection`, async ({ page }) => {
    const errors: string[] = [];
    page.on('pageerror', error => errors.push(error.message));
    if (mode === 'unsupported') await page.addInitScript(() => {
      Object.defineProperty(window, 'PageRevealEvent', {value:undefined, configurable:true});
    });
    if (mode === 'reduced') await page.emulateMedia({reducedMotion:'reduce'});
    await page.goto(base);
    await page.locator('.post-card h3 a').nth(1).click();
    await page.waitForTimeout(600);
    await page.goBack();
    await page.waitForTimeout(600);
    if (mode === 'opt-out') await page.route('**/_astro/*.css', async route => {
      // A real incoming document declining the opt-in reproduces the browser's invalid-state fallback.
      const response = await route.fetch();
      await route.fulfill({response, body:(await response.text()) + '\n@view-transition { navigation: none; }'});
    });
    await page.route('**/posts/static-search/', async route => {
      await new Promise(resolve => setTimeout(resolve,600));
      await route.continue();
    });
    await page.locator('.post-card h3 a').nth(1).click();
    await page.waitForTimeout(600);
    await expect(page.locator('.article-header h1')).toContainText('全文搜索');
    await expect(page.locator('[data-motion-active]')).toHaveCount(0);
    await expect(page.locator('#navigation-feedback')).not.toBeVisible();
    expect(errors).toEqual([]);
  });
}

test('navigation with no shared element skips cleanly without uncaught rejections', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.goto(base);
  for (const path of ['archive/','about/','']) {
    await page.locator(`.desktop-nav a[href="${base}${path}"]`).click();
    await page.waitForTimeout(600);
    await expect(page.locator('[data-motion-active]')).toHaveCount(0);
  }
  await expect(page.locator('#navigation-feedback')).not.toBeVisible();
  expect(errors).toEqual([]);
});
