import { test, expect, type Page, type Route } from '@playwright/test';
const base = '/astro-material-blog/';
const article = base+'posts/static-search/';
type State = { hidden:boolean; state?:string; message:string; moving:boolean; cancel:{x:number;y:number} };
async function observe(page: Page) {
  const states: State[] = [];
  await page.exposeFunction('reportNavigationFeedback', (state: State) => states.push(state));
  await page.addInitScript(() => {
    document.addEventListener('DOMContentLoaded', () => {
      const feedback = document.querySelector<HTMLElement>('#navigation-feedback')!;
      new MutationObserver(() => {
        const cancel = feedback.querySelector<HTMLElement>('[data-cancel-navigation]')!.getBoundingClientRect();
        const bar = feedback.querySelector<HTMLElement>('.navigation-loading-bar')!;
        // Native pending navigation makes Playwright locators wait for commit. Observe the
        // actual old document's DOM/animation state without intercepting the navigation.
        void (window as unknown as {reportNavigationFeedback:(state:unknown)=>Promise<void>}).reportNavigationFeedback({
          hidden:feedback.hidden, state:feedback.dataset.state,
          message:document.querySelector('#navigation-message')!.textContent,
          moving:getComputedStyle(bar).display !== 'none' && bar.getAnimations({subtree:true}).some(animation => animation.playState === 'running'),
          cancel:{x:cancel.x+cancel.width/2,y:cancel.y+cancel.height/2},
        });
      }).observe(feedback,{attributes:true,childList:true,subtree:true});
    });
  });
  return states;
}
async function hold(page: Page, pattern = '**/posts/static-search/') {
  let release!: () => void;
  const gate = new Promise<void>(resolve => {release=resolve;});
  let count=0;
  const handler = async (route: Route) => { count++; await gate; await route.continue().catch(() => {}); };
  await page.route(pattern,handler);
  return { release, count:()=>count, dispose:async()=>{release();await page.unroute(pattern,handler);} };
}
async function activate(page: Page) { try { await page.locator(`a[href="${article}"]`).first().click(); } catch {} }
const isWaiting = (state: State) => !state.hidden && state.state === 'loading';

test('delayed native response shows genuine indeterminate feedback, downloads once, and clears on success/history', async ({ page }) => {
  const states = await observe(page);
  await page.goto(base);
  const request = await hold(page);
  const clicked = activate(page);
  await expect.poll(() => states.some(isWaiting)).toBe(true);
  expect(states.find(isWaiting)?.moving).toBe(true);
  expect(request.count()).toBe(1);
  request.release(); await clicked;
  await expect(page).toHaveURL(new RegExp(article+'$'));
  await expect(page.locator('#navigation-feedback')).not.toBeVisible();
  await page.goBack(); await expect(page.locator('#navigation-feedback')).not.toBeVisible();
  await page.goForward(); await expect(page.locator('#navigation-feedback')).not.toBeVisible();
});

test('cancel button and browser stop abort waiting without trapping the page, and retry succeeds', async ({ page }) => {
  const states = await observe(page);
  await page.goto(base);
  let request = await hold(page);
  const clicked = activate(page);
  await expect.poll(() => states.some(isWaiting)).toBe(true);
  const position = states.find(isWaiting)!.cancel;
  // Real pointer input remains usable while native document navigation is waiting.
  await page.mouse.click(position.x,position.y);
  await expect.poll(() => states.at(-1)?.message).toContain('已取消');
  request.release(); await clicked; await request.dispose();
  await expect(page).toHaveURL(new RegExp(base+'$'));
  await expect(page.locator('.navigation-loading-bar')).not.toBeVisible();
  await page.getByRole('link',{name:'重试',exact:true}).click();
  await expect(page).toHaveURL(new RegExp(article+'$'));
  await page.goBack();
  states.length=0;
  request = await hold(page);
  const second = activate(page);
  await expect.poll(() => states.some(isWaiting)).toBe(true);
  const protocol = await page.context().newCDPSession(page);
  await protocol.send('Page.stopLoading');
  await expect.poll(() => states.at(-1)?.state).toBe('error');
  request.release(); await second; await request.dispose();
  await expect(page.locator('.navigation-loading-bar')).not.toBeVisible();
  await page.getByRole('button',{name:'关闭',exact:true}).click();
  await expect(page.locator('#navigation-feedback')).not.toBeVisible();
});

