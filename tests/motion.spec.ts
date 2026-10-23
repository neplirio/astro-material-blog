import { test, expect, type Page } from '@playwright/test';
const base = '/astro-material-blog/';
const recordKey = 'test-motion-events';
type Report = {
  phase: string; path: string; ready?: boolean; entry?: string; names?: string[];
  geometry?: { width?: string; height?: string; transform?: string }[]; title?: boolean;
};
async function observeMotion(page: Page) {
  await page.addInitScript(({ key }) => {
    function record(value: object) {
      const records = JSON.parse(sessionStorage.getItem(key) || '[]');
      sessionStorage.setItem(key, JSON.stringify([...records, value].slice(-30)));
    }
    document.addEventListener('DOMContentLoaded', () => window.addEventListener('pageswap', event => {
      const transition = (event as Event & {viewTransition?: ViewTransition}).viewTransition;
      if (!transition) return;
      record({ phase:'out', path:location.pathname,
        entry:document.querySelector<HTMLElement>('[data-motion-active][data-motion-card]')?.dataset.motionEntry,
        names:Array.from(document.querySelectorAll<HTMLElement>('[data-motion-active]'), element => element.style.viewTransitionName),
      });
    }));
    window.addEventListener('pagereveal', event => {
      const transition = (event as Event & {viewTransition?: ViewTransition}).viewTransition;
      if (!transition) return;
      transition.ready.then(() => {
        const animations = document.getAnimations();
        const group = animations.find(animation => (animation.effect as KeyframeEffect)?.pseudoElement === '::view-transition-group(article-container)');
        const title = animations.some(animation => (animation.effect as KeyframeEffect)?.pseudoElement === '::view-transition-group(article-title)');
        record({ phase:'in', path:location.pathname, ready:true, title,
          entry:document.querySelector<HTMLElement>('[data-motion-active][data-motion-card]')?.dataset.motionEntry,
          names:Array.from(document.querySelectorAll<HTMLElement>('[data-motion-active]'), element => element.style.viewTransitionName),
          geometry:(group?.effect as KeyframeEffect)?.getKeyframes().map(frame => ({width:frame.width, height:frame.height, transform:frame.transform})),
        });
      }, () => record({phase:'in', path:location.pathname, ready:false}));
    });
  }, {key:recordKey});
}
async function reports(page: Page): Promise<Report[]> {
  return page.evaluate(key => JSON.parse(sessionStorage.getItem(key) || '[]'), recordKey);
}
async function settled(page: Page) {
  await page.evaluate(async () => { await (document as Document & {activeViewTransition?: ViewTransition}).activeViewTransition?.finished; });
  await expect(page.locator('[data-motion-active]')).toHaveCount(0);
}
async function expanded(page: Page, expectedSource: string) {
  await expect.poll(async () => {
    const all = await reports(page);
    return all.slice(all.findLastIndex(report => report.phase === 'out') + 1).find(report => report.phase === 'in')?.ready;
  }).toBe(true);
  const all = await reports(page);
  const source = all.filter(report => report.phase === 'out').at(-1)!;
  const destination = all.filter(report => report.phase === 'in').at(-1)!;
  expect(source.entry).toBe(expectedSource);
  expect(source.names?.sort()).toEqual(['article-container','article-title']);
  expect(destination.names?.sort()).toEqual(['article-container','article-title']);
  expect(destination.title).toBe(true);
  // The UA actually interpolates shared container geometry, rather than only fading the page.
  expect(destination.geometry).toHaveLength(2);
  expect(destination.geometry![0]).not.toEqual(destination.geometry![1]);
  await settled(page);
}

test('native card, featured/title/arrow and archive expansion match uniquely and reverse on back/forward', async ({ page }) => {
  await observeMotion(page);
  await page.goto(base);
  test.skip(!await page.evaluate(() => 'PageRevealEvent' in window && CSS.supports('view-transition-name','article-container')), 'Native cross-document transitions unsupported');
  const errors: string[] = [];
  page.on('pageerror', error => errors.push(error.message));
  for (const [selector, entry] of [
    ['.post-card h3 a', 'card-design-with-breath'],
    ['.featured h2 a', 'featured-design-with-breath'],
    ['.featured .round-link', 'featured-design-with-breath'],
  ]) {
    await page.goto(base); await page.evaluate(() => document.fonts.ready);
    if (selector === '.post-card h3 a') { await page.locator(selector).first().scrollIntoViewIfNeeded(); await page.locator(selector).first().focus(); await page.keyboard.press('Enter'); }
    else await page.locator(selector).first().click();
    await expect(page.locator('.article-header h1')).toBeVisible();
    await expanded(page, entry);
    await page.goBack();
    await expect.poll(async () => (await reports(page)).filter(report => report.phase === 'in').at(-1)?.entry).toBe(entry);
    await settled(page);
    await page.goForward(); await expanded(page, entry);
    await page.goBack(); await settled(page);
  }
  await page.goto(base+'archive/'); await page.evaluate(() => document.fonts.ready);
  await page.locator('.archive-item h3 a').first().click();
  await expanded(page, 'archive-design-with-breath');
  await page.goBack();
  await expect.poll(async () => (await reports(page)).filter(report => report.phase === 'in').at(-1)?.entry).toBe('archive-design-with-breath');
  await settled(page);
  expect(errors).toEqual([]);
});

test('related article expands and contracts to the correct related entry', async ({ page }) => {
  await observeMotion(page);
  await page.goto(base+'posts/static-search/'); await page.evaluate(() => document.fonts.ready);
  const related = page.locator('.related a').first();
  const entry = await related.getAttribute('data-motion-entry');
  await related.click(); await expanded(page, entry!);
  await page.goBack();
  await expect.poll(async () => (await reports(page)).filter(report => report.phase === 'in').at(-1)?.entry).toBe(entry);
  await settled(page);
});

