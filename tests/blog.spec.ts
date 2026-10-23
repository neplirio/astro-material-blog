import { test, expect } from '@playwright/test';
const base = '/astro-material-blog/';

test('real Chinese full text search loads Pagefind and opens a correct article', async ({ page }) => {
  const loaded: string[] = [];
  const errors: string[] = [];
  page.on('pageerror', error => errors.push(error.message));
  page.on('response', response => { if (response.ok() && response.url().includes('/pagefind/')) loaded.push(response.url()); });
  await page.goto(base);
  const trigger = page.getByRole('button',{name:'搜索文章',exact:true});
  await trigger.click();
  const dialog = page.getByRole('dialog'); await expect(dialog).toBeVisible();
  const input = page.getByRole('searchbox',{name:'搜索文章全文'}); await expect(input).toBeFocused();
  await input.fill('紫藤书签');
  const result = dialog.getByRole('link',{name:/静态博客，也值得拥有好用的全文搜索/});
  await expect(result).toBeVisible();
  expect(loaded.some(url => url.endsWith('/pagefind.js'))).toBeTruthy();
  expect(loaded.some(url => /\.(pf_index|pf_fragment|wasm)/.test(url))).toBeTruthy();
  await expect(result).toHaveAttribute('href',base+'posts/static-search/');
  await result.click();
  await expect(page).toHaveURL(new RegExp(base+'posts/static-search/'));
  await expect(page.getByRole('heading',{level:1})).toHaveText('静态博客，也值得拥有好用的全文搜索');
  await page.keyboard.press('Control+k');
  await expect(dialog).toBeVisible();
  await input.fill('无障碍');
  await expect(dialog.getByRole('link',{name:/从一个按钮开始/})).toBeVisible();
  await input.fill('龘靐齉');
  await expect(page.getByRole('status')).toContainText('没有找到');
  await page.keyboard.press('Escape'); await expect(dialog).not.toBeVisible();
  expect(errors).toEqual([]);
  expect(loaded.every(url => new URL(url).pathname.startsWith(base))).toBeTruthy();
});

test('search supports shortcut, traps focus and returns focus to its trigger', async ({ page }) => {
  await page.goto(base);
  const trigger = page.getByRole('button',{name:'搜索文章',exact:true});
  await trigger.focus(); await page.keyboard.press('Control+k');
  const dialog = page.getByRole('dialog'); await expect(dialog).toBeVisible();
  await expect(page.getByRole('searchbox')).toBeFocused();
  for (let n=0;n<7;n++) { await page.keyboard.press('Tab'); expect(await page.evaluate(() => !!document.activeElement?.closest('dialog'))).toBeTruthy(); }
  await page.keyboard.press('Escape'); await expect(dialog).not.toBeVisible(); await expect(trigger).toBeFocused();
  await page.keyboard.press('/'); await expect(dialog).toBeVisible();
});

test('theme persists across reload and navigation and follows system changes', async ({ page }) => {
  await page.emulateMedia({ colorScheme:'light' }); await page.goto(base);
  const html = page.locator('html'); const select = page.getByLabel('主题',{exact:true});
  await expect(html).toHaveAttribute('data-theme','light');
  await select.selectOption('dark'); await expect(html).toHaveAttribute('data-theme','dark');
  await page.reload(); await expect(html).toHaveAttribute('data-theme','dark'); await expect(select).toHaveValue('dark');
  await page.locator('.post-card h3 a').first().click(); await expect(html).toHaveAttribute('data-theme','dark');
  await select.selectOption('light'); await page.reload(); await expect(html).toHaveAttribute('data-theme','light');
  await select.selectOption('system'); await page.emulateMedia({colorScheme:'dark'}); await expect(html).toHaveAttribute('data-theme','dark');
  await page.emulateMedia({colorScheme:'light'}); await expect(html).toHaveAttribute('data-theme','light');
});

test('topic filters show matching real articles with accessible state', async ({ page }) => {
  await page.goto(base);
  await expect(page.locator('.post-card:visible')).toHaveCount(6);
  for (const topic of ['开发手记','设计思考','生活切片']) {
    const chip = page.getByRole('button',{name:new RegExp(topic)}); await chip.click(); await expect(chip).toHaveAttribute('aria-pressed','true');
    await expect(page.locator('.post-card:visible')).toHaveCount(2);
    for (const card of await page.locator('.post-card:visible').all()) await expect(card).toHaveAttribute('data-topic',topic);
  }
  await page.getByRole('button',{name:/全部文章/}).click(); await expect(page.locator('.post-card:visible')).toHaveCount(6);
});

test('mobile navigation, narrow layouts, reduced motion and article TOC work', async ({ page }) => {
  await page.setViewportSize({width:375,height:812}); await page.emulateMedia({reducedMotion:'reduce'}); await page.goto(base);
  const toggle = page.locator('#menu-toggle'); await toggle.click(); await expect(toggle).toHaveAttribute('aria-expanded','true');
  const nav = page.getByRole('navigation',{name:'移动导航'}); await expect(nav).toBeVisible();
  await page.keyboard.press('Escape'); await expect(nav).not.toBeVisible(); await expect(toggle).toBeFocused();
  await toggle.click(); await nav.getByRole('link',{name:'文章归档'}).click();
  await expect(page.getByRole('heading',{level:1})).toContainText('写过的');
  await page.locator('.archive-item h3 a').first().click();
  const toc = page.getByRole('complementary',{name:'文章目录'}); await expect(toc).toBeVisible();
  await toc.locator('a').first().click(); expect(new URL(page.url()).hash.length).toBeGreaterThan(1);
  await page.getByRole('button',{name:'搜索文章',exact:true}).click();
  await page.getByRole('searchbox').fill('散步'); await expect(page.locator('#search-results a').first()).toBeVisible();
  await page.keyboard.press('Escape');
  for (const width of [320,375,768,1280]) {
    await page.setViewportSize({width,height:900});
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBeTruthy();
    await page.goto(base); expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBeTruthy();
    expect(await page.evaluate(() => getComputedStyle(document.documentElement).scrollBehavior)).toBe('auto');
  }
});

test('every article, RSS, about and 404 can be visited in built preview', async ({ page, request }) => {
  await page.goto(base);
  const links = await page.locator('.post-card h3 a').evaluateAll(nodes => nodes.map(node => (node as HTMLAnchorElement).pathname));
  for (const link of links) {
    const response = await page.goto(link); expect(response?.status()).toBe(200);
    await expect(page.locator('.demo-banner')).toContainText('原创示例文章'); await expect(page.locator('.prose h2').first()).toBeVisible();
  }
  await page.goto(base+'about/'); await expect(page.getByRole('heading',{level:1})).toContainText('Glonee');
  const rss = await request.get(base+'rss.xml'); expect(rss.ok()).toBeTruthy(); expect(await rss.text()).toContain('<rss');
  await page.goto(base+'404.html'); await expect(page.getByRole('heading',{level:1})).toContainText('这条小路');
  await page.getByRole('link',{name:'回到首页'}).click(); await expect(page).toHaveURL(new RegExp(base+'$'));
});