test('a stalled response times out with recoverable static reduced-motion feedback', async ({ page }) => {
  test.setTimeout(25000);
  const states = await observe(page);
  await page.emulateMedia({reducedMotion:'reduce'});
  await page.goto(base);
  const request = await hold(page);
  const clicked = activate(page);
  await expect.poll(() => states.some(isWaiting)).toBe(true);
  expect(states.find(isWaiting)?.moving).toBe(false);
  await expect.poll(() => states.at(-1)?.message, {timeout:19000,intervals:[200,500]}).toContain('等待已超时');
  request.release(); await clicked; await request.dispose();
  await expect(page).toHaveURL(new RegExp(base+'$'));
  await expect(page.locator('.navigation-loading-bar')).not.toBeVisible();
  await page.getByRole('link',{name:'重试',exact:true}).click();
  await expect(page).toHaveURL(new RegExp(article+'$'));
  await expect(page.locator('#navigation-feedback')).not.toBeVisible();
});

test('offline navigation stays on the readable page and can retry after reconnecting', async ({ page, context }) => {
  await page.goto(base);
  await context.setOffline(true);
  await page.locator(`a[href="${article}"]`).first().click();
  await expect(page.locator('#navigation-message')).toContainText('离线');
  await expect(page).toHaveURL(new RegExp(base+'$'));
  await expect(page.locator('.navigation-loading-bar')).not.toBeVisible();
  await context.setOffline(false);
  await page.getByRole('link',{name:'重试',exact:true}).click();
  await expect(page).toHaveURL(new RegExp(article+'$'));
});

test('a native network failure may show the browser error page; back recovers without a stale loader', async ({ page }) => {
  const states = await observe(page);
  await page.goto(base);
  let fail!:()=>void;
  const gate = new Promise<void>(resolve=>{fail=resolve;});
  await page.route('**/posts/static-search/', async route=>{await gate;await route.abort('failed');});
  const clicked = activate(page);
  await expect.poll(()=>states.some(isWaiting)).toBe(true);
  const committed = page.waitForEvent('framenavigated', frame=>frame===page.mainFrame());
  fail(); await clicked; await committed;
  // Do not claim in-page recovery when the browser has replaced our document.
  await expect(page.locator('#navigation-feedback')).toHaveCount(0);
  await page.unroute('**/posts/static-search/');
  await page.goBack();
  await expect(page).toHaveURL(new RegExp(base+'$'));
  await expect(page.locator('#navigation-feedback')).not.toBeVisible();
  await activate(page);
  await expect(page.locator('.article-header h1')).toContainText('全文搜索');
});

test('without Navigation API the primary link fallback still loads and Escape cancels', async ({ page }) => {
  await page.addInitScript(()=>{Object.defineProperty(window,'navigation',{value:undefined,configurable:true});});
  const states=await observe(page);
  await page.goto(base);
  const request=await hold(page);
  const clicked=activate(page);
  await expect.poll(()=>states.some(isWaiting)).toBe(true);
  await page.keyboard.press('Escape');
  await expect.poll(()=>states.at(-1)?.message).toContain('已取消');
  request.release(); await clicked; await request.dispose();
  await expect(page).toHaveURL(new RegExp(base+'$'));
  await page.getByRole('link',{name:'重试',exact:true}).click();
  await expect(page).toHaveURL(new RegExp(article+'$'));
});