test('filter motion staggers without delaying state and cancels on rapid changes or reduced motion', async ({ page }) => {
  await page.goto(base);
  await page.getByRole('button',{name:/生活切片/}).click();
  await expect(page.locator('.post-card:visible')).toHaveCount(2);
  const effects = await page.locator('.posts-grid').evaluate(grid => grid.getAnimations({subtree:true})
    .filter(animation => animation.id === 'glonee-filter-reveal').map(animation => animation.effect?.getTiming().delay));
  expect(effects.length).toBeGreaterThan(0);
  expect(new Set(effects).size).toBe(effects.length);
  await page.getByRole('button',{name:/开发手记/}).click();
  await page.getByRole('button',{name:/全部文章/}).click();
  await expect(page.locator('.post-card:visible')).toHaveCount(6);
  await page.emulateMedia({reducedMotion:'reduce'});
  await expect.poll(() => page.locator('.posts-grid').evaluate(grid => grid.getAnimations({subtree:true}).length)).toBe(0);
  await page.getByRole('button',{name:/设计思考/}).click();
  expect(await page.locator('.posts-grid').evaluate(grid => grid.getAnimations({subtree:true}).length)).toBe(0);
});

test('dialog enters and exits visually with immediate focus restoration and safe rapid reopen', async ({ page }) => {
  await page.goto(base);
  const trigger = page.getByRole('button',{name:'搜索文章',exact:true});
  const dialog = page.locator('#search-dialog');
  await trigger.click(); await expect(page.getByRole('searchbox')).toBeFocused();
  expect(await dialog.evaluate(element => getComputedStyle(element).transitionProperty)).toContain('overlay');
  expect(await dialog.evaluate(element => element.getAnimations().length)).toBeGreaterThan(0);
  await page.getByRole('searchbox').fill('紫藤书签');
  await expect(page.locator('#search-results a')).toHaveCount(1);
  await page.keyboard.press('Escape');
  await expect(dialog).not.toHaveAttribute('open'); await expect(trigger).toBeFocused();
  const exit = await dialog.evaluate(element => ({animations:element.getAnimations().length, pointer:getComputedStyle(element).pointerEvents}));
  expect(exit.animations).toBeGreaterThan(0); expect(exit.pointer).toBe('none');
  // Close and reopen in one task so the queued native close event arrives after reopen.
  await page.evaluate(() => {
    const button = document.querySelector<HTMLButtonElement>('[data-open-search]')!;
    button.click();
    document.querySelector<HTMLButtonElement>('[data-close-search]')!.click();
    button.click();
  });
  await expect(dialog).toHaveAttribute('open'); await expect(page.getByRole('searchbox')).toBeFocused();
  await expect(page.locator('body')).toHaveClass(/dialog-open/);
  await page.keyboard.press('Escape'); await expect(dialog).not.toBeVisible();
  await trigger.click(); await page.getByRole('button',{name:'关闭搜索'}).click();
  await expect(dialog).not.toBeVisible(); await expect(trigger).toBeFocused();
});

for (const mode of ['native','fallback','reduced'] as const) {
  test(`${mode}: full page lifecycle, repeated navigation, search, theme and mobile nav remain functional`, async ({ page }) => {
    const errors: string[] = []; page.on('pageerror', error => errors.push(error.message));
    await observeMotion(page);
    if (mode === 'reduced') await page.emulateMedia({reducedMotion:'reduce'});
    else if (mode === 'fallback') await page.addInitScript(() => { Object.defineProperty(window, 'PageRevealEvent', {value:undefined, configurable:true}); });
    await page.setViewportSize({width:375,height:812});
    await page.goto(base);
    await page.getByLabel('主题',{exact:true}).selectOption('dark');
    for (let round=0;round<2;round++) {
      await page.locator('.post-card h3 a').nth(1).click();
      await expect(page.locator('html')).toHaveAttribute('data-theme','dark');
      await expect(page.locator('.article-header')).toBeVisible();
      await settled(page);
      await page.keyboard.press('Control+k');
      await page.getByRole('searchbox').fill('无障碍');
      await expect(page.locator('#search-results a').first()).toBeVisible();
      await page.keyboard.press('Escape'); await expect(page.locator('#search-dialog')).not.toBeVisible();
      await page.goBack(); await settled(page);
      await page.locator('#menu-toggle').click(); await expect(page.locator('#mobile-nav')).toBeVisible();
      await page.keyboard.press('Escape'); await expect(page.locator('#menu-toggle')).toBeFocused();
      await page.getByRole('button',{name:/生活切片/}).click(); await expect(page.locator('.post-card:visible')).toHaveCount(2);
      await page.getByRole('button',{name:/全部文章/}).click();
    }
    if (mode !== 'native') expect((await reports(page)).some(report => report.names?.includes('article-container'))).toBe(false);
    if (mode === 'reduced') {
      expect(await page.evaluate(() => document.getAnimations().length)).toBe(0);
      await page.keyboard.press('/');
      expect(await page.locator('#search-dialog').evaluate(element => element.getAnimations().length)).toBe(0);
      expect(await page.locator('#search-dialog').evaluate(element => getComputedStyle(element,'::backdrop').transitionDuration)).toBe('0s');
      await page.keyboard.press('Escape');
    }
    await expect(page.locator('body')).not.toHaveClass(/dialog-open/);
    expect(errors).toEqual([]);
  });
}