test('slow Pagefind module shows a spinner; empty input and closing invalidate pending queries', async ({ page }) => {
  await page.goto(base);
  const request=await hold(page,'**/pagefind/pagefind.js');
  await page.getByRole('button',{name:'搜索文章',exact:true}).click();
  await page.getByRole('searchbox').fill('紫藤书签');
  await expect(page.locator('#search-status')).toHaveAttribute('data-busy');
  expect(await page.locator('#search-status').evaluate(element=>getComputedStyle(element,'::before').animationName)).toBe('search-wait');
  await page.getByRole('searchbox').fill('');
  await expect(page.locator('#search-status')).not.toHaveAttribute('data-busy');
  await expect(page.locator('#search-status')).toContainText('输入关键词');
  await page.getByRole('searchbox').fill('紫藤书签');
  await expect(page.locator('#search-status')).toHaveAttribute('data-busy');
  await page.keyboard.press('Escape');
  await expect(page.locator('#search-results')).toHaveAttribute('aria-busy','false');
  request.release(); await request.dispose();
  await page.getByRole('button',{name:'搜索文章',exact:true}).click();
  await expect(page.locator('#search-results a')).toHaveCount(1);
  await expect(page.locator('#search-results a')).toHaveAttribute('href',article);
  expect(request.count()).toBe(1);
});

test('Pagefind module failure offers a real retry and successful Chinese results', async ({ page }) => {
  await page.goto(base);
  await page.route('**/pagefind/pagefind.js*',route=>route.abort('failed'));
  await page.getByRole('button',{name:'搜索文章',exact:true}).click();
  await page.getByRole('searchbox').fill('紫藤书签');
  await expect(page.locator('[data-retry-search]')).toBeVisible();
  await expect(page.locator('#search-status')).not.toHaveAttribute('data-busy');
  await page.unroute('**/pagefind/pagefind.js*');
  await page.getByRole('button',{name:'重试搜索'}).click();
  await expect(page.locator('#search-results a')).toHaveCount(1);
  await expect(page.locator('#search-results a')).toHaveAttribute('href',article);
});

test('Pagefind timeout is bounded, reduced motion is static, and late results stay discarded', async ({ page }) => {
  await page.emulateMedia({reducedMotion:'reduce'});
  await page.goto(base);
  await page.clock.install();
  const request=await hold(page,'**/pagefind/pagefind.js');
  await page.getByRole('button',{name:'搜索文章',exact:true}).click();
  await page.getByRole('searchbox').fill('紫藤书签');
  await page.clock.runFor(400);
  await expect(page.locator('#search-status')).toHaveAttribute('data-busy');
  expect(await page.locator('#search-status').evaluate(element=>getComputedStyle(element,'::before').display)).toBe('none');
  await page.clock.runFor(12000);
  await expect(page.locator('#search-status')).toContainText('等待超时');
  await expect(page.locator('#search-status')).not.toHaveAttribute('data-busy');
  request.release(); await request.dispose();
  await page.clock.resume();
  await page.getByRole('button',{name:'重试搜索'}).click();
  await expect(page.locator('#search-results a')).toHaveCount(1);
});

test('fast navigation never shows loading and hash/modifier/download links keep their native behavior', async ({ page, context }) => {
  const states=await observe(page);
  await page.goto(base);
  await page.locator('a[href="#latest"]').click();
  await expect(page.locator('#navigation-feedback')).not.toBeVisible();
  const tabPromise=context.waitForEvent('page');
  await page.locator(`a[href="${article}"]`).first().click({modifiers:['Control']});
  const tab=await tabPromise; await tab.waitForLoadState('domcontentloaded'); await tab.close();
  await page.evaluate(()=>{const a=document.createElement('a');a.href='/astro-material-blog/favicon.svg';a.download='favicon.svg';a.id='test-download';a.textContent='下载图标';document.body.append(a);});
  const download=page.waitForEvent('download'); await page.locator('#test-download').click(); await download;
  await activate(page);
  await expect(page.locator('.article-header h1')).toContainText('全文搜索');
  expect(states.some(isWaiting)).toBe(false);
});

test('ordinary article links still work without JavaScript', async ({ browser }) => {
  const context=await browser.newContext({javaScriptEnabled:false});
  const page=await context.newPage();
  await page.goto('http://127.0.0.1:4321'+base);
  await page.locator(`a[href="${article}"]`).first().click();
  await expect(page.locator('.article-header h1')).toContainText('全文搜索');
  await expect(page.locator('#navigation-feedback')).not.toBeVisible();
  await context.close();
});
